import json
from unittest.mock import patch, MagicMock
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from destinations.models import Destination
from places.models import Place
from trips.models import Itinerary, ItineraryDay, ItineraryStop, ExpenseBreakdown
from ai.schemas import TripPreferencesInput, RawAIItinerary
from ai.providers.base import BaseAIProvider, ProviderStatus
from ai.providers.gemini_provider import GeminiProvider
from ai.providers.ollama_provider import OllamaProvider
from ai.deterministic_planner import DeterministicPlanner
from ai.manager import AIManager
from ai.services import AITripPlannerService


class BaseAIProviderUnitTests(TestCase):
    def test_extract_json_from_raw_markdown_fences(self):
        raw = """```json
        {
            "title": "3-Day Vizag Trip",
            "destination_name": "Visakhapatnam",
            "duration_days": 3,
            "days": []
        }
        ```"""
        parsed = BaseAIProvider.extract_json_from_response(raw)
        self.assertEqual(parsed["title"], "3-Day Vizag Trip")
        self.assertEqual(parsed["duration_days"], 3)

    def test_extract_json_from_conversational_text(self):
        raw = """Here is your personalized itinerary:
        {
            "title": "Heritage Tour",
            "destination_name": "Jaipur",
            "duration_days": 2,
            "days": []
        }
        Hope you have a fantastic local experience!"""
        parsed = BaseAIProvider.extract_json_from_response(raw)
        self.assertEqual(parsed["title"], "Heritage Tour")

    def test_extract_json_invalid_raises_value_error(self):
        with self.assertRaises(ValueError):
            BaseAIProvider.extract_json_from_response("Sorry, I cannot plan that.")


