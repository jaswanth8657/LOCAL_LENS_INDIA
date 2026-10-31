import uuid
import copy
import hashlib
from typing import Dict, Any, List, Optional
from django.core.cache import cache
from destinations.models import Destination
from places.models import Place
from recommendations.services import RecommendationService
from trips.models import Itinerary, ItineraryDay, ItineraryStop, ExpenseBreakdown
from .schemas import TripPreferencesInput
from .manager import AIManager

ITINERARY_CACHE_TTL = 86400  # 24 hours

def get_itinerary_cache_key(
    dest_slug: str,
    interests: List[str],
    budget_per_day: int,
    group_type: str,
    duration_days: int,
    preferred_pace: str = 'Moderate'
) -> str:
    """Builds a deterministic SHA256 cache key from verified travel constraints."""
    version = cache.get(f"itin_version:{dest_slug}", 1)
    sorted_interests = sorted(list(set(i.lower().strip() for i in interests)))
    pace = (preferred_pace or 'Moderate').capitalize()
    key_payload = (
        f"dest:{dest_slug}|v:{version}|days:{duration_days}|"
        f"budget:{budget_per_day}|group:{group_type}|pace:{pace}|"
        f"interests:{','.join(sorted_interests)}"
    )
    digest = hashlib.sha256(key_payload.encode('utf-8')).hexdigest()
    return f"itinerary_cache_{digest}"

def invalidate_itinerary_cache(destination_slug: Optional[str] = None) -> None:
    """Safely increments the cache version for a destination, invalidating stale cached itineraries."""
    if destination_slug:
        key = f"itin_version:{destination_slug}"
        current = cache.get(key, 1)
        cache.set(key, current + 1, timeout=None)
    else:
        for dest in Destination.objects.all():
            key = f"itin_version:{dest.slug}"
            current = cache.get(key, 1)
            cache.set(key, current + 1, timeout=None)

