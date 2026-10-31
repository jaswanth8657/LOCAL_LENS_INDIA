from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from destinations.models import Destination
from places.models import Place, DataProvenanceLog
from ai.deterministic_planner import DeterministicPlanner
from ai.manager import AIManager
from ai.schemas import TripPreferencesInput
from data_providers.overpass import OverpassProvider
from data_providers.services import PlaceIngestionService
from data_providers.validators import parse_ticket_fee, validate_coordinates, ValidationError


class Phase10BDataIngestionAndQualityTests(TestCase):
    """
    Test suite for Phase 10B:
    1. Data ingestion validation, deduplication, unknown fee handling, provenance.
    2. Itinerary repetition avoidance and coverage warnings.
    3. Profile partial update (PATCH) behavior.
    """

    def setUp(self):
        # Create test user
        self.user = User.objects.create_user(
            username="quality_tester",
            email="tester@example.com",
            password="Password123!"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        # Create test destination with limited places (e.g., 2 places)
        self.dest_limited = Destination.objects.create(
            slug="jaipur_test",
            name="Jaipur Test",
            state="Rajasthan",
            region="North",
            tagline="Pink City Test",
            description="Royal test city.",
            latitude=26.9124,
            longitude=75.7873,
            best_time_to_visit="Nov-Feb",
            average_daily_budget_inr=2500,
            verification_status="VERIFIED"
        )

        self.p1 = Place.objects.create(
            destination=self.dest_limited,
            name="Hawa Mahal",
            category="history",
            description="Palace of winds.",
            address="Hawa Mahal Rd, Jaipur",
            latitude=26.9239,
            longitude=75.8267,
            ticket_price_inr=50,
            verification_status="VERIFIED",
            source_record_id="osm:way:11111",
            data_source="OpenStreetMap Overpass API"
        )

        self.p2 = Place.objects.create(
            destination=self.dest_limited,
            name="Amer Fort",
            category="history",
            description="Hilltop fortress.",
            address="Amer, Jaipur",
            latitude=26.9855,
            longitude=75.8513,
            ticket_price_inr=100,
            verification_status="VERIFIED",
            source_record_id="osm:way:22222",
            data_source="OpenStreetMap Overpass API"
        )

    # --- Data Ingestion & Validation Tests ---

    def test_fee_parser_leaves_missing_fees_unknown(self):
        # Missing fee tag -> UNAVAILABLE with None (NOT 0)
        fee_none, status_none = parse_ticket_fee({})
        self.assertIsNone(fee_none)
        self.assertEqual(status_none, 'UNAVAILABLE')

        # fee=yes without price -> ESTIMATED with None (NOT 0)
        fee_yes, status_yes = parse_ticket_fee({'fee': 'yes'})
        self.assertIsNone(fee_yes)
        self.assertEqual(status_yes, 'ESTIMATED')

        # fee=no -> 0 with VERIFIED
        fee_no, status_no = parse_ticket_fee({'fee': 'no'})
        self.assertEqual(fee_no, 0)
        self.assertEqual(status_no, 'VERIFIED')

        # numeric charge -> numeric with VERIFIED
        fee_paid, status_paid = parse_ticket_fee({'charge': '₹70'})
        self.assertEqual(fee_paid, 70)
        self.assertEqual(status_paid, 'VERIFIED')

    def test_coordinate_validator_rejects_out_of_bounds(self):
        # Out-of-bounds coordinates (e.g. in Europe or negative bounds) must raise ValidationError
        with self.assertRaises(ValidationError):
            validate_coordinates(51.5074, -0.1278, enforce_india_bounds=True)  # London

        # Valid coordinates in India must pass
        lat, lon = validate_coordinates(26.9124, 75.7873, enforce_india_bounds=True)
        self.assertEqual(lat, 26.9124)
        self.assertEqual(lon, 75.7873)

    def test_ingestion_duplicate_prevention(self):
        # Simulate POI ingestion with same record_id and matching coordinates
        service = PlaceIngestionService()
        stats = {
            'destination': self.dest_limited.slug,
            'retrieved': 1,
            'created': 0,
            'updated': 0,
            'duplicates_skipped': 0,
            'rejected': 0,
            'errors': []
        }
        existing_places = list(Place.objects.filter(destination=self.dest_limited))
        initial_count = len(existing_places)

        duplicate_poi = {
            'source_record_id': 'osm:way:11111',  # Matches p1
            'name': 'Hawa Mahal',
            'category': 'history',
            'subcategory': 'Palace',
            'description': 'Updated description',
            'address': 'Hawa Mahal Rd, Jaipur',
            'latitude': 26.9239,
            'longitude': 75.8267,
            'price_tier': 'Budget',
            'ticket_price_inr': 50,
            'opening_hours': '9:00 AM - 5:00 PM',
            'data_source': 'OpenStreetMap Overpass API',
            'source_url': 'https://www.openstreetmap.org/way/11111',
            'verification_status': 'VERIFIED',
            'fee_status': 'VERIFIED',
            'hours_status': 'VERIFIED'
        }

        service._process_single_poi(duplicate_poi, self.dest_limited, existing_places, stats, dry_run=False)

        # Must update existing, NOT create duplicate
        self.assertEqual(stats['updated'], 1)
        self.assertEqual(stats['created'], 0)
        self.assertEqual(Place.objects.filter(destination=self.dest_limited).count(), initial_count)

    # --- Itinerary Generation & Repetition Tests ---

    def test_deterministic_planner_does_not_repeat_places_and_emits_coverage_warning(self):
        planner = DeterministicPlanner()
        candidates = [
            {'id': self.p1.id, 'name': self.p1.name, 'category': self.p1.category, 'address': self.p1.address},
            {'id': self.p2.id, 'name': self.p2.name, 'category': self.p2.category, 'address': self.p2.address},
        ]

        # Request 3 days (would require 9 stops at 3 stops/day, but only 2 unique places exist)
        plan = planner.generate_plan(
            destination_name="Jaipur Test",
            duration_days=3,
            daily_budget_inr=2500,
            group_type="Solo",
            candidate_places=candidates,
            pace="Moderate"
        )

        all_stop_place_ids = []
        for day in plan['days']:
            for stop in day['stops']:
                all_stop_place_ids.append(stop['place_id'])

        # Unique place check: no place ID should appear more than once!
        self.assertEqual(len(all_stop_place_ids), len(set(all_stop_place_ids)))
        self.assertLessEqual(len(all_stop_place_ids), len(candidates))

        # Must provide clear coverage warning
        self.assertIn("coverageWarning", plan)
        self.assertIn("Limited database coverage", plan["coverageWarning"])

    def test_ai_manager_grounding_substitutes_duplicates(self):
        manager = AIManager()
        candidates = [
            {'id': self.p1.id, 'name': self.p1.name, 'category': self.p1.category, 'ticket_price_inr': 50},
            {'id': self.p2.id, 'name': self.p2.name, 'category': self.p2.category, 'ticket_price_inr': 100},
        ]
        places_by_id = {str(c['id']): c for c in candidates}
        places_by_name = {c['name'].lower(): c for c in candidates}

        # Raw AI output deliberately repeats Hawa Mahal (p1.id) across day 1 and day 2
        raw_plan = {
            "title": "Repetitive AI Plan",
            "duration_days": 2,
            "days": [
                {
                    "day_number": 1,
                    "theme": "Day 1",
                    "stops": [
                        {"place_id": str(self.p1.id), "place_name": "Hawa Mahal", "time_slot": "Morning"}
                    ]
                },
                {
                    "day_number": 2,
                    "theme": "Day 2",
                    "stops": [
                        # Duplicate place!
                        {"place_id": str(self.p1.id), "place_name": "Hawa Mahal", "time_slot": "Morning"}
                    ]
                }
            ]
        }

        prefs = TripPreferencesInput(
            destination="jaipur_test",
            budget_per_day=2500,
            group_type="Solo",
            duration_days=2
        )

        grounded = manager._ground_and_validate_itinerary(
            raw_plan=raw_plan,
            destination_name="Jaipur Test",
            preferences=prefs,
            places_by_id=places_by_id,
            places_by_name=places_by_name,
            candidate_places=candidates,
            provider_used="TEST_PROVIDER",
            fallback_chain=[]
        )

        all_pids = [
            stop['placeId']
            for day in grounded['days']
            for stop in day['stops']
            if stop['placeId'] is not None
        ]

        # Duplicate must be substituted with the unused candidate (p2)
        self.assertEqual(len(all_pids), 2)
        self.assertEqual(set(all_pids), {str(self.p1.id), str(self.p2.id)})

    def test_ai_manager_handles_unknown_place_without_fake_id(self):
        manager = AIManager()
        candidates = [
            {'id': self.p1.id, 'name': self.p1.name, 'category': self.p1.category, 'ticket_price_inr': 50},
        ]
        places_by_id = {str(c['id']): c for c in candidates}
        places_by_name = {c['name'].lower(): c for c in candidates}

        # Raw AI plan includes one real place and one completely fabricated attraction name
        raw_plan = {
            "title": "Plan with Fabricated Place",
            "duration_days": 1,
            "days": [
                {
                    "day_number": 1,
                    "theme": "Day 1",
                    "stops": [
                        {"place_id": str(self.p1.id), "place_name": "Hawa Mahal", "time_slot": "Morning"},
                        {"place_id": "nonexistent-99", "place_name": "Invented Crystal Palace", "time_slot": "Afternoon"}
                    ]
                }
            ]
        }

        prefs = TripPreferencesInput(
            destination="jaipur_test",
            budget_per_day=2500,
            group_type="Solo",
            duration_days=1
        )

        grounded = manager._ground_and_validate_itinerary(
            raw_plan=raw_plan,
            destination_name="Jaipur Test",
            preferences=prefs,
            places_by_id=places_by_id,
            places_by_name=places_by_name,
            candidate_places=candidates,
            provider_used="TEST_PROVIDER",
            fallback_chain=[]
        )

        stops = grounded['days'][0]['stops']
        self.assertEqual(len(stops), 2)
        # First stop is linked to p1
        self.assertEqual(stops[0]['placeId'], str(self.p1.id))
        # Second stop must have placeId=None and costStatus='UNAVAILABLE' (never a fake ID)
        self.assertIsNone(stops[1]['placeId'])
        self.assertEqual(stops[1]['placeName'], "Invented Crystal Palace")
        self.assertEqual(stops[1]['costStatus'], 'UNAVAILABLE')

    # --- Profile PATCH Tests ---

    def test_profile_patch_modifies_only_specified_fields(self):
        profile = self.user.profile
        profile.name = "Original Name"
        profile.budget_per_day = 3500
        profile.group_type = "Family"
        profile.group_size = 5
        profile.theme_preference = "dark"
        profile.interests = ["history", "culture"]
        profile.save()

        # Send PATCH modifying only budget_per_day
        res = self.client.patch('/api/v1/accounts/profile/', {'budget_per_day': 5000}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()

        # Modified
        self.assertEqual(data['budget_per_day'], 5000)
        # Unchanged
        self.assertEqual(data['name'], "Original Name")
        self.assertEqual(data['group_type'], "Family")
        self.assertEqual(data['group_size'], 5)
        self.assertEqual(data['theme_preference'], "dark")
        self.assertEqual(data['interests'], ["history", "culture"])

