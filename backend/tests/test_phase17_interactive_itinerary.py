import math
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from destinations.models import Destination
from places.models import Place
from trips.models import Itinerary, ItineraryDay, ItineraryStop, ExpenseBreakdown

User = get_user_model()

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Standard Haversine formula calculation in kilometers."""
    R = 6371.0  # Earth's mean radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 2)


class Phase17InteractiveItineraryTests(TestCase):
    """
    Test suite for Phase 17 Interactive Itinerary Workspace:
    - Stop reordering within a day
    - Moving stops between days
    - Adding and deleting stops
    - Ensuring Place records are NEVER deleted
    - Permissions & ownership validation
    - Haversine distance calculation correctness
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='p17_traveler',
            email='p17_traveler@example.com',
            password='TestPassword123!'
        )
        self.other_user = User.objects.create_user(
            username='other_traveler',
            email='other_traveler@example.com',
            password='TestPassword123!'
        )

        self.destination = Destination.objects.create(
            name='Visakhapatnam',
            slug='visakhapatnam',
            state='Andhra Pradesh',
            latitude=17.6868,
            longitude=83.2185
        )

        self.place1 = Place.objects.create(
            name='Kailasagiri Hilltop Park',
            destination=self.destination,
            category='nature',
            latitude=17.7492,
            longitude=83.3422,
            ticket_price_inr=20
        )
        self.place2 = Place.objects.create(
            name='Submarine Museum',
            destination=self.destination,
            category='culture',
            latitude=17.7169,
            longitude=83.3331,
            ticket_price_inr=70
        )
        self.place3 = Place.objects.create(
            name='Ramakrishna Beach',
            destination=self.destination,
            category='beaches',
            latitude=17.7139,
            longitude=83.3235,
            ticket_price_inr=0
        )

        # Create an existing itinerary owned by self.user
        self.itinerary = Itinerary.objects.create(
            id='itin-test-p17-001',
            user=self.user,
            title='Test 2-Day Vizag Adventure',
            destination_name='Visakhapatnam',
            destination=self.destination,
            group_type='Solo',
            duration_days=2,
            daily_budget_inr=2000,
            total_budget_inr=4000,
            ai_provider_used='DETERMINISTIC'
        )

        self.expense = ExpenseBreakdown.objects.create(
            itinerary=self.itinerary,
            accommodation=1200,
            food_dining=1000,
            local_transport=600,
            sightseeing_tickets=600,
            buffer_contingency=600,
            total_per_day=2000,
            total_trip=4000,
            is_verified_basis=True
        )

        # Day 1: 2 stops (place1, place2)
        self.day1 = ItineraryDay.objects.create(
            itinerary=self.itinerary,
            day_number=1,
            theme='Coast & Hills',
            day_estimated_cost_inr=90
        )
        self.stop1 = ItineraryStop.objects.create(
            day=self.day1,
            stop_order=1,
            time_slot='Morning',
            time='09:00 AM',
            place=self.place1,
            place_name=self.place1.name,
            category='nature',
            duration_minutes=90,
            cost_inr=20,
            cost_status='VERIFIED',
            latitude=self.place1.latitude,
            longitude=self.place1.longitude
        )
        self.stop2 = ItineraryStop.objects.create(
            day=self.day1,
            stop_order=2,
            time_slot='Afternoon',
            time='01:30 PM',
            place=self.place2,
            place_name=self.place2.name,
            category='culture',
            duration_minutes=60,
            cost_inr=70,
            cost_status='VERIFIED',
            latitude=self.place2.latitude,
            longitude=self.place2.longitude
        )

        # Day 2: 1 stop (place3)
        self.day2 = ItineraryDay.objects.create(
            itinerary=self.itinerary,
            day_number=2,
            theme='Beachside Stroll',
            day_estimated_cost_inr=0
        )
        self.stop3 = ItineraryStop.objects.create(
            day=self.day2,
            stop_order=1,
            time_slot='Morning',
            time='10:00 AM',
            place=self.place3,
            place_name=self.place3.name,
            category='beaches',
            duration_minutes=90,
            cost_inr=0,
            cost_status='VERIFIED',
            latitude=self.place3.latitude,
            longitude=self.place3.longitude
        )

    def test_haversine_formula_accuracy(self):
        """Verify Haversine straight-line distance returns plausible values for Vizag points."""
        # Submarine Museum (17.7169, 83.3331) to RK Beach (17.7139, 83.3235) is roughly 1.0 - 1.2 km
        dist = haversine_distance_km(17.7169, 83.3331, 17.7139, 83.3235)
        self.assertGreater(dist, 0.8)
        self.assertLess(dist, 1.5)

        # Distance to self is 0.0
        self.assertEqual(haversine_distance_km(17.7169, 83.3331, 17.7169, 83.3331), 0.0)

    def test_reorder_stops_within_day(self):
        """Updating itinerary stops with inverted stop_order persists correctly."""
        self.client.force_authenticate(user=self.user)

        payload = {
            'id': self.itinerary.id,
            'title': 'Test 2-Day Vizag Adventure (Reordered)',
            'destinationName': 'Visakhapatnam',
            'groupType': 'Solo',
            'durationDays': 2,
            'dailyBudgetInr': 2000,
            'totalBudgetInr': 4000,
            'days': [
                {
                    'dayNumber': 1,
                    'theme': 'Coast & Hills',
                    'dayEstimatedCostInr': 90,
                    'stops': [
                        {
                            'stopOrder': 1,
                            'timeSlot': 'Morning',
                            'time': '09:00 AM',
                            'placeId': str(self.place2.id),
                            'placeName': self.place2.name,
                            'category': 'culture',
                            'durationMinutes': 60,
                            'costInr': 70,
                            'costStatus': 'VERIFIED',
                            'latitude': self.place2.latitude,
                            'longitude': self.place2.longitude
                        },
                        {
                            'stopOrder': 2,
                            'timeSlot': 'Afternoon',
                            'time': '01:30 PM',
                            'placeId': str(self.place1.id),
                            'placeName': self.place1.name,
                            'category': 'nature',
                            'durationMinutes': 90,
                            'costInr': 20,
                            'costStatus': 'VERIFIED',
                            'latitude': self.place1.latitude,
                            'longitude': self.place1.longitude
                        }
                    ]
                },
                {
                    'dayNumber': 2,
                    'theme': 'Beachside Stroll',
                    'dayEstimatedCostInr': 0,
                    'stops': [
                        {
                            'stopOrder': 1,
                            'timeSlot': 'Morning',
                            'time': '10:00 AM',
                            'placeId': str(self.place3.id),
                            'placeName': self.place3.name,
                            'category': 'beaches',
                            'durationMinutes': 90,
                            'costInr': 0,
                            'costStatus': 'VERIFIED',
                            'latitude': self.place3.latitude,
                            'longitude': self.place3.longitude
                        }
                    ]
                }
            ]
        }

        url = f'/api/v1/itineraries/{self.itinerary.id}/'
        response = self.client.put(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify DB records
        self.itinerary.refresh_from_db()
        self.assertEqual(self.itinerary.title, 'Test 2-Day Vizag Adventure (Reordered)')

        day1_stops = self.itinerary.days.get(day_number=1).stops.order_by('stop_order')
        self.assertEqual(day1_stops.count(), 2)
        self.assertEqual(day1_stops[0].place_name, self.place2.name)
        self.assertEqual(day1_stops[0].stop_order, 1)
        self.assertEqual(day1_stops[1].place_name, self.place1.name)
        self.assertEqual(day1_stops[1].stop_order, 2)

        # Crucial check: underlying Place records were not deleted
        self.assertTrue(Place.objects.filter(id=self.place1.id).exists())
        self.assertTrue(Place.objects.filter(id=self.place2.id).exists())
        self.assertTrue(Place.objects.filter(id=self.place3.id).exists())

    def test_move_stop_between_days(self):
        """Move stop2 from Day 1 to Day 2."""
        self.client.force_authenticate(user=self.user)

        payload = {
            'id': self.itinerary.id,
            'title': self.itinerary.title,
            'destinationName': 'Visakhapatnam',
            'groupType': 'Solo',
            'durationDays': 2,
            'dailyBudgetInr': 2000,
            'totalBudgetInr': 4000,
            'days': [
                {
                    'dayNumber': 1,
                    'theme': 'Coast & Hills',
                    'dayEstimatedCostInr': 20,
                    'stops': [
                        {
                            'stopOrder': 1,
                            'timeSlot': 'Morning',
                            'time': '09:00 AM',
                            'placeId': str(self.place1.id),
                            'placeName': self.place1.name,
                            'category': 'nature',
                            'durationMinutes': 90,
                            'costInr': 20,
                            'costStatus': 'VERIFIED',
                            'latitude': self.place1.latitude,
                            'longitude': self.place1.longitude
                        }
                    ]
                },
                {
                    'dayNumber': 2,
                    'theme': 'Beachside & Heritage',
                    'dayEstimatedCostInr': 70,
                    'stops': [
                        {
                            'stopOrder': 1,
                            'timeSlot': 'Morning',
                            'time': '10:00 AM',
                            'placeId': str(self.place3.id),
                            'placeName': self.place3.name,
                            'category': 'beaches',
                            'durationMinutes': 90,
                            'costInr': 0,
                            'costStatus': 'VERIFIED',
                            'latitude': self.place3.latitude,
                            'longitude': self.place3.longitude
                        },
                        {
                            'stopOrder': 2,
                            'timeSlot': 'Afternoon',
                            'time': '02:00 PM',
                            'placeId': str(self.place2.id),
                            'placeName': self.place2.name,
                            'category': 'culture',
                            'durationMinutes': 60,
                            'costInr': 70,
                            'costStatus': 'VERIFIED',
                            'latitude': self.place2.latitude,
                            'longitude': self.place2.longitude
                        }
                    ]
                }
            ]
        }

        url = f'/api/v1/itineraries/{self.itinerary.id}/'
        response = self.client.put(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.itinerary.refresh_from_db()
        day1 = self.itinerary.days.get(day_number=1)
        day2 = self.itinerary.days.get(day_number=2)

        self.assertEqual(day1.stops.count(), 1)
        self.assertEqual(day2.stops.count(), 2)
        self.assertEqual(day2.stops.order_by('stop_order')[1].place_name, self.place2.name)

    def test_delete_stop_from_itinerary(self):
        """Deleting a stop leaves remaining stops and does not delete Place."""
        self.client.force_authenticate(user=self.user)

        payload = {
            'id': self.itinerary.id,
            'title': self.itinerary.title,
            'destinationName': 'Visakhapatnam',
            'groupType': 'Solo',
            'durationDays': 2,
            'dailyBudgetInr': 2000,
            'totalBudgetInr': 4000,
            'days': [
                {
                    'dayNumber': 1,
                    'theme': 'Coast & Hills',
                    'dayEstimatedCostInr': 20,
                    'stops': [
                        {
                            'stopOrder': 1,
                            'timeSlot': 'Morning',
                            'time': '09:00 AM',
                            'placeId': str(self.place1.id),
                            'placeName': self.place1.name,
                            'category': 'nature',
                            'durationMinutes': 90,
                            'costInr': 20,
                            'costStatus': 'VERIFIED',
                            'latitude': self.place1.latitude,
                            'longitude': self.place1.longitude
                        }
                    ]
                },
                {
                    'dayNumber': 2,
                    'theme': 'Beachside Stroll',
                    'dayEstimatedCostInr': 0,
                    'stops': []
                }
            ]
        }

        url = f'/api/v1/itineraries/{self.itinerary.id}/'
        response = self.client.put(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.itinerary.refresh_from_db()
        self.assertEqual(self.itinerary.days.get(day_number=1).stops.count(), 1)
        self.assertEqual(self.itinerary.days.get(day_number=2).stops.count(), 0)

        # Place 2 was removed from the itinerary, but MUST still exist in database
        self.assertTrue(Place.objects.filter(id=self.place2.id).exists())
        self.assertTrue(Place.objects.filter(id=self.place3.id).exists())

    def test_unauthenticated_or_non_owner_cannot_update(self):
        """Verify strict authorization: unauthenticated gets 401, non-owner gets 403 or 404."""
        url = f'/api/v1/itineraries/{self.itinerary.id}/'
        payload = {'title': 'Hacked Title'}

        # Unauthenticated
        response = self.client.put(url, payload, format='json')
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

        # Non-owner
        self.client.force_authenticate(user=self.other_user)
        response = self.client.put(url, payload, format='json')
        self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])
