import os
import shutil
import tempfile
from unittest.mock import patch, MagicMock
from django.test import TestCase
from destinations.models import Destination
from places.models import Place, DataProvenanceLog
from data_providers.base import ProviderError, ProviderTimeoutError, ValidationError
from data_providers.cache import ProviderCache
from data_providers.validators import (
    validate_coordinates,
    sanitize_text,
    parse_ticket_fee,
    parse_opening_hours
)
from data_providers.nominatim import NominatimProvider
from data_providers.overpass import OverpassProvider
from data_providers.services import PlaceIngestionService

class ValidatorsAndParsingTests(TestCase):
    def test_coordinate_validation_success(self):
        lat, lon = validate_coordinates("17.6868123", "83.2185456")
        self.assertEqual(lat, 17.686812)
        self.assertEqual(lon, 83.218546)

    def test_coordinate_validation_out_of_bounds(self):
        # Coordinates in Antarctica or Atlantic Ocean should fail India boundary validation
        with self.assertRaises(ValidationError):
            validate_coordinates(-82.5, 0.0)

    def test_sanitize_text(self):
        dirty = "<script>alert('xss')</script><b>Hawa Mahal</b> \n\n Palace"
        clean = sanitize_text(dirty)
        self.assertEqual(clean, "Hawa Mahal Palace")

    def test_parse_ticket_fee_honest_behavior(self):
        # 1. fee=no => (0, 'VERIFIED')
        fee, status = parse_ticket_fee({'fee': 'no'})
        self.assertEqual(fee, 0)
        self.assertEqual(status, 'VERIFIED')

        # 2. explicit charge => (50, 'VERIFIED')
        fee, status = parse_ticket_fee({'charge': '₹50 per adult'})
        self.assertEqual(fee, 50)
        self.assertEqual(status, 'VERIFIED')

        # 3. fee=yes with no amount => (None, 'ESTIMATED')
        fee, status = parse_ticket_fee({'fee': 'yes'})
        self.assertIsNone(fee)
        self.assertEqual(status, 'ESTIMATED')

        # 4. no fee tags => (None, 'UNAVAILABLE')
        fee, status = parse_ticket_fee({})
        self.assertIsNone(fee)
        self.assertEqual(status, 'UNAVAILABLE')

    def test_parse_opening_hours(self):
        hours, status = parse_opening_hours({'opening_hours': '09:00-18:00'})
        self.assertEqual(hours, '09:00-18:00')
        self.assertEqual(status, 'VERIFIED')

        hours, status = parse_opening_hours({})
        self.assertEqual(hours, '')
        self.assertEqual(status, 'UNAVAILABLE')


