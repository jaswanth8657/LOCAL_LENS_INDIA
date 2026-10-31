from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from destinations.models import Destination
from places.models import Place, DataProvenanceLog
from trips.models import Itinerary, ItineraryDay, ItineraryStop, ExpenseBreakdown

class DestinationModelAndAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.destination = Destination.objects.create(
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

    def test_destination_model_str(self):
        self.assertEqual(str(self.destination), "Visakhapatnam, Andhra Pradesh (South)")

    def test_destination_list_api(self):
        response = self.client.get('/api/v1/destinations/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Results can be paginated or list
        data = response.json()
        results = data.get('results', data)
        self.assertGreaterEqual(len(results), 1)
        first = results[0]
        self.assertEqual(first['name'], 'Visakhapatnam')
        self.assertEqual(first['id'], 'visakhapatnam')

    def test_destination_detail_api(self):
        response = self.client.get('/api/v1/destinations/visakhapatnam/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['name'], 'Visakhapatnam')
        self.assertEqual(response.json()['latitude'], 17.6868)

    def test_destination_filter_by_region(self):
        response = self.client.get('/api/v1/destinations/?region=South')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get('results', response.json())
        for dest in results:
            self.assertEqual(dest['region'], 'South')

    def test_destination_search(self):
        response = self.client.get('/api/v1/destinations/?search=Visakhapatnam')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get('results', response.json())
        self.assertTrue(any(d['name'] == 'Visakhapatnam' for d in results))


class PlaceAndProvenanceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.destination = Destination.objects.create(
            slug='jaipur',
            name='Jaipur',
            state='Rajasthan',
            region='North',
            tagline='The Pink City',
            description='Heritage royal capital.',
            latitude=26.9124,
            longitude=75.7873,
            average_daily_budget_inr=2200,
            verification_status='VERIFIED'
        )
        self.place = Place.objects.create(
            destination=self.destination,
            name='Hawa Mahal',
            category='history',
            subcategory='Rajput Architecture',
            description='Iconic palace of winds with honeycomb jharokhas.',
            address='Hawa Mahal Rd, Jaipur, Rajasthan 302002',
            latitude=26.9239,
            longitude=75.8267,
            price_tier='Budget',
            ticket_price_inr=50,
            typical_cost_inr=100,
            opening_hours='9:00 AM – 4:30 PM',
            data_source='Archaeological Survey of India',
            source_record_id='osm:way:24819021',
            source_url='https://asi.nic.in',
            verification_status='VERIFIED'
        )
        self.provenance = DataProvenanceLog.objects.create(
            place=self.place,
            field_name='ticket_price_inr',
            claimed_value='₹50 Indians',
            source_name='Archaeological Survey of India Tariff',
            source_url='https://asi.nic.in',
            verification_status='VERIFIED'
        )

    def test_place_provenance_relationship(self):
        self.assertEqual(self.place.provenance_records.count(), 1)
        prov = self.place.provenance_records.first()
        self.assertEqual(prov.field_name, 'ticket_price_inr')
        self.assertEqual(prov.verification_status, 'VERIFIED')

    def test_places_api_list_and_filter(self):
        response = self.client.get('/api/v1/places/?destination__slug=jaipur')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get('results', response.json())
        self.assertGreaterEqual(len(results), 1)
        self.assertEqual(results[0]['name'], 'Hawa Mahal')
        self.assertEqual(results[0]['ticketPriceInr'], 50)
        self.assertEqual(len(results[0]['provenance_records']), 1)

    def test_places_category_filter(self):
        response = self.client.get('/api/v1/places/?category=history')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get('results', response.json())
        self.assertTrue(all(p['category'] == 'history' for p in results))


class RecommendationEngineAPITests(TestCase):
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
            verification_status='VERIFIED'
        )
        Place.objects.create(
            destination=self.dest,
            name='INS Kursura Submarine Museum',
            category='history',
            description='Decommissioned submarine on the beach.',
            address='RK Beach Road, Visakhapatnam',
            latitude=17.7164,
            longitude=83.3331,
            ticket_price_inr=70,
            verification_status='VERIFIED'
        )
        Place.objects.create(
            destination=self.dest,
            name='Rushikonda Beach',
            category='beaches',
            description='Blue flag certified golden beach.',
            address='Rushikonda, Visakhapatnam',
            latitude=17.7818,
            longitude=83.3853,
            ticket_price_inr=0,
            verification_status='VERIFIED'
        )

    def test_recommendations_success(self):
        response = self.client.get('/api/v1/recommendations/?destination=visakhapatnam&interests=beaches,history&budget_per_day=2000')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['destination'], 'Visakhapatnam')
        self.assertEqual(data['totalVerifiedPlaces'], 2)
        recs = data['recommendations']
        self.assertGreaterEqual(len(recs), 2)
        # All recommendations have matchScore and matchReason
        for r in recs:
            self.assertIn('matchScore', r)
            self.assertIn('matchReason', r)

    def test_recommendations_missing_destination(self):
        response = self.client.get('/api/v1/recommendations/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.json())

    def test_recommendations_nonexistent_destination(self):
        response = self.client.get('/api/v1/recommendations/?destination=atlantis')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class ItineraryAndExpenseTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        from django.contrib.auth.models import User
        self.user = User.objects.create_user(username="test_api_user", password="Password123!", email="testapi@example.com")
        self.client.force_authenticate(user=self.user)

    def test_itinerary_creation_and_retrieval(self):
        payload = {
            "id": "trip-test-101",
            "title": "3-Day Vizag Heritage Trip",
            "destinationName": "Visakhapatnam",
            "groupType": "Duo",
            "durationDays": 3,
            "dailyBudgetInr": 2000,
            "totalBudgetInr": 6000,
            "aiProviderUsed": "Deterministic Non-AI",
            "expenses": {
                "accommodation": 2400,
                "foodDining": 1500,
                "localTransport": 900,
                "sightseeingTickets": 600,
                "bufferContingency": 600,
                "totalPerDay": 2000,
                "totalTrip": 6000,
                "isVerifiedBasis": True
            },
            "days": [
                {
                    "dayNumber": 1,
                    "theme": "Arrival & Maritime Heritage",
                    "dayEstimatedCostInr": 1900,
                    "stops": [
                        {
                            "stopOrder": 1,
                            "timeSlot": "Morning",
                            "time": "09:00 AM",
                            "placeName": "INS Kursura Submarine Museum",
                            "category": "history",
                            "durationMinutes": 90,
                            "costInr": 70,
                            "costStatus": "VERIFIED",
                            "localTips": "Arrive early to avoid queues."
                        }
                    ]
                }
            ]
        }

        # POST creation
        create_resp = self.client.post('/api/v1/itineraries/', payload, format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_resp.json()['id'], 'trip-test-101')

        # GET retrieval
        get_resp = self.client.get('/api/v1/itineraries/trip-test-101/')
        self.assertEqual(get_resp.status_code, status.HTTP_200_OK)
        data = get_resp.json()
        self.assertEqual(data['title'], "3-Day Vizag Heritage Trip")
        self.assertEqual(len(data['days']), 1)
        self.assertEqual(data['days'][0]['stops'][0]['placeName'], "INS Kursura Submarine Museum")
        self.assertEqual(data['expenses']['totalTrip'], 6000)

    def test_itinerary_invalid_payload(self):
        # Missing required fields
        response = self.client.post('/api/v1/itineraries/', {"invalid": "data"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_itinerary_auto_generates_id_and_persists(self):
        payload = {
            "title": "Jaipur Royal Explorer",
            "destinationName": "Jaipur",
            "groupType": "Solo",
            "durationDays": 2,
            "dailyBudgetInr": 3000,
            "totalBudgetInr": 6000,
            "days": [
                {
                    "dayNumber": 1,
                    "theme": "Palaces & Forts",
                    "dayEstimatedCostInr": 2800,
                    "stops": [
                        {
                            "stopOrder": 1,
                            "timeSlot": "Morning",
                            "time": "09:00 AM",
                            "placeName": "Amber Fort",
                            "category": "heritage",
                            "durationMinutes": 180,
                            "costInr": 100,
                            "costStatus": "VERIFIED",
                            "localTips": "Hire official ASI guide."
                        }
                    ]
                }
            ]
        }
        resp = self.client.post('/api/v1/itineraries/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        itin_id = resp.json()['id']
        self.assertTrue(itin_id.startswith('itin-jaipur-'))

        # Fetch it back
        get_resp = self.client.get(f'/api/v1/itineraries/{itin_id}/')
        self.assertEqual(get_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(get_resp.json()['days'][0]['stops'][0]['placeName'], 'Amber Fort')

        # Delete it
        del_resp = self.client.delete(f'/api/v1/itineraries/{itin_id}/')
        self.assertEqual(del_resp.status_code, status.HTTP_204_NO_CONTENT)

