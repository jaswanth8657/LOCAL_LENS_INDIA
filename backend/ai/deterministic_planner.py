from typing import List, Dict, Any, Optional
import math

class DeterministicPlanner:
    """
    Tertiary Fallback: Guaranteed non-AI itinerary planner.
    Uses Phase 4 ML-ranked verified places, category distribution,
    and realistic pacing without requiring any external LLM service.
    Guarantees zero repeat attractions across days unless explicitly justified.
    """

    def generate_plan(
        self,
        destination_name: str,
        duration_days: int,
        daily_budget_inr: int,
        group_type: str,
        candidate_places: List[Dict[str, Any]],
        interests: Optional[List[str]] = None,
        pace: str = "Moderate",
        start_date: str = ""
    ) -> Dict[str, Any]:
        if not candidate_places:
            raise ValueError(f"No candidate places available in database for destination '{destination_name}'.")

        total_candidates = len(candidate_places)

        # Desired stops per day based on pace
        desired_stops_per_day = 3
        if pace.lower() == 'relaxed':
            desired_stops_per_day = 2
        elif pace.lower() == 'packed':
            desired_stops_per_day = 4

        time_slots = ['Morning', 'Afternoon', 'Evening', 'Night']
        slot_times = {
            'Morning': '09:00 AM',
            'Afternoon': '01:30 PM',
            'Evening': '05:30 PM',
            'Night': '08:00 PM'
        }

        # Track places used in this itinerary to strictly prevent duplicates
        used_ids = set()
        available_pool = list(candidate_places)

        # Determine if we have limited coverage for the requested days/stops
        total_desired_stops = duration_days * desired_stops_per_day
        has_limited_coverage = total_candidates < total_desired_stops
        coverage_warning = ""
        if has_limited_coverage:
            coverage_warning = (
                f"Limited database coverage: Only {total_candidates} verified place(s) available "
                f"in {destination_name}. Itinerary adjusted to present unique authentic places "
                f"without repeating attractions."
            )

        days_plan = []
        for day_num in range(1, duration_days + 1):
            if day_num == 1:
                theme = f"Orientation & Historic Highlights of {destination_name}"
            elif day_num == 2:
                theme = "Scenic Vistas, Cultural Heritage & Local Markets"
            elif day_num == 3:
                theme = "Architecture, Local Cuisine & Cultural Trail"
            else:
                theme = f"Deep Cultural Immersion & Scenic Trails (Day {day_num})"

            day_stops = []

            for slot_idx in range(desired_stops_per_day):
                slot_name = time_slots[slot_idx]
                selected_place = None

                # Find unused place from candidate pool
                for candidate in available_pool:
                    cid = str(candidate.get('id'))
                    if cid not in used_ids:
                        selected_place = candidate
                        used_ids.add(cid)
                        break

                # If all unique places have been visited, do NOT repeat or cycle!
                if not selected_place:
                    break

                place_id = str(selected_place.get('id'))
                cat = selected_place.get('category', 'culture')

                tip = f"Verified attraction in {selected_place.get('address', destination_name)}."
                if cat == 'beaches':
                    tip = "Ideal during sunrise or late afternoon for coastal breezes and photo opportunities."
                elif cat in ('history', 'culture'):
                    tip = "Carry water and modest attire for heritage grounds. Guides are available near the entrance."
                elif cat == 'food':
                    tip = "Sample regional thali and seasonal house specialties prepared by local vendors."
                elif cat == 'nature':
                    tip = "Good walking shoes recommended. Serene morning atmosphere."

                day_stops.append({
                    "place_id": place_id,
                    "place_name": selected_place.get('name'),
                    "category": cat,
                    "time_slot": slot_name,
                    "time": slot_times.get(slot_name, '10:00 AM'),
                    "duration_minutes": 90 if slot_name != 'Afternoon' else 120,
                    "local_tips": tip,
                    "transport_to_next": "15-20 mins local auto-rickshaw or taxi to next stop."
                })

            # If all places were already visited on previous days, note leisure exploration
            if not day_stops and day_num > 1:
                theme = f"Local Leisure & Neighborhood Exploration in {destination_name}"

            days_plan.append({
                "day_number": day_num,
                "theme": theme,
                "date": f"Day {day_num}" if not start_date else f"{start_date} + {day_num-1}d",
                "stops": day_stops
            })

        result = {
            "title": f"{duration_days}-Day Verified {destination_name} Itinerary (Deterministic Sequence)",
            "destination_name": destination_name,
            "duration_days": duration_days,
            "days": days_plan,
            "notes": "Generated by the deterministic grounding engine using verified database places and Phase 4 spatial rankings."
        }
        if coverage_warning:
            result["coverage_warning"] = coverage_warning
            result["coverageWarning"] = coverage_warning

        return result
