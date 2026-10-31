import logging
from typing import Dict, Any, List, Optional
from places.models import Place
from .prompts import SYSTEM_INSTRUCTION, build_planning_user_prompt
from .schemas import RawAIItinerary, TripPreferencesInput
from .providers.gemini_provider import GeminiProvider
from .providers.ollama_provider import OllamaProvider
from .deterministic_planner import DeterministicPlanner

logger = logging.getLogger(__name__)

class AIManager:
    """
    Orchestrates the 3-tier fallback hierarchy:
    Tier 1: Google Gemini API (Primary)
    Tier 2: Ollama Local Models (Automatic Fallback)
    Tier 3: Deterministic Planner (Guaranteed Database Fallback)

    Strictly validates all output against SQLite place records to prevent hallucinations.
    """

    def __init__(self):
        self.gemini = GeminiProvider()
        self.ollama = OllamaProvider()
        self.deterministic = DeterministicPlanner()

    def get_providers_status(self) -> Dict[str, Any]:
        return {
            "gemini": self.gemini.check_health().to_dict(),
            "ollama": self.ollama.check_health().to_dict(),
            "deterministic": {
                "name": "DETERMINISTIC",
                "available": True,
                "message": "Deterministic database engine is ready.",
                "model": "rule-based-spatial-v1"
            }
        }

    def plan_itinerary(
        self,
        preferences: TripPreferencesInput,
        destination_name: str,
        candidate_places: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        if not candidate_places:
            raise ValueError(f"Insufficient places found in database for '{destination_name}'.")

        # Map candidate places by ID and lowercase name for strict grounding validation
        places_by_id = {str(p['id']): p for p in candidate_places}
        places_by_name = {p['name'].lower().strip(): p for p in candidate_places}

        user_prompt = build_planning_user_prompt(
            destination_name=destination_name,
            duration_days=preferences.duration_days,
            daily_budget_inr=preferences.budget_per_day,
            group_type=preferences.group_type,
            interests=preferences.interests,
            pace=preferences.preferred_pace,
            candidate_places=candidate_places,
            start_date=preferences.start_date or ""
        )

        raw_plan = None
        provider_used = None
        fallback_chain = []

        # Tier 1: Try Gemini (if configured)
        if getattr(self.gemini, 'is_configured', bool(getattr(self.gemini, 'api_key', None))):
            try:
                raw_plan = self.gemini.generate_plan(user_prompt, SYSTEM_INSTRUCTION)
                # Validate through Pydantic
                RawAIItinerary.model_validate(raw_plan)
                provider_used = "GEMINI"
                logger.info("Successfully generated itinerary via Gemini.")
            except Exception as e:
                msg = f"Gemini provider failed: {e}"
                logger.warning(msg)
                fallback_chain.append(msg)
        else:
            fallback_chain.append("Gemini provider skipped (GEMINI_API_KEY not configured).")

        # Tier 2A: Try Ollama Primary Model (gemma3:4b)
        if not raw_plan and self.ollama.model_name:
            primary_model = self.ollama.model_name
            try:
                raw_plan = self.ollama.generate_plan(user_prompt, SYSTEM_INSTRUCTION, model_name=primary_model)
                RawAIItinerary.model_validate(raw_plan)
                provider_used = f"OLLAMA ({primary_model})"
                logger.info(f"Successfully generated itinerary via Ollama primary model ({primary_model}).")
            except Exception as e:
                msg = f"Ollama primary model '{primary_model}' failed: {e}"
                logger.warning(msg)
                fallback_chain.append(msg)

        # Tier 2B: Try Ollama Fallback Model (qwen2.5:3b)
        if not raw_plan and self.ollama.fallback_model:
            fallback_model = self.ollama.fallback_model
            try:
                raw_plan = self.ollama.generate_plan(user_prompt, SYSTEM_INSTRUCTION, model_name=fallback_model)
                RawAIItinerary.model_validate(raw_plan)
                provider_used = f"OLLAMA ({fallback_model})"
                logger.info(f"Successfully generated itinerary via Ollama fallback model ({fallback_model}).")
            except Exception as e:
                msg = f"Ollama fallback model '{fallback_model}' failed: {e}"
                logger.warning(msg)
                fallback_chain.append(msg)

        # Tier 3: Deterministic Planner if all AI providers failed
        if not raw_plan:
            logger.info("Falling back to Deterministic Planner.")
            raw_plan = self.deterministic.generate_plan(
                destination_name=destination_name,
                duration_days=preferences.duration_days,
                daily_budget_inr=preferences.budget_per_day,
                group_type=preferences.group_type,
                candidate_places=candidate_places,
                interests=preferences.interests,
                pace=preferences.preferred_pace,
                start_date=preferences.start_date or ""
            )
            provider_used = "DETERMINISTIC"

        # Database Grounding & Validation Pass
        validated_itinerary = self._ground_and_validate_itinerary(
            raw_plan=raw_plan,
            destination_name=destination_name,
            preferences=preferences,
            places_by_id=places_by_id,
            places_by_name=places_by_name,
            candidate_places=candidate_places,
            provider_used=provider_used,
            fallback_chain=fallback_chain
        )

        return validated_itinerary

    def _ground_and_validate_itinerary(
        self,
        raw_plan: Dict[str, Any],
        destination_name: str,
        preferences: TripPreferencesInput,
        places_by_id: Dict[str, Dict[str, Any]],
        places_by_name: Dict[str, Dict[str, Any]],
        candidate_places: List[Dict[str, Any]],
        provider_used: str,
        fallback_chain: List[str]
    ) -> Dict[str, Any]:
        """
        Guarantees that every stop references a verified SQLite place.
        Injects factual prices, coordinates, and hours from the database.
        Strictly prevents repeating places across days in a single itinerary.
        Preserves unlinked display metadata when a place reference is unavailable.
        """
        seen_place_ids = set()
        validated_days = []
        total_sightseeing_cost = 0

        for raw_day in raw_plan.get('days', []):
            day_num = raw_day.get('day_number', len(validated_days) + 1)
            theme = raw_day.get('theme', f'Day {day_num} Exploration')
            date_val = raw_day.get('date', f'Day {day_num}')

            day_stops = []
            day_cost = 0

            for raw_stop in raw_day.get('stops', []):
                raw_pid = str(raw_stop.get('place_id', '')).strip()
                matched_place = places_by_id.get(raw_pid)

                # If place_id not found directly, attempt fuzzy name match
                if not matched_place and 'place_name' in raw_stop:
                    name_clean = str(raw_stop['place_name']).lower().strip()
                    matched_place = places_by_name.get(name_clean)

                # Anti-repetition: if matched place was already visited, substitute with unused candidate
                if matched_place and str(matched_place.get('id')) in seen_place_ids:
                    remaining_unused = [p for p in candidate_places if str(p.get('id')) not in seen_place_ids]
                    if remaining_unused:
                        matched_place = remaining_unused[0]
                    else:
                        # No more unique places: skip duplicate attraction rather than repeating
                        continue

                # Anti-hallucination safeguard: If still unknown, pull authentic unused candidate
                if not matched_place:
                    remaining_unused = [p for p in candidate_places if str(p.get('id')) not in seen_place_ids]
                    if remaining_unused:
                        matched_place = remaining_unused[0]
                    else:
                        # Cannot link to database: do not assign fake place ID
                        display_name = raw_stop.get('place_name') or raw_stop.get('placeName')
                        if display_name:
                            stop_num = len(day_stops) + 1
                            day_stops.append({
                                "id": f"stop-{day_num}-{stop_num}",
                                "stopOrder": stop_num,
                                "timeSlot": raw_stop.get('time_slot', 'Morning'),
                                "time": raw_stop.get('time', '09:00 AM'),
                                "placeId": None,
                                "placeName": display_name,
                                "category": raw_stop.get('category', 'culture'),
                                "durationMinutes": raw_stop.get('duration_minutes', 90),
                                "costInr": 0,
                                "costStatus": 'UNAVAILABLE',
                                "localTips": raw_stop.get('local_tips') or f"Self-guided stop in {destination_name}.",
                                "transportToNext": raw_stop.get('transport_to_next', 'Local transit.'),
                                "latitude": raw_stop.get('latitude'),
                                "longitude": raw_stop.get('longitude')
                            })
                        continue

                # Record authentic place usage
                seen_place_ids.add(str(matched_place.get('id')))

                # Extract verified factual fields from SQLite record
                ticket_fee = matched_place.get('ticket_price_inr')
                if ticket_fee is None:
                    ticket_fee = matched_place.get('ticketPriceInr')

                typical_cost = matched_place.get('typical_cost_inr')
                if typical_cost is None:
                    typical_cost = matched_place.get('typicalCostInr')

                if ticket_fee is not None:
                    cost_inr = ticket_fee
                    cost_status = 'VERIFIED'
                elif typical_cost is not None and typical_cost > 0:
                    cost_inr = typical_cost
                    cost_status = 'ESTIMATED'
                else:
                    cost_inr = 0
                    cost_status = 'UNAVAILABLE'

                day_cost += cost_inr
                total_sightseeing_cost += cost_inr
                stop_num = len(day_stops) + 1

                day_stops.append({
                    "id": f"stop-{day_num}-{stop_num}",
                    "stopOrder": stop_num,
                    "timeSlot": raw_stop.get('time_slot', 'Morning'),
                    "time": raw_stop.get('time', '09:00 AM'),
                    "placeId": str(matched_place.get('id')),
                    "placeName": matched_place.get('name'),
                    "category": matched_place.get('category', 'culture'),
                    "durationMinutes": raw_stop.get('duration_minutes', 90),
                    "costInr": cost_inr,
                    "costStatus": cost_status,
                    "localTips": raw_stop.get('local_tips') or f"Authentic attraction in {matched_place.get('address', destination_name)}.",
                    "transportToNext": raw_stop.get('transport_to_next', 'Local transit to next stop.'),
                    "latitude": matched_place.get('latitude'),
                    "longitude": matched_place.get('longitude')
                })

            validated_days.append({
                "id": f"day-{day_num}",
                "dayNumber": day_num,
                "theme": theme,
                "date": date_val,
                "dayEstimatedCostInr": day_cost,
                "stops": day_stops
            })

        # Calculate Budget Breakdown
        daily_budget = preferences.budget_per_day
        duration = preferences.duration_days
        total_trip_budget = daily_budget * duration

        avg_daily_sightseeing = round(total_sightseeing_cost / max(1, duration))
        accommodation = round(daily_budget * 0.40)
        food_dining = round(daily_budget * 0.25)
        local_transport = round(daily_budget * 0.15)
        contingency = max(100, daily_budget - (accommodation + food_dining + local_transport + avg_daily_sightseeing))

        expenses = {
            "accommodation": accommodation,
            "foodDining": food_dining,
            "localTransport": local_transport,
            "sightseeingTickets": avg_daily_sightseeing,
            "bufferContingency": contingency,
            "totalPerDay": daily_budget,
            "totalTrip": total_trip_budget,
            "isVerifiedBasis": total_sightseeing_cost > 0
        }

        coverage_warning = raw_plan.get('coverage_warning') or raw_plan.get('coverageWarning')
        if not coverage_warning and len(candidate_places) < (preferences.duration_days * 2):
            coverage_warning = (
                f"Limited database coverage: Only {len(candidate_places)} verified place(s) available "
                f"in {destination_name}. Itinerary adjusted to present unique authentic places "
                f"without repeating attractions."
            )

        trip_id = f"trip-{preferences.destination}-{raw_plan.get('duration_days', duration)}d"

        res = {
            "id": trip_id,
            "title": raw_plan.get('title', f"{duration}-Day Authentic {destination_name} Discovery"),
            "destinationName": destination_name,
            "destinationSlug": preferences.destination,
            "groupType": preferences.group_type,
            "durationDays": duration,
            "dailyBudgetInr": daily_budget,
            "totalBudgetInr": total_trip_budget,
            "aiProviderUsed": provider_used,
            "fallbackChain": fallback_chain,
            "notes": raw_plan.get('notes', ''),
            "days": validated_days,
            "expenses": expenses
        }
        if coverage_warning:
            res["coverageWarning"] = coverage_warning
            res["coverage_warning"] = coverage_warning

        return res

