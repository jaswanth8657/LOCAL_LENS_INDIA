import os
import sqlite3
import unittest
from unittest.mock import patch, MagicMock
from django.test import TestCase, SimpleTestCase
from django.conf import settings

from data_providers.opentripmap import OpenTripMapProvider, map_otm_kinds_to_category
from data_providers.geoapify import GeoapifyProvider, map_geoapify_categories
from data_providers.wikimedia import WikimediaProvider
from places.search_service import LivePlaceSearchService, haversine_distance_meters, _normalize_name
from destinations.models import Destination
from places.models import Place


class TestOpenTripMapProvider(TestCase):
    """Unit tests for OpenTripMapProvider integration, error handling, and keyless behavior."""

    def test_missing_api_key_disables_provider_gracefully(self):
        with patch.dict(os.environ, {"OPENTRIPMAP_API_KEY": ""}):
            with patch("django.conf.settings.OPENTRIPMAP_API_KEY", ""):
                provider = OpenTripMapProvider(api_key="")
                self.assertFalse(provider.is_available())
                res = provider.search_radius(17.385, 78.486)
                self.assertEqual(res, [])
                details = provider.get_place_details("x12345")
                self.assertIsNone(details)

    def test_kinds_mapping(self):
        cat, subcat = map_otm_kinds_to_category("historic,monuments,cultural")
        self.assertEqual(cat, "history")
        self.assertEqual(subcat, "Historical Monument")

        cat_food, subcat_food = map_otm_kinds_to_category("foods,restaurants")
        self.assertEqual(cat_food, "food")

        cat_beach, subcat_beach = map_otm_kinds_to_category("beaches,resorts")
        self.assertEqual(cat_beach, "beaches")

    @patch("requests.get")
    def test_search_radius_parsing_success(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [
            {
                "xid": "W123456",
                "name": "Charminar",
                "dist": 150.5,
                "rate": 3,
                "osm": "way/123456",
                "kinds": "historic,monuments_and_memorials,architecture",
                "point": {
                    "lat": 17.3615,
                    "lon": 78.4747
                }
            }
        ]
        mock_get.return_value = mock_resp

        provider = OpenTripMapProvider(api_key="valid_test_key")
        self.assertTrue(provider.is_available())
        results = provider.search_radius(17.3615, 78.4747, radius_meters=1000)

        self.assertEqual(len(results), 1)
        item = results[0]
        self.assertEqual(item["otm_xid"], "W123456")
        self.assertEqual(item["name"], "Charminar")
        self.assertEqual(item["category"], "history")
        self.assertEqual(item["latitude"], 17.3615)
        self.assertEqual(item["longitude"], 78.4747)
        self.assertEqual(item["otm_rate"], 3)
        self.assertIsNone(item["rating"])  # Catalog popularity is not customer rating
        self.assertEqual(item["source_name"], "OpenTripMap")

    @patch("requests.get")
    def test_rate_limit_429_graceful_handling(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 429
        mock_get.return_value = mock_resp

        provider = OpenTripMapProvider(api_key="test_key")
        results = provider.search_radius(17.3615, 78.4747)
        self.assertEqual(results, [])

    @patch("requests.get")
    def test_auth_error_401_graceful_handling(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 401
        mock_get.return_value = mock_resp

        provider = OpenTripMapProvider(api_key="invalid_key")
        results = provider.search_radius(17.3615, 78.4747)
        self.assertEqual(results, [])


class TestGeoapifyProvider(TestCase):
    """Unit tests for GeoapifyProvider integration, error handling, and keyless behavior."""

    def test_missing_api_key_disables_provider_gracefully(self):
        with patch.dict(os.environ, {"GEOAPIFY_API_KEY": ""}):
            with patch("django.conf.settings.GEOAPIFY_API_KEY", ""):
                provider = GeoapifyProvider(api_key="")
                self.assertFalse(provider.is_available())
                res = provider.search_places(17.385, 78.486)
                self.assertEqual(res, [])

    def test_category_mapping(self):
        cat, subcat = map_geoapify_categories(["catering.restaurant", "catering.restaurant.indian"])
        self.assertEqual(cat, "food")
        self.assertEqual(subcat, "Restaurant & Dining")

        cat_mus, subcat_mus = map_geoapify_categories(["entertainment.museum"])
        self.assertEqual(cat_mus, "history")
        self.assertEqual(subcat_mus, "Museum & Heritage")

    @patch("requests.get")
    def test_search_places_parsing_success(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {
                        "place_id": "51234abcd",
                        "name": "Paradise Biryani",
                        "categories": ["catering.restaurant"],
                        "formatted": "MG Road, Secunderabad, Telangana 500003, India",
                        "opening_hours": "Mo-Su 11:30-23:00",
                        "lat": 17.4375,
                        "lon": 78.4875
                    },
                    "geometry": {
                        "type": "Point",
                        "coordinates": [78.4875, 17.4375]
                    }
                }
            ]
        }
        mock_get.return_value = mock_resp

        provider = GeoapifyProvider(api_key="valid_test_key")
        self.assertTrue(provider.is_available())
        results = provider.search_places(17.4375, 78.4875, radius_meters=1500)

        self.assertEqual(len(results), 1)
        item = results[0]
        self.assertEqual(item["geoapify_place_id"], "51234abcd")
        self.assertEqual(item["name"], "Paradise Biryani")
        self.assertEqual(item["category"], "food")
        self.assertEqual(item["subcategory"], "Restaurant & Dining")
        self.assertEqual(item["latitude"], 17.4375)
        self.assertEqual(item["longitude"], 78.4875)
        self.assertEqual(item["opening_hours"], "Mo-Su 11:30-23:00")
        self.assertEqual(item["source_name"], "Geoapify Places")

    @patch("requests.get")
    def test_quota_exceeded_402_graceful_handling(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 402
        mock_get.return_value = mock_resp

        provider = GeoapifyProvider(api_key="test_key")
        results = provider.search_places(17.4375, 78.4875)
        self.assertEqual(results, [])


class TestWikimediaProvider(TestCase):
    """Unit tests for Wikimedia Commons and Wikipedia public API integrations."""

    def setUp(self):
        self.provider = WikimediaProvider()

    @patch("requests.get")
    def test_wikipedia_extract_success(self, mock_get):
        search_resp = MagicMock()
        search_resp.status_code = 200
        search_resp.json.return_value = {
            "query": {
                "search": [
                    {"title": "Charminar"}
                ]
            }
        }

        extract_resp = MagicMock()
        extract_resp.status_code = 200
        extract_resp.json.return_value = {
            "query": {
                "pages": {
                    "1010": {
                        "pageid": 1010,
                        "title": "Charminar",
                        "extract": "The Charminar is a monument and mosque located in Hyderabad, Telangana, India. Built in 1591, it is a global icon of Hyderabad."
                    }
                }
            }
        }
        mock_get.side_effect = [search_resp, extract_resp]

        extract = self.provider.get_wikipedia_extract("Charminar", city_hint="Hyderabad")
        self.assertIsNotNone(extract)
        self.assertIn("monument and mosque located in Hyderabad", extract)

    @patch("requests.get")
    def test_commons_photo_search_with_licensing(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "query": {
                "pages": {
                    "9999": {
                        "title": "File:Charminar Hyderabad.jpg",
                        "imageinfo": [
                            {
                                "url": "https://upload.wikimedia.org/wikipedia/commons/1/12/Charminar_Hyderabad.jpg",
                                "thumburl": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Charminar_Hyderabad.jpg/800px-Charminar_Hyderabad.jpg",
                                "descriptionurl": "https://commons.wikimedia.org/wiki/File:Charminar_Hyderabad.jpg",
                                "extmetadata": {
                                    "Artist": {"value": "<a href=\"...\">Bernard Gagnon</a>"},
                                    "LicenseShortName": {"value": "CC BY-SA 3.0"},
                                    "LicenseUrl": {"value": "https://creativecommons.org/licenses/by-sa/3.0"}
                                }
                            }
                        ]
                    }
                }
            }
        }
        mock_get.return_value = mock_resp

        photo = self.provider.get_commons_photo("Charminar", city_hint="Hyderabad")
        self.assertIsNotNone(photo)
        self.assertEqual(photo["image_license"], "CC BY-SA 3.0")
        self.assertEqual(photo["image_author"], "Bernard Gagnon")
        self.assertEqual(photo["image_license_url"], "https://creativecommons.org/licenses/by-sa/3.0")
        self.assertIn("Charminar_Hyderabad.jpg", photo["image_url"])
        self.assertEqual(photo["image_provenance"], "Wikimedia Commons")

    @patch("requests.get")
    def test_strict_token_matching_rejects_irrelevant_images(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "query": {
                "pages": {
                    "8888": {
                        "title": "File:Map of Random District 1890.jpg",
                        "imageinfo": [
                            {
                                "url": "https://upload.wikimedia.org/wikipedia/commons/a/ab/Map.jpg",
                                "thumburl": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Map.jpg/800px-Map.jpg",
                                "descriptionurl": "https://commons.wikimedia.org/wiki/File:Map.jpg",
                                "extmetadata": {
                                    "Artist": {"value": "Survey of India"},
                                    "LicenseShortName": {"value": "Public domain"}
                                }
                            }
                        ]
                    }
                }
            }
        }
        mock_get.return_value = mock_resp

        photo = self.provider.get_commons_photo("Golconda Fort", city_hint="Hyderabad")
        self.assertIsNone(photo)


class TestLivePlaceSearchServiceAggregation(TestCase):
    """Integration tests for LivePlaceSearchService multi-provider aggregation and deduplication."""

    def setUp(self):
        self.service = LivePlaceSearchService()

    def test_haversine_and_name_deduplication(self):
        # 1. Coordinate distance calculation
        # Charminar (17.361564, 78.474665) to Mecca Masjid (17.3606, 78.4736) is ~150 meters
        dist = haversine_distance_meters(17.361564, 78.474665, 17.3606, 78.4736)
        self.assertTrue(100 < dist < 200)

        # 2. Name normalization
        self.assertEqual(_normalize_name("Hawa Mahal Palace!"), "hawamahalpalace")
        self.assertEqual(_normalize_name("The Taj Mahal, Agra"), "thetajmahalagra")

    @patch.object(LivePlaceSearchService, "_fetch_external_pois")
    def test_search_places_merging_local_and_external(self, mock_fetch):
        mock_fetch.return_value = [
            {
                "osm_id": 999111,
                "osm_type": "node",
                "name": "Live Discovered Fort",
                "category": "culture",
                "subcategory": "Fort",
                "latitude": 17.385,
                "longitude": 78.486,
                "address": "Hyderabad, Telangana",
                "description": "Historical fort",
                "ticket_price_inr": 25,
                "typical_cost_inr": 100,
                "opening_hours": "09:00-17:00",
                "verification_status": "SOURCE_REPORTED",
                "source_name": "OpenStreetMap",
                "source_url": "https://www.openstreetmap.org/node/999111",
                "source_record_id": "node/999111",
            }
        ]

        result = self.service.search_places(destination_slug="hyderabad", live=True, limit=5)
        self.assertEqual(result["destination"], "hyderabad")
        self.assertGreaterEqual(result["total_count"], 1)
        res_names = [r["name"] for r in result["results"]]
        self.assertIn("Live Discovered Fort", res_names)


class TestPhase14_2_LocalSearchOptimization(TestCase):
    """
    Phase 14.2 regression tests:
    Verify that local database-only search (live=False) strictly queries SQLite
    and makes zero external calls to Wikimedia, Wikipedia, Overpass, OpenTripMap, Geoapify, or Nominatim.
    """

    def setUp(self):
        self.service = LivePlaceSearchService()
        self.dest = Destination.objects.create(
            name="Test City",
            slug="test-city",
            state="Rajasthan",
            region="North",
            latitude=26.9124,
            longitude=75.7873
        )
        self.place1 = Place.objects.create(
            destination=self.dest,
            name="Amber Fort",
            category="history",
            subcategory="Ancient Fort",
            latitude=26.9855,
            longitude=75.8513,
            description="Historic fort palace in Amber.",
            verification_status="VERIFIED"
        )
        self.place2 = Place.objects.create(
            destination=self.dest,
            name="Nahargarh Biological Park",
            category="nature",
            subcategory="Park",
            latitude=27.0123,
            longitude=75.8456,
            description="Scenic park near Nahargarh.",
            verification_status="VERIFIED"
        )

    @patch("places.search_service.LivePlaceSearchService._fetch_external_pois")
    def test_local_only_search_makes_zero_external_and_zero_wikimedia_calls(self, mock_fetch_ext):
        with patch.object(self.service.wikimedia, "get_commons_photo") as mock_photo:
            with patch.object(self.service.wikimedia, "get_wikipedia_extract") as mock_wiki:
                res = self.service.search_places(destination_slug="test-city", live=False, limit=10)

                # 1. Returned results come from local DB
                self.assertEqual(res["total_count"], 2)
                self.assertEqual(res["database_count"], 2)
                self.assertEqual(res["live_external_count"], 0)
                self.assertTrue(all(r["result_type"] == "database" for r in res["results"]))
                self.assertTrue(all(r["is_persisted"] is True for r in res["results"]))

                # 2. Zero Wikimedia Commons and Wikipedia calls
                mock_photo.assert_not_called()
                mock_wiki.assert_not_called()

                # 3. Zero external POI fetch calls
                mock_fetch_ext.assert_not_called()

                # 4. Existing fallback representation preserved (empty string imageUrl for frontend placeholder)
                no_img_place = next(r for r in res["results"] if r["name"] == "Nahargarh Biological Park")
                self.assertEqual(no_img_place["image_url"], "")
                self.assertEqual(no_img_place["image_author"], "")
                self.assertEqual(no_img_place["image_license"], "")

    @patch("places.search_service.LivePlaceSearchService._fetch_external_pois")
    def test_live_search_still_performs_enrichment_when_appropriate(self, mock_fetch_ext):
        mock_fetch_ext.return_value = [
            {
                "osm_id": 12345,
                "osm_type": "node",
                "name": "Live Jaigarh Watchtower",
                "category": "history",
                "subcategory": "Fort",
                "latitude": 26.9300,
                "longitude": 75.8000,
                "address": "Jaipur",
                "description": "Real-world location discovered live.",
                "verification_status": "SOURCE_REPORTED",
                "source_name": "OpenStreetMap",
                "image_url": "",
            }
        ]

        with patch.object(self.service.wikimedia, "get_commons_photo") as mock_photo:
            with patch.object(self.service.wikimedia, "get_wikipedia_extract") as mock_wiki:
                mock_photo.return_value = {
                    "image_url": "https://upload.wikimedia.org/jaigarh.jpg",
                    "image_author": "Traveler Photographer",
                    "image_license": "CC BY-SA 4.0",
                    "image_license_url": "https://creativecommons.org/licenses/by-sa/4.0",
                    "image_source_url": "https://commons.wikimedia.org/wiki/File:Jaigarh.jpg",
                    "image_provenance": "Wikimedia Commons"
                }
                mock_wiki.return_value = "Jaigarh Fort overlooks Amer Fort complex."

                res = self.service.search_places(destination_slug="test-city", live=True, limit=10)

                # Live enrichment was invoked
                self.assertTrue(mock_photo.called)
                self.assertTrue(mock_wiki.called)

                # Verified enriched place contains metadata
                live_item = next(r for r in res["results"] if r["name"] == "Live Jaigarh Watchtower")
                self.assertEqual(live_item["image_url"], "https://upload.wikimedia.org/jaigarh.jpg")
                self.assertEqual(live_item["image_author"], "Traveler Photographer")
                self.assertEqual(live_item["image_license"], "CC BY-SA 4.0")
                self.assertEqual(live_item["wiki_extract"], "Jaigarh Fort overlooks Amer Fort complex.")

    @patch("places.search_service.LivePlaceSearchService._fetch_external_pois")
    def test_live_media_enrichment_is_capped_at_eight_items(self, mock_fetch_ext):
        # 15 external items needing enrichment
        mock_fetch_ext.return_value = [
            {
                "osm_id": i,
                "osm_type": "node",
                "name": f"Monument {i}",
                "category": "culture",
                "latitude": 26.9 + (i * 0.001),
                "longitude": 75.8 + (i * 0.001),
                "address": "Jaipur",
                "description": "Real-world location discovered live.",
                "image_url": "",
            }
            for i in range(15)
        ]

        with patch.object(self.service.wikimedia, "get_commons_photo") as mock_photo:
            mock_photo.return_value = {
                "image_url": "https://upload.wikimedia.org/sample.jpg",
                "image_author": "Author",
                "image_license": "CC BY-SA 4.0",
                "image_license_url": "https://creativecommons.org/licenses/by-sa/4.0",
                "image_source_url": "https://commons.wikimedia.org/wiki/File:Sample.jpg",
                "image_provenance": "Wikimedia Commons"
            }
            with patch.object(self.service.wikimedia, "get_wikipedia_extract") as mock_wiki:
                mock_wiki.return_value = None

                self.service.search_places(destination_slug="test-city", live=True, limit=20)

                # Must not exceed maximum enrichment cap of 8
                self.assertLessEqual(mock_photo.call_count, 8)


class TestDatabaseIntegrity(SimpleTestCase):
    """Verify that SQLite database retains all records intact."""

    def test_real_database_records_intact(self):
        db_path = os.path.join(settings.BASE_DIR, "db.sqlite3")
        self.assertTrue(os.path.exists(db_path), "Database file db.sqlite3 must exist")

        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check PRAGMA integrity
        cursor.execute("PRAGMA integrity_check;")
        integrity = cursor.fetchone()
        self.assertEqual(integrity[0], "ok")

        # Check Destination count
        cursor.execute("SELECT COUNT(*) FROM destinations_destination;")
        dest_count = cursor.fetchone()[0]
        self.assertGreaterEqual(dest_count, 6, "Expected at least 6 destinations")

        # Check Place count
        cursor.execute("SELECT COUNT(*) FROM places_place;")
        place_count = cursor.fetchone()[0]
        self.assertGreaterEqual(place_count, 128, "Expected at least 128 places")

        conn.close()
