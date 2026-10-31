from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from destinations.models import Destination
from places.models import Place
from ai.chat import AIChatbotService

class AIChatbotServiceUnitAndIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.service = AIChatbotService()
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
            description='Blue flag certified golden sand beach famous for watersports.',
            address='Rushikonda, Visakhapatnam',
            latitude=17.7820,
            longitude=83.3850,
            ticket_price_inr=20,
            typical_cost_inr=100,
            opening_hours='06:00-19:00',
            rating=4.5,
            verification_status='VERIFIED'
        )
        self.p2 = Place.objects.create(
            destination=self.dest,
            name='INS Kursura Submarine Museum',
            category='culture',
            description='Preserved naval museum on RK Beach.',
            address='RK Beach, Visakhapatnam',
            latitude=17.7155,
            longitude=83.3330,
            ticket_price_inr=70,
            typical_cost_inr=100,
            opening_hours='14:00-20:30',
            rating=4.7,
            verification_status='VERIFIED'
        )

    def test_empty_message_raises_value_error(self):
        with self.assertRaises(ValueError):
            self.service.handle_message("")

    def test_destinations_query_lists_available_cities(self):
        res = self.service.handle_message("What destinations can I visit in India?")
        self.assertEqual(res["intent"], "destinations_list")
        self.assertIn("Visakhapatnam", res["reply"])

    def test_grounded_place_query_in_visakhapatnam(self):
        res = self.service.handle_message(
            message="What are the best beaches in Visakhapatnam?",
            destination_slug="visakhapatnam"
        )
        self.assertEqual(res["intent"], "place_query")
        self.assertEqual(res["destination"]["name"], "Visakhapatnam")
        self.assertIn("Rushikonda Beach", res["reply"])
        self.assertGreaterEqual(len(res["places"]), 1)
        self.assertEqual(res["places"][0]["name"], "Rushikonda Beach")
        self.assertEqual(res["places"][0]["ticketPriceInr"], 20)

    def test_itinerary_intent_invokes_planner_service(self):
        res = self.service.handle_message("Can you plan a 2-day trip to Vizag with 3000 daily budget?")
        self.assertEqual(res["intent"], "itinerary_plan")
        self.assertEqual(res["destination"]["slug"], "visakhapatnam")
        self.assertIn("itinerary", res)
        itinerary = res["itinerary"]
        self.assertEqual(itinerary["durationDays"], 2)
        self.assertEqual(itinerary["dailyBudgetInr"], 3000)
        self.assertEqual(len(itinerary["days"]), 2)

    def test_chat_api_endpoint_success(self):
        payload = {
            "message": "Tell me about places to visit in Visakhapatnam",
            "destination": "visakhapatnam"
        }
        response = self.client.post('/api/v1/ai/chat/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("reply", data)
        self.assertIn("places", data)

    def test_chat_api_endpoint_empty_message_returns_400(self):
        response = self.client.post('/api/v1/ai/chat/', {"message": "   "}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.json())