class ProviderCacheTests(TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.cache = ProviderCache(cache_dir=self.temp_dir, default_ttl_seconds=3600)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_cache_set_and_get(self):
        key = {"query": "test_query"}
        payload = {"data": [1, 2, 3]}
        self.assertIsNone(self.cache.get("test", key))

        self.cache.set("test", key, payload)
        cached = self.cache.get("test", key)
        self.assertEqual(cached, payload)


class NominatimProviderTests(TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.cache = ProviderCache(cache_dir=self.temp_dir)
        self.provider = NominatimProvider(cache=self.cache)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    @patch('requests.get')
    def test_geocode_destination_success(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [
            {
                "lat": "17.6868",
                "lon": "83.2185",
                "name": "Visakhapatnam",
                "display_name": "Visakhapatnam, Andhra Pradesh, India",
                "osm_id": 123456,
                "osm_type": "relation",
                "address": {"state": "Andhra Pradesh"}
            }
        ]
        mock_get.return_value = mock_resp

        result = self.provider.geocode_destination("Visakhapatnam")
        self.assertIsNotNone(result)
        self.assertEqual(result['name'], "Visakhapatnam")
        self.assertEqual(result['latitude'], 17.6868)
        self.assertEqual(result['longitude'], 83.2185)
        self.assertEqual(result['state'], "Andhra Pradesh")

    @patch('requests.get')
    def test_geocode_timeout_handling(self, mock_get):
        import requests
        mock_get.side_effect = requests.exceptions.Timeout("Connection timed out")
        with self.assertRaises(ProviderTimeoutError):
            self.provider.fetch("search", {"q": "Test"})


class OverpassProviderTests(TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.cache = ProviderCache(cache_dir=self.temp_dir)
        self.provider = OverpassProvider(cache=self.cache)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_overpass_parse_elements(self):
        mock_raw = {
            "elements": [
                {
                    "type": "node",
                    "id": 99901,
                    "lat": 17.7164,
                    "lon": 83.3331,
                    "tags": {
                        "name": "Yarada Beach",
                        "natural": "beach",
                        "fee": "no",
                    }
                },
                {
                    "type": "way",
                    "id": 99902,
                    "center": {"lat": 17.7500, "lon": 83.3400},
                    "tags": {
                        "name": "Simhachalam Temple",
                        "amenity": "place_of_worship",
                        "religion": "hindu",
                        "opening_hours": "07:00-21:00",
                    }
                },
                # Missing name should be rejected
                {
                    "type": "node",
                    "id": 99903,
                    "lat": 17.7000,
                    "lon": 83.3000,
                    "tags": {"tourism": "attraction"}
                }
            ]
        }

        parsed = self.provider.parse(mock_raw)
        self.assertEqual(len(parsed), 2)
        
        # Verify first POI
        p1 = parsed[0]
        self.assertEqual(p1['name'], "Yarada Beach")
        self.assertEqual(p1['category'], "beaches")
        self.assertEqual(p1['ticket_price_inr'], 0)
        self.assertEqual(p1['source_record_id'], "osm:node:99901")

        # Verify second POI
        p2 = parsed[1]
        self.assertEqual(p2['name'], "Simhachalam Temple")
        self.assertEqual(p2['category'], "temple")
        self.assertEqual(p2['opening_hours'], "07:00-21:00")
        self.assertEqual(p2['source_record_id'], "osm:way:99902")


class PlaceIngestionServiceTests(TestCase):
    def setUp(self):
        self.dest = Destination.objects.create(
            slug='visakhapatnam',
            name='Visakhapatnam',
            state='Andhra Pradesh',
            region='South',
            tagline='Jewel of East Coast',
            description='Scenic coastal port city.',
            latitude=17.6868,
            longitude=83.2185,
            average_daily_budget_inr=1800,
            verification_status='VERIFIED'
        )

    @patch.object(OverpassProvider, 'fetch')
    def test_ingest_places_creation_and_provenance(self, mock_fetch):
        mock_fetch.return_value = {
            "elements": [
                {
                    "type": "node",
                    "id": 7771,
                    "lat": 17.7200,
                    "lon": 83.3200,
                    "tags": {
                        "name": "Tenneti Beach Park",
                        "natural": "beach",
                        "opening_hours": "06:00-20:00",
                        "fee": "no",
                    }
                }
            ]
        }

        service = PlaceIngestionService()
        stats = service.ingest_destination_places(
            destination_slug='visakhapatnam',
            radius_meters=10000,
            limit=10
        )

        self.assertEqual(stats['retrieved'], 1)
        self.assertEqual(stats['created'], 1)
        self.assertEqual(stats['updated'], 0)

        # Check DB
        place = Place.objects.get(source_record_id='osm:node:7771')
        self.assertEqual(place.name, "Tenneti Beach Park")
        self.assertEqual(place.category, "beaches")
        self.assertEqual(place.ticket_price_inr, 0)
        self.assertEqual(place.opening_hours, "06:00-20:00")

        # Check DataProvenanceLog
        provs = place.provenance_records.all()
        self.assertGreaterEqual(provs.count(), 2)
        field_names = [p.field_name for p in provs]
        self.assertIn('coordinates', field_names)
        self.assertIn('ticket_price_inr', field_names)

    @patch.object(OverpassProvider, 'fetch')
    def test_ingest_places_duplicate_detection(self, mock_fetch):
        # Pre-create place
        Place.objects.create(
            destination=self.dest,
            name="Tenneti Beach Park",
            category="beaches",
            latitude=17.7200,
            longitude=83.3200,
            source_record_id="osm:node:7771",
            verification_status="VERIFIED"
        )

        # Same record returned from Overpass
        mock_fetch.return_value = {
            "elements": [
                {
                    "type": "node",
                    "id": 7771,
                    "lat": 17.7200,
                    "lon": 83.3200,
                    "tags": {
                        "name": "Tenneti Beach Park",
                        "natural": "beach",
                    }
                }
            ]
        }

        service = PlaceIngestionService()
        stats = service.ingest_destination_places('visakhapatnam')
        self.assertEqual(stats['created'], 0)
        self.assertEqual(stats['updated'], 1)