class AITripPlannerService:
    """
    High-level service coordinating candidate extraction via Phase 4 ML recommendations,
    3-tier AI generation hierarchy (Gemini -> Ollama -> Deterministic),
    and optional database persistence to trips models.
    """

    def __init__(self):
        self.ai_manager = AIManager()
        self.recs_service = RecommendationService()

    def generate_itinerary(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        # Validate input schema
        preferences = TripPreferencesInput.model_validate(input_data)

        # 1. Look up Destination
        dest = Destination.objects.filter(slug=preferences.destination).first()
        if not dest:
            raise LookupError(f"Destination '{preferences.destination}' was not found in the database.")

        # Check demo itinerary cache if not persisting immediately to user account
        cache_key = None
        if not preferences.save_to_db:
            cache_key = get_itinerary_cache_key(
                dest_slug=dest.slug,
                interests=preferences.interests,
                budget_per_day=preferences.budget_per_day,
                group_type=preferences.group_type,
                duration_days=preferences.duration_days,
                preferred_pace=getattr(preferences, 'preferred_pace', '')
            )
            cached_result = cache.get(cache_key)
            if cached_result:
                fresh_copy = copy.deepcopy(cached_result)
                fresh_copy['id'] = f"proposal-{dest.slug}-{uuid.uuid4().hex[:8]}"
                return fresh_copy

        # 2. Retrieve Candidate Places via Phase 4 ML Recommendation Engine
        # This provides places already ranked by TF-IDF, distance, and budget compatibility
        recs_result = self.recs_service.get_recommendations(
            destination_slug=dest.slug,
            interests=preferences.interests,
            budget_per_day=preferences.budget_per_day,
            group_type=preferences.group_type,
            duration_days=preferences.duration_days,
            user_lat=preferences.latitude,
            user_lon=preferences.longitude,
            limit=30,
            sort_by='match'
        )

        candidates = recs_result.get('recommendations', [])

        # If recommendations returned empty, fetch raw places from destination
        if not candidates:
            places_qs = Place.objects.filter(destination=dest)
            for p in places_qs:
                candidates.append({
                    'id': p.id,
                    'name': p.name,
                    'category': p.category,
                    'subcategory': p.subcategory,
                    'description': p.description,
                    'address': p.address,
                    'latitude': p.latitude,
                    'longitude': p.longitude,
                    'ticket_price_inr': p.ticket_price_inr,
                    'typical_cost_inr': p.typical_cost_inr,
                    'opening_hours': p.opening_hours,
                    'verification_status': p.verification_status,
                })

        if not candidates:
            raise ValueError(f"No places found in destination '{dest.name}'. Please import places first.")

        # 3. Call AI Manager for Multi-Tier Generation
        itinerary_data = self.ai_manager.plan_itinerary(
            preferences=preferences,
            destination_name=dest.name,
            candidate_places=candidates
        )

        # 4. Optional Persistence to trips models
        if preferences.save_to_db:
            saved_itinerary = self._persist_itinerary(itinerary_data, dest)
            itinerary_data['id'] = saved_itinerary.id
        elif cache_key:
            cache.set(cache_key, itinerary_data, timeout=ITINERARY_CACHE_TTL)

        return itinerary_data

    def _persist_itinerary(self, data: Dict[str, Any], destination: Destination) -> Itinerary:
        """Saves generated plan to SQLite database using trips models."""
        trip_uuid = f"trip-{destination.slug}-{uuid.uuid4().hex[:8]}"

        itinerary = Itinerary.objects.create(
            id=trip_uuid,
            title=data.get('title', f"Authentic {destination.name} Trip"),
            destination_name=destination.name,
            destination=destination,
            group_type=data.get('groupType', 'Duo'),
            duration_days=data.get('durationDays', 3),
            daily_budget_inr=data.get('dailyBudgetInr', 2000),
            total_budget_inr=data.get('totalBudgetInr', 6000),
            ai_provider_used=data.get('aiProviderUsed', 'DETERMINISTIC')
        )

        # Save Days and Stops
        for day_dict in data.get('days', []):
            day_obj = ItineraryDay.objects.create(
                itinerary=itinerary,
                day_number=day_dict.get('dayNumber', 1),
                theme=day_dict.get('theme', 'Exploration'),
                date=day_dict.get('date', ''),
                day_estimated_cost_inr=day_dict.get('dayEstimatedCostInr', 0)
            )

            for stop_dict in day_dict.get('stops', []):
                place_obj = None
                raw_pid = stop_dict.get('placeId')
                if raw_pid is not None and str(raw_pid).strip().isdigit():
                    try:
                        place_obj = Place.objects.filter(id=int(str(raw_pid).strip())).first()
                    except (ValueError, TypeError, OverflowError):
                        place_obj = None

                ItineraryStop.objects.create(
                    day=day_obj,
                    stop_order=stop_dict.get('stopOrder', 1),
                    time_slot=stop_dict.get('timeSlot', 'Morning'),
                    time=stop_dict.get('time', '09:00 AM'),
                    place=place_obj,
                    place_name=stop_dict.get('placeName', ''),
                    category=stop_dict.get('category', 'culture'),
                    duration_minutes=stop_dict.get('durationMinutes', 90),
                    cost_inr=stop_dict.get('costInr', 0),
                    cost_status=stop_dict.get('costStatus', 'VERIFIED'),
                    local_tips=stop_dict.get('localTips', ''),
                    transport_to_next=stop_dict.get('transportToNext', ''),
                    latitude=stop_dict.get('latitude'),
                    longitude=stop_dict.get('longitude')
                )

        # Save Expense Breakdown
        exp_data = data.get('expenses', {})
        ExpenseBreakdown.objects.create(
            itinerary=itinerary,
            accommodation=exp_data.get('accommodation', 800),
            food_dining=exp_data.get('foodDining', 500),
            local_transport=exp_data.get('localTransport', 300),
            sightseeing_tickets=exp_data.get('sightseeingTickets', 200),
            buffer_contingency=exp_data.get('bufferContingency', 200),
            total_per_day=exp_data.get('totalPerDay', 2000),
            total_trip=exp_data.get('totalTrip', 6000),
            is_verified_basis=exp_data.get('isVerifiedBasis', True)
        )

        return itinerary