class GeminiProviderUnitTests(TestCase):
    def setUp(self):
        self.provider = GeminiProvider()

    def test_health_check_without_key_reports_unavailable(self):
        with patch.dict('os.environ', {'GEMINI_API_KEY': ''}):
            p = GeminiProvider()
            st = p.check_health()
            self.assertFalse(st.available)
            self.assertIn("not configured", st.message)

    def test_health_check_with_key_reports_ready(self):
        with patch.dict('os.environ', {'GEMINI_API_KEY': 'test-fake-key-12345'}):
            p = GeminiProvider()
            st = p.check_health()
            self.assertTrue(st.available)

    def test_generate_plan_without_key_raises_value_error(self):
        with patch.dict('os.environ', {'GEMINI_API_KEY': ''}):
            p = GeminiProvider()
            with self.assertRaises(ValueError):
                p.generate_plan("user prompt", "system instruction")

    @patch('google.genai.Client')
    def test_gemini_success_mock(self, mock_client_cls):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "title": "3-Day Coastal Vizag Experience",
            "destination_name": "Visakhapatnam",
            "duration_days": 3,
            "days": [
                {
                    "day_number": 1,
                    "theme": "Beaches and Maritime History",
                    "stops": [
                        {
                            "place_id": "1",
                            "time_slot": "Morning",
                            "time": "09:00 AM",
                            "duration_minutes": 90,
                            "local_tips": "Early morning sea breeze",
                            "transport_to_next": "Walk"
                        }
                    ]
                }
            ],
            "notes": "Dress casually."
        })
        mock_client.models.generate_content.return_value = mock_response
        mock_client_cls.return_value = mock_client

        with patch.dict('os.environ', {'GEMINI_API_KEY': 'test-key'}):
            p = GeminiProvider()
            res = p.generate_plan("prompt", "sys")
            self.assertEqual(res["title"], "3-Day Coastal Vizag Experience")
            self.assertEqual(len(res["days"]), 1)

    @patch('google.genai.Client')
    def test_gemini_quota_exhausted_raises_runtime_error(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = Exception("429 ResourceExhausted: Quota exceeded for project")
        mock_client_cls.return_value = mock_client

        with patch.dict('os.environ', {'GEMINI_API_KEY': 'test-key'}):
            p = GeminiProvider()
            with self.assertRaises(RuntimeError) as ctx:
                p.generate_plan("prompt", "sys")
            self.assertIn("quota", str(ctx.exception).lower())

    @patch('google.genai.Client')
    def test_gemini_timeout_raises_timeout_error(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = Exception("Deadline exceeded timeout after 25s")
        mock_client_cls.return_value = mock_client

        with patch.dict('os.environ', {'GEMINI_API_KEY': 'test-key'}):
            p = GeminiProvider()
            with self.assertRaises(TimeoutError):
                p.generate_plan("prompt", "sys")


class OllamaProviderUnitTests(TestCase):
    def setUp(self):
        self.provider = OllamaProvider()

    @patch('requests.get')
    def test_ollama_health_success(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "models": [{"name": "gemma3:4b"}, {"name": "qwen2.5:3b"}]
        }
        mock_get.return_value = mock_resp

        st = self.provider.check_health()
        self.assertTrue(st.available)
        self.assertIn("running with primary model", st.message)

    @patch('requests.get')
    def test_ollama_health_connection_failure(self, mock_get):
        import requests
        mock_get.side_effect = requests.exceptions.ConnectionError("Connection refused")

        st = self.provider.check_health()
        self.assertFalse(st.available)
        self.assertIn("not reachable", st.message)

    @patch('requests.post')
    def test_ollama_generate_plan_success(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "response": json.dumps({
                "title": "Authentic Ollama Plan",
                "destination_name": "Visakhapatnam",
                "duration_days": 1,
                "days": [
                    {
                        "day_number": 1,
                        "theme": "Local Flavours",
                        "stops": [
                            {
                                "place_id": "1",
                                "time_slot": "Morning",
                                "time": "09:00 AM",
                                "duration_minutes": 60,
                                "local_tips": "Fresh morning snacks",
                                "transport_to_next": "Auto"
                            }
                        ]
                    }
                ]
            })
        }
        mock_post.return_value = mock_resp

        res = self.provider.generate_plan("prompt", "sys")
        self.assertEqual(res["title"], "Authentic Ollama Plan")

    @patch('requests.post')
    def test_ollama_connection_error_raises_connection_error(self, mock_post):
        import requests
        mock_post.side_effect = requests.exceptions.ConnectionError("Daemon offline")
        with self.assertRaises(ConnectionError):
            self.provider.generate_plan("prompt", "sys")


class DeterministicPlannerUnitTests(TestCase):
    def setUp(self):
        self.planner = DeterministicPlanner()
        self.candidates = [
            {"id": "1", "name": "Rushikonda Beach", "category": "beaches", "address": "Rushikonda, Vizag", "ticket_price_inr": 20},
            {"id": "2", "name": "Kursura Submarine", "category": "culture", "address": "RK Beach Rd", "ticket_price_inr": 70},
            {"id": "3", "name": "Kailasagiri Park", "category": "nature", "address": "Hilltop", "ticket_price_inr": 150},
            {"id": "4", "name": "Yarada Beach", "category": "beaches", "address": "Yarada, Vizag", "ticket_price_inr": 0},
            {"id": "5", "name": "Simhachalam Temple", "category": "temple", "address": "Simhachalam", "ticket_price_inr": 100},
            {"id": "6", "name": "Dolphin's Nose", "category": "nature", "address": "Port Area", "ticket_price_inr": 50},
        ]

    def test_deterministic_generates_valid_schedule(self):
        res = self.planner.generate_plan(
            destination_name="Visakhapatnam",
            duration_days=2,
            daily_budget_inr=2000,
            group_type="Duo",
            candidate_places=self.candidates,
            pace="Moderate"
        )
        self.assertEqual(res["destination_name"], "Visakhapatnam")
        self.assertEqual(res["duration_days"], 2)
        self.assertEqual(len(res["days"]), 2)
        # Each day has 3 stops (Moderate pace)
        self.assertEqual(len(res["days"][0]["stops"]), 3)
        self.assertEqual(len(res["days"][1]["stops"]), 3)

    def test_deterministic_empty_candidates_raises_value_error(self):
        with self.assertRaises(ValueError):
            self.planner.generate_plan("Empty Dest", 3, 2000, "Solo", [])


class AIManagerAndGroundingUnitTests(TestCase):
    def setUp(self):
        self.manager = AIManager()
        self.candidates = [
            {
                "id": 1,
                "name": "Rushikonda Beach",
                "category": "beaches",
                "address": "Rushikonda, Visakhapatnam",
                "ticket_price_inr": 20,
                "typical_cost_inr": 100,
                "opening_hours": "06:00-19:00",
                "latitude": 17.7820,
                "longitude": 83.3850,
                "verification_status": "VERIFIED"
            },
            {
                "id": 2,
                "name": "INS Kursura Submarine Museum",
                "category": "culture",
                "address": "RK Beach Road, Visakhapatnam",
                "ticket_price_inr": 70,
                "typical_cost_inr": 100,
                "opening_hours": "14:00-20:30",
                "latitude": 17.7155,
                "longitude": 83.3330,
                "verification_status": "VERIFIED"
            }
        ]

    @patch.object(GeminiProvider, 'generate_plan')
    def test_gemini_primary_success_grounds_data(self, mock_gemini):
        mock_gemini.return_value = {
            "title": "Gemini Planned Tour",
            "destination_name": "Visakhapatnam",
            "duration_days": 1,
            "days": [
                {
                    "day_number": 1,
                    "theme": "Beaches & History",
                    "stops": [
                        {
                            "place_id": "1",
                            "time_slot": "Morning",
                            "time": "09:00 AM",
                            "duration_minutes": 90,
                            "local_tips": "Scenic watersports",
                            "transport_to_next": "Auto"
                        }
                    ]
                }
            ]
        }

        prefs = TripPreferencesInput(destination="visakhapatnam", duration_days=1, budget_per_day=2000)
        res = self.manager.plan_itinerary(prefs, "Visakhapatnam", self.candidates)

        self.assertEqual(res["aiProviderUsed"], "GEMINI")
        stop = res["days"][0]["stops"][0]
        # Verified fields injected from candidate place 1
        self.assertEqual(stop["placeName"], "Rushikonda Beach")
        self.assertEqual(stop["costInr"], 20)
        self.assertEqual(stop["costStatus"], "VERIFIED")
        self.assertEqual(stop["latitude"], 17.7820)
        self.assertEqual(stop["longitude"], 83.3850)

    @patch.object(GeminiProvider, 'generate_plan')
    @patch.object(OllamaProvider, 'generate_plan')
    def test_automatic_gemini_to_ollama_fallback(self, mock_ollama, mock_gemini):
        mock_gemini.side_effect = RuntimeError("Gemini 429 quota exhausted")
        mock_ollama.return_value = {
            "title": "Ollama Fallback Tour",
            "destination_name": "Visakhapatnam",
            "duration_days": 1,
            "days": [
                {
                    "day_number": 1,
                    "theme": "Maritime Exploration",
                    "stops": [
                        {
                            "place_id": "2",
                            "time_slot": "Afternoon",
                            "time": "02:00 PM",
                            "duration_minutes": 90,
                            "local_tips": "Submarine audio tour",
                            "transport_to_next": "Walk"
                        }
                    ]
                }
            ]
        }

        prefs = TripPreferencesInput(destination="visakhapatnam", duration_days=1)
        res = self.manager.plan_itinerary(prefs, "Visakhapatnam", self.candidates)

        self.assertTrue(res["aiProviderUsed"].startswith("OLLAMA"))
        self.assertTrue(any("Gemini" in msg for msg in res["fallbackChain"]))
        stop = res["days"][0]["stops"][0]
        self.assertEqual(stop["placeName"], "INS Kursura Submarine Museum")
        self.assertEqual(stop["costInr"], 70)

    @patch.object(GeminiProvider, 'generate_plan')
    @patch.object(OllamaProvider, 'generate_plan')
    def test_automatic_ollama_primary_to_fallback_model(self, mock_ollama, mock_gemini):
        mock_gemini.side_effect = RuntimeError("Gemini offline")
        # Primary model fails, secondary succeeds
        def ollama_side_effect(prompt, sys, model_name=None):
            if model_name == "gemma3:4b":
                raise TimeoutError("gemma3:4b timed out")
            return {
                "title": "Qwen Fallback Tour",
                "destination_name": "Visakhapatnam",
                "duration_days": 1,
                "days": [
                    {
                        "day_number": 1,
                        "theme": "Maritime Exploration",
                        "stops": [
                            {
                                "place_id": "2",
                                "time_slot": "Afternoon",
                                "time": "02:00 PM",
                                "duration_minutes": 90,
                                "local_tips": "Submarine audio tour",
                                "transport_to_next": "Walk"
                            }
                        ]
                    }
                ]
            }

        mock_ollama.side_effect = ollama_side_effect

        prefs = TripPreferencesInput(destination="visakhapatnam", duration_days=1)
        res = self.manager.plan_itinerary(prefs, "Visakhapatnam", self.candidates)

        self.assertIn("qwen2.5:3b", res["aiProviderUsed"])
        self.assertTrue(any("gemma3:4b" in msg for msg in res["fallbackChain"]))

    @patch.object(GeminiProvider, 'generate_plan')
    @patch.object(OllamaProvider, 'generate_plan')
    def test_automatic_fallback_to_deterministic_when_both_fail(self, mock_ollama, mock_gemini):
        mock_gemini.side_effect = RuntimeError("Gemini offline")
        mock_ollama.side_effect = ConnectionError("Ollama daemon offline")

        prefs = TripPreferencesInput(destination="visakhapatnam", duration_days=2)
        res = self.manager.plan_itinerary(prefs, "Visakhapatnam", self.candidates)

        self.assertEqual(res["aiProviderUsed"], "DETERMINISTIC")
        self.assertEqual(len(res["days"]), 2)
        self.assertGreaterEqual(len(res["fallbackChain"]), 2)

    @patch.object(GeminiProvider, 'generate_plan')
    def test_hallucinated_place_id_rejected_and_safeguarded(self, mock_gemini):
        # AI returns a fabricated place ID '99999' not in candidates
        mock_gemini.return_value = {
            "title": "AI Tour With Fake Place",
            "destination_name": "Visakhapatnam",
            "duration_days": 1,
            "days": [
                {
                    "day_number": 1,
                    "theme": "Exploration",
                    "stops": [
                        {
                            "place_id": "99999",
                            "time_slot": "Morning",
                            "time": "09:00 AM",
                            "duration_minutes": 90,
                            "local_tips": "Fake tip",
                            "transport_to_next": "Walk"
                        }
                    ]
                }
            ]
        }

        prefs = TripPreferencesInput(destination="visakhapatnam", duration_days=1)
        res = self.manager.plan_itinerary(prefs, "Visakhapatnam", self.candidates)

        stop = res["days"][0]["stops"][0]
        # Anti-hallucination replaced unknown place with real candidate place
        self.assertIn(int(stop["placeId"]), [1, 2])
        self.assertIn(stop["placeName"], ["Rushikonda Beach", "INS Kursura Submarine Museum"])


class AIPlanAPIIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
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
            popular_categories=['beaches', 'culture'],
            verification_status='VERIFIED'
        )
        self.p1 = Place.objects.create(
            destination=self.dest,
            name='Rushikonda Beach',
            category='beaches',
            description='Blue flag beach',
            address='Rushikonda, Vizag',
            latitude=17.7820,
            longitude=83.3850,
            ticket_price_inr=20,
            verification_status='VERIFIED'
        )
        self.p2 = Place.objects.create(
            destination=self.dest,
            name='Kursura Museum',
            category='culture',
            description='Submarine museum',
            address='RK Beach, Vizag',
            latitude=17.7155,
            longitude=83.3330,
            ticket_price_inr=70,
            verification_status='VERIFIED'
        )

    def test_providers_status_endpoint(self):
        response = self.client.get('/api/v1/ai/providers/status/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("gemini", data)
        self.assertIn("ollama", data)
        self.assertIn("deterministic", data)
        self.assertTrue(data["deterministic"]["available"])

    def test_plan_api_missing_destination_returns_400(self):
        response = self.client.post('/api/v1/ai/plan/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_plan_api_unknown_destination_returns_404(self):
        response = self.client.post('/api/v1/ai/plan/', {'destination': 'nonexistent_city'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_plan_api_success_with_deterministic_fallback(self):
        # Both AI providers unconfigured/mocked offline -> deterministic succeeds
        payload = {
            "destination": "visakhapatnam",
            "interests": ["beaches", "culture"],
            "budget_per_day": 2500,
            "group_type": "Duo",
            "duration_days": 2,
            "preferred_pace": "Moderate",
            "save_to_db": True
        }
        response = self.client.post('/api/v1/ai/plan/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        self.assertEqual(data["destinationName"], "Visakhapatnam")
        self.assertEqual(data["durationDays"], 2)
        self.assertEqual(len(data["days"]), 2)
        self.assertEqual(data["aiProviderUsed"], "DETERMINISTIC")
        self.assertIn("expenses", data)
        self.assertEqual(data["expenses"]["totalPerDay"], 2500)
        self.assertEqual(data["expenses"]["totalTrip"], 5000)

        # Verified database persistence
        saved = Itinerary.objects.filter(destination=self.dest).first()
        self.assertIsNotNone(saved)
        self.assertEqual(saved.days.count(), 2)
        self.assertGreaterEqual(saved.days.first().stops.count(), 1)
        self.assertEqual(saved.expenses.total_trip, 5000)

    def test_regenerate_api_success(self):
        payload = {
            "destination": "visakhapatnam",
            "interests": ["beaches"],
            "budget_per_day": 2000,
            "duration_days": 1,
            "preferred_pace": "Relaxed"
        }
        response = self.client.post('/api/v1/ai/plan/regenerate/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data["days"]), 1)
        # Relaxed pace gives 2 stops
        self.assertEqual(len(data["days"][0]["stops"]), 2)

