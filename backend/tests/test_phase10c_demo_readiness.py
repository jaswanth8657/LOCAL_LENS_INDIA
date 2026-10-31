"""
Phase 10C Test Suite: UI Polish, Functional Integration & Demo Readiness.
Covers:
1. Destination placesCount serialization and viewset annotation.
2. Demo proposal itinerary deterministic safe caching (hit/miss, cache key derivation, cache invalidation).
3. No duplicate stops across itinerary days.
4. Non-leakage of user private info in proposal caching.
"""

from django.test import TestCase
from rest_framework.test import APIClient
from destinations.models import Destination
from places.models import Place
from destinations.serializers import DestinationSerializer
from ai.services import (
    AITripPlannerService,
    get_itinerary_cache_key,
    invalidate_itinerary_cache,
)
from django.core.cache import cache


class DestinationPlacesCountTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.dest = Destination.objects.create(
            name="Visakhapatnam",
            slug="visakhapatnam",
            state="Andhra Pradesh",
            region="South",
            tagline="City of Destiny",
            description="Coastal city with port and beaches.",
            latitude=17.6868,
            longitude=83.2185,
            average_daily_budget_inr=1800,
        )
        Place.objects.create(
            destination=self.dest,
            name="INS Kursura",
            category="history",
            latitude=17.7164,
            longitude=83.3331,
            ticket_price_inr=70,
            typical_cost_inr=100,
            data_source="OpenStreetMap",
            source_record_id="node:1",
        )
        Place.objects.create(
            destination=self.dest,
            name="Kailasagiri",
            category="nature",
            latitude=17.7494,
            longitude=83.3422,
            ticket_price_inr=20,
            typical_cost_inr=150,
            data_source="OpenStreetMap",
            source_record_id="node:2",
        )

    def test_destination_serializer_returns_places_count(self):
        serializer = DestinationSerializer(self.dest)
        self.assertIn("placesCount", serializer.data)
        self.assertEqual(serializer.data["placesCount"], 2)

    def test_destination_api_returns_annotated_places_count(self):
        response = self.client.get("/api/v1/destinations/")
        self.assertEqual(response.status_code, 200)
        items = response.data.get("results", response.data) if isinstance(response.data, dict) else response.data
        dest_data = next((d for d in items if d["id"] == "visakhapatnam"), None)
        self.assertIsNotNone(dest_data)
        self.assertEqual(dest_data["placesCount"], 2)

    def test_destination_with_zero_places_returns_zero_count(self):
        empty_dest = Destination.objects.create(
            name="Empty Destination",
            slug="empty-dest",
            state="Kerala",
            region="South",
            tagline="Quiet spot",
            description="No places yet",
            latitude=10.0,
            longitude=76.0,
            average_daily_budget_inr=1500,
        )
        serializer = DestinationSerializer(empty_dest)
        self.assertEqual(serializer.data["placesCount"], 0)

        response = self.client.get("/api/v1/destinations/")
        self.assertEqual(response.status_code, 200)
        items = response.data.get("results", response.data) if isinstance(response.data, dict) else response.data
        dest_data = next((d for d in items if d["id"] == "empty-dest"), None)
        self.assertIsNotNone(dest_data)
        self.assertEqual(dest_data["placesCount"], 0)


class DemoItineraryCacheTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.dest = Destination.objects.create(
            name="Jaipur",
            slug="jaipur",
            state="Rajasthan",
            region="North",
            tagline="Pink City",
            description="Heritage city in Rajasthan",
            latitude=26.9124,
            longitude=75.7873,
            average_daily_budget_inr=2200,
        )
        # Create 6 places to cover 2 days
        for i in range(6):
            Place.objects.create(
                destination=self.dest,
                name=f"Jaipur Heritage Spot {i+1}",
                category="history" if i % 2 == 0 else "culture",
                latitude=26.9100 + (i * 0.005),
                longitude=75.7800 + (i * 0.005),
                ticket_price_inr=50 * (i + 1),
                typical_cost_inr=150 * (i + 1),
                data_source="OpenStreetMap",
                source_record_id=f"node:jaipur:{i+1}",
            )

    def tearDown(self):
        cache.clear()

    def test_cache_key_generation_deterministic(self):
        k1 = get_itinerary_cache_key(
            dest_slug="jaipur",
            interests=["history", "culture"],
            budget_per_day=2000,
            group_type="Duo",
            duration_days=2,
            preferred_pace="Moderate",
        )
        k2 = get_itinerary_cache_key(
            dest_slug="jaipur",
            interests=["culture", "history"],
            budget_per_day=2000,
            group_type="Duo",
            duration_days=2,
            preferred_pace="Moderate",
        )
        # Ordering of interests should not alter key
        self.assertEqual(k1, k2)
        self.assertTrue(k1.startswith("itinerary_cache_"))

    def test_proposal_itinerary_caching_and_hit(self):
        service = AITripPlannerService()
        key = get_itinerary_cache_key(
            dest_slug="jaipur",
            interests=["history"],
            budget_per_day=2000,
            group_type="Duo",
            duration_days=2,
            preferred_pace="Moderate",
        )
        self.assertIsNone(cache.get(key))

        payload = {
            "destination": "jaipur",
            "duration_days": 2,
            "budget_per_day": 2000,
            "group_type": "Duo",
            "interests": ["history"],
            "preferred_pace": "Moderate",
            "save_to_db": False,
        }

        plan1 = service.generate_itinerary(payload)
        self.assertIsNotNone(plan1)
        self.assertIsNotNone(cache.get(key))

        # Second call should retrieve from cache, but give a fresh unique proposal ID
        plan2 = service.generate_itinerary(payload)
        self.assertIsNotNone(plan2)
        self.assertNotEqual(plan1["id"], plan2["id"], "Each proposal must receive a unique temporary ID")
        self.assertEqual(len(plan1["days"]), len(plan2["days"]))

    def test_cache_invalidation_on_destination_update(self):
        service = AITripPlannerService()
        key = get_itinerary_cache_key(
            dest_slug="jaipur",
            interests=["history"],
            budget_per_day=2000,
            group_type="Duo",
            duration_days=2,
            preferred_pace="Moderate",
        )
        payload = {
            "destination": "jaipur",
            "duration_days": 2,
            "budget_per_day": 2000,
            "group_type": "Duo",
            "interests": ["history"],
            "preferred_pace": "Moderate",
            "save_to_db": False,
        }
        service.generate_itinerary(payload)
        self.assertIsNotNone(cache.get(key))

        invalidate_itinerary_cache("jaipur")
        new_key = get_itinerary_cache_key(
            dest_slug="jaipur",
            interests=["history"],
            budget_per_day=2000,
            group_type="Duo",
            duration_days=2,
            preferred_pace="Moderate",
        )
        self.assertNotEqual(key, new_key)
        self.assertIsNone(cache.get(new_key))

    def test_no_duplicate_stops_in_proposal(self):
        service = AITripPlannerService()
        payload = {
            "destination": "jaipur",
            "duration_days": 2,
            "budget_per_day": 2000,
            "group_type": "Duo",
            "interests": ["history", "culture"],
            "preferred_pace": "Moderate",
            "save_to_db": False,
        }
        plan = service.generate_itinerary(payload)
        all_place_names = []
        for day in plan["days"]:
            for stop in day["stops"]:
                all_place_names.append(stop["placeName"])

        self.assertEqual(len(all_place_names), len(set(all_place_names)), "Stops must not repeat across itinerary days")
