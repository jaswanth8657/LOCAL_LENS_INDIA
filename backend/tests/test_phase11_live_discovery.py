from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from destinations.models import Destination
from places.models import Place, DataProvenanceLog
from places.search_service import LivePlaceSearchService
from data_providers.base import ProviderTimeoutError, ProviderError

class Phase11LiveDiscoveryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.dest = Destination.objects.create(
            name="Visakhapatnam",
            slug="visakhapatnam",
            state="Andhra Pradesh",
            region="South",
            latitude=17.6868,
            longitude=83.2185,
            tagline="The Jewel of the East Coast",
            description="Coastal port city known for pristine beaches and naval history."
        )
        self.place1 = Place.objects.create(
            destination=self.dest,
            name="RK Beach Promenade",
            category="beaches",
            subcategory="beach",
            latitude=17.7123,
            longitude=83.3194,
            address="Beach Road, Visakhapatnam",
            description="Famous urban beach promenade along the Bay of Bengal.",
            ticket_price_inr=0,
            verification_status="OFFICIALLY_VERIFIED",
            match_score=95
        )
        self.place2 = Place.objects.create(
            destination=self.dest,
            name="INS Kursura Submarine Museum",
            category="culture",
            subcategory="museum",
            latitude=17.7175,
            longitude=83.3312,
            address="RK Beach Road, Visakhapatnam",
            description="Decommissioned Soviet-built Kalvari-class submarine museum.",
            ticket_price_inr=40,
            verification_status="OFFICIALLY_VERIFIED",
            match_score=92
        )

    def test_live_search_endpoint_returns_database_records_with_provenance(self):
        url = reverse('places-live-search')
        response = self.client.get(url, {'destination': 'visakhapatnam', 'live': 'false'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        self.assertIn('results', data)
        self.assertEqual(data['database_count'], 2)
        self.assertEqual(data['live_external_count'], 0)

        first = data['results'][0]
        self.assertEqual(first['result_type'], 'database')
        self.assertTrue(first['is_persisted'])
        self.assertIn(first['provenance_label'], ['Existing database record', 'Imported and persisted record'])

    def test_live_search_does_not_pollute_database(self):
        initial_place_count = Place.objects.count()

        mock_overpass = MagicMock()
        mock_overpass.build_query.return_value = "[out:json];"
        mock_overpass.fetch.return_value = {"elements": []}
        mock_overpass.parse.return_value = [
            {
                "name": "Kailasagiri Hilltop Park",
                "category": "nature",
                "subcategory": "park",
                "latitude": 17.7490,
                "longitude": 83.3420,
                "address": "Kailasagiri, Visakhapatnam",
                "description": "Hilltop park overlooking the city and sea.",
                "ticket_price_inr": 20,
                "typical_cost_inr": None,
                "opening_hours": "06:00-20:00",
                "source_record_id": "osm_node_123456",
                "osm_type": "node",
                "osm_id": "123456"
            }
        ]

        service = LivePlaceSearchService(overpass=mock_overpass)
        search_result = service.search_places(
            q="Park",
            destination_slug="visakhapatnam",
            live=True
        )

        # Confirm external POI was retrieved
        self.assertEqual(search_result['live_external_count'], 1)
        ext_result = [r for r in search_result['results'] if r['result_type'] == 'live_external'][0]
        self.assertEqual(ext_result['provenance_label'], "Live external search result")
        self.assertFalse(ext_result['is_persisted'])

        # CRITICAL SAFEGUARD: Verify SQLite place count did NOT change
        self.assertEqual(Place.objects.count(), initial_place_count)

    def test_deduplication_filters_out_existing_places(self):
        mock_overpass = MagicMock()
        mock_overpass.build_query.return_value = "[out:json];"
        mock_overpass.fetch.return_value = {"elements": []}
        # Returns the exact same place already in DB
        mock_overpass.parse.return_value = [
            {
                "name": "RK Beach Promenade",
                "category": "beaches",
                "latitude": 17.7123,
                "longitude": 83.3194,
                "source_record_id": "osm_node_99999"
            }
        ]

        mock_nominatim = MagicMock()
        mock_nominatim.fetch.return_value = []
        service = LivePlaceSearchService(overpass=mock_overpass, nominatim=mock_nominatim)
        search_result = service.search_places(destination_slug="visakhapatnam", live=True)

        # Duplicate should NOT be added as external
        self.assertEqual(search_result['live_external_count'], 0)
        self.assertEqual(search_result['database_count'], 2)

    def test_import_external_place_persists_to_sqlite_with_provenance_log(self):
        url = reverse('places-import-external')
        payload = {
            "name": "Yarada Beach Spot",
            "destination_slug": "visakhapatnam",
            "category": "beaches",
            "latitude": 17.6534,
            "longitude": 83.2678,
            "address": "Yarada, Visakhapatnam",
            "description": "Secluded beach surrounded by hills on three sides.",
            "source_record_id": "osm_node_777888",
            "osm_type": "node",
            "osm_id": "777888",
            "ticket_price_inr": 0
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()

        self.assertEqual(data['result_type'], 'database')
        self.assertTrue(data['is_persisted'])
        self.assertEqual(data['provenance_label'], 'Imported and persisted record')

        # Check in SQLite
        saved = Place.objects.get(name="Yarada Beach Spot")
        self.assertEqual(saved.verification_status, "ESTIMATED")
        self.assertEqual(saved.destination.slug, "visakhapatnam")

        # Verify DataProvenanceLog record was created
        log = DataProvenanceLog.objects.filter(place=saved).first()
        self.assertIsNotNone(log)
        self.assertIn("Live Discovery", log.source_name)

    def test_ai_status_endpoint_returns_safe_health_status(self):
        url = reverse('ai:ai-status')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        self.assertIn('gemini', data)
        self.assertIn('ollama', data)
        self.assertIn('deterministic', data)

        # Verify no secret credentials or API keys leaked
        self.assertNotIn('api_key', str(data).lower())
        self.assertNotIn('secret', str(data).lower())
        self.assertTrue(data['deterministic']['available'])

    def test_unseeded_city_bengaluru_reaches_external_discovery_path(self):
        mock_overpass = MagicMock()
        mock_overpass.build_query.return_value = "[out:json];"
        mock_overpass.fetch.return_value = {"elements": []}
        mock_overpass.parse.return_value = []

        mock_nominatim = MagicMock()
        mock_nominatim.geocode_destination.return_value = {
            "name": "Bengaluru",
            "display_name": "Bengaluru, Bangalore Urban, Karnataka, India",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "state": "Karnataka",
            "osm_id": "79534",
            "osm_type": "relation"
        }
        mock_nominatim.fetch.return_value = [
            {
                "name": "Lalbagh Botanical Garden",
                "lat": "12.9507",
                "lon": "77.5848",
                "type": "garden",
                "display_name": "Lalbagh Botanical Garden, Mavalli, Bengaluru, Karnataka, 560004, India",
                "osm_type": "way",
                "osm_id": "24680"
            }
        ]

        service = LivePlaceSearchService(overpass=mock_overpass, nominatim=mock_nominatim)
        search_result = service.search_places(
            q="Lalbagh",
            destination_slug="bengaluru",
            live=True
        )

        self.assertEqual(search_result["destination"], "bengaluru")
        self.assertEqual(search_result["live_external_count"], 1)
        self.assertEqual(search_result["database_count"], 0)

        item = search_result["results"][0]
        self.assertEqual(item["name"], "Lalbagh Botanical Garden")
        self.assertEqual(item["destination_slug"], "bengaluru")
        self.assertEqual(item["destination_name"], "Bengaluru")
        self.assertEqual(item["result_type"], "live_external")
        self.assertEqual(item["provenance_label"], "Live external search result")
        self.assertFalse(item["is_persisted"])
        self.assertIsNone(item["rating"])
        self.assertEqual(item["review_count"], 0)
        self.assertIsNone(item["ticket_price_inr"])
        self.assertEqual(item["source_record_id"], "nominatim_way_24680")

        # Confirm Nominatim geocoding was invoked for unseeded city
        mock_nominatim.geocode_destination.assert_called()

    def test_unseeded_city_kochi_and_chandigarh_live_searches(self):
        # 1. Kochi test
        mock_overpass_kochi = MagicMock()
        mock_overpass_kochi.build_query.return_value = "[out:json];"
        mock_overpass_kochi.fetch.return_value = {"elements": []}
        mock_overpass_kochi.parse.return_value = []

        mock_nominatim_kochi = MagicMock()
        mock_nominatim_kochi.geocode_destination.return_value = {
            "name": "Kochi",
            "display_name": "Kochi, Ernakulam, Kerala, India",
            "latitude": 9.9312,
            "longitude": 76.2673,
            "state": "Kerala",
            "osm_id": "12345",
            "osm_type": "relation"
        }
        mock_nominatim_kochi.fetch.return_value = [
            {
                "name": "Fort Kochi Beach",
                "lat": "9.9658",
                "lon": "76.2412",
                "type": "beach",
                "display_name": "Fort Kochi Beach, Kochi, Kerala, India",
                "osm_type": "node",
                "osm_id": "334455"
            }
        ]

        service_kochi = LivePlaceSearchService(overpass=mock_overpass_kochi, nominatim=mock_nominatim_kochi)
        res_kochi = service_kochi.search_places(q="Fort Kochi", destination_slug="kochi", live=True)

        self.assertEqual(res_kochi["destination"], "kochi")
        self.assertEqual(res_kochi["live_external_count"], 1)
        kochi_item = res_kochi["results"][0]
        self.assertEqual(kochi_item["destination_slug"], "kochi")
        self.assertEqual(kochi_item["destination_name"], "Kochi")
        self.assertEqual(kochi_item["name"], "Fort Kochi Beach")

        # 2. Chandigarh test
        mock_overpass_chd = MagicMock()
        mock_overpass_chd.build_query.return_value = "[out:json];"
        mock_overpass_chd.fetch.return_value = {"elements": []}
        mock_overpass_chd.parse.return_value = [
            {
                "name": "Rock Garden of Chandigarh",
                "category": "culture",
                "subcategory": "sculpture_garden",
                "latitude": 30.7525,
                "longitude": 76.8066,
                "address": "Sector 1, Chandigarh, India",
                "description": "Sculpture garden built of industrial and home waste.",
                "ticket_price_inr": None,
                "typical_cost_inr": None,
                "opening_hours": "09:00-19:00",
                "source_record_id": "osm_way_998877",
                "osm_type": "way",
                "osm_id": "998877"
            }
        ]

        mock_nominatim_chd = MagicMock()
        mock_nominatim_chd.geocode_destination.return_value = {
            "name": "Chandigarh",
            "display_name": "Chandigarh, India",
            "latitude": 30.7333,
            "longitude": 76.7794,
            "state": "Chandigarh",
            "osm_id": "54321",
            "osm_type": "relation"
        }

        service_chd = LivePlaceSearchService(overpass=mock_overpass_chd, nominatim=mock_nominatim_chd)
        res_chd = service_chd.search_places(q="Rock Garden", destination_slug="chandigarh", live=True)

        self.assertEqual(res_chd["destination"], "chandigarh")
        self.assertEqual(res_chd["live_external_count"], 1)
        chd_item = res_chd["results"][0]
        self.assertEqual(chd_item["destination_slug"], "chandigarh")
        self.assertEqual(chd_item["destination_name"], "Chandigarh")
        self.assertEqual(chd_item["name"], "Rock Garden of Chandigarh")

    def test_seeded_destination_search_remains_functional(self):
        # Visakhapatnam is seeded in setUp
        service = LivePlaceSearchService()
        res = service.search_places(destination_slug="visakhapatnam", live=False)

        self.assertEqual(res["destination"], "visakhapatnam")
        self.assertEqual(res["database_count"], 2)
        self.assertEqual(res["live_external_count"], 0)
        self.assertEqual(res["results"][0]["result_type"], "database")
        self.assertTrue(res["results"][0]["is_persisted"])

    def test_external_search_failure_returns_safe_response(self):
        mock_overpass = MagicMock()
        mock_overpass.build_query.side_effect = ProviderTimeoutError("Overpass connection timed out")

        mock_nominatim = MagicMock()
        mock_nominatim.geocode_destination.side_effect = ProviderError("Nominatim unreachable")
        mock_nominatim.fetch.side_effect = ProviderError("Nominatim unreachable")

        service = LivePlaceSearchService(overpass=mock_overpass, nominatim=mock_nominatim)
        
        # Must not raise an exception; must return empty external list safely
        res = service.search_places(q="Cubbon Park", destination_slug="bengaluru", live=True)
        self.assertEqual(res["total_count"], 0)
        self.assertEqual(res["live_external_count"], 0)
        self.assertEqual(res["database_count"], 0)
        self.assertEqual(res["results"], [])

        # API view test with mocked failure
        url = reverse('places-live-search')
        with patch('places.views.LivePlaceSearchService') as MockServiceClass:
            mock_inst = MagicMock()
            mock_inst.search_places.return_value = {
                "query": "Cubbon Park",
                "destination": "bengaluru",
                "category": "all",
                "total_count": 0,
                "database_count": 0,
                "live_external_count": 0,
                "results": []
            }
            MockServiceClass.return_value = mock_inst
            response = self.client.get(url, {'destination': 'bengaluru', 'q': 'Cubbon Park'})
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.json()["total_count"], 0)

    def test_external_search_does_not_change_sqlite_place_count_for_unseeded_city(self):
        initial_count = Place.objects.count()

        mock_overpass = MagicMock()
        mock_overpass.build_query.return_value = "[out:json];"
        mock_overpass.fetch.return_value = {"elements": []}
        mock_overpass.parse.return_value = []

        mock_nominatim = MagicMock()
        mock_nominatim.geocode_destination.return_value = {
            "name": "Bengaluru",
            "latitude": 12.9716,
            "longitude": 77.5946
        }
        mock_nominatim.fetch.return_value = [
            {
                "name": "Bannerghatta National Park",
                "lat": "12.8000",
                "lon": "77.5700",
                "type": "national_park",
                "display_name": "Bannerghatta National Park, Bengaluru, Karnataka, India",
                "osm_type": "node",
                "osm_id": "112233"
            }
        ]

        service = LivePlaceSearchService(overpass=mock_overpass, nominatim=mock_nominatim)
        res = service.search_places(q="Bannerghatta", destination_slug="bengaluru", live=True)

        self.assertEqual(res["live_external_count"], 1)
        # CRITICAL ASSERTION: No database record was created
        self.assertEqual(Place.objects.count(), initial_count)

    def test_deduplication_and_explicit_import_for_unseeded_city(self):
        # 1. Deduplication within external search
        mock_overpass = MagicMock()
        mock_overpass.build_query.return_value = "[out:json];"
        mock_overpass.fetch.return_value = {"elements": []}
        mock_overpass.parse.return_value = [
            {
                "name": "Tipu Sultan's Summer Palace",
                "category": "history",
                "subcategory": "palace",
                "latitude": 12.9592,
                "longitude": 77.5737,
                "source_record_id": "osm_way_111",
                "osm_type": "way",
                "osm_id": "111"
            }
        ]

        mock_nominatim = MagicMock()
        mock_nominatim.geocode_destination.return_value = {
            "name": "Bengaluru",
            "latitude": 12.9716,
            "longitude": 77.5946
        }
        # Nominatim returns same place
        mock_nominatim.fetch.return_value = [
            {
                "name": "Tipu Sultan's Summer Palace",
                "lat": "12.9592",
                "lon": "77.5737",
                "type": "palace",
                "display_name": "Tipu Sultan's Summer Palace, Bengaluru",
                "osm_type": "way",
                "osm_id": "111"
            }
        ]

        service = LivePlaceSearchService(overpass=mock_overpass, nominatim=mock_nominatim)
        res = service.search_places(q="Tipu Sultan", destination_slug="bengaluru", live=True)

        # Deduplication must collapse the 2 external results into 1
        self.assertEqual(res["live_external_count"], 1)

        # 2. Explicit import to SQLite
        initial_count = Place.objects.count()
        url = reverse('places-import-external')
        payload = {
            "name": "Tipu Sultan's Summer Palace",
            "destination_slug": "bengaluru",
            "category": "history",
            "latitude": 12.9592,
            "longitude": 77.5737,
            "address": "Albert Victor Road, Chamrajpet, Bengaluru, Karnataka",
            "description": "Historical wooden summer residence of Tipu Sultan.",
            "source_record_id": "osm_way_111",
            "osm_type": "way",
            "osm_id": "111"
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()

        self.assertEqual(data["result_type"], "database")
        self.assertTrue(data["is_persisted"])
        self.assertEqual(data["provenance_label"], "Imported and persisted record")

        # Database place count must increase by exactly 1
        self.assertEqual(Place.objects.count(), initial_count + 1)

        saved = Place.objects.get(name="Tipu Sultan's Summer Palace")
        self.assertEqual(saved.verification_status, "ESTIMATED")

        # Verify DataProvenanceLog record was created
        log = DataProvenanceLog.objects.filter(place=saved).first()
        self.assertIsNotNone(log)
        self.assertIn("Live Discovery", log.source_name)
