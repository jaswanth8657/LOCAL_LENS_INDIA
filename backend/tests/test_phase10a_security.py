import uuid
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from destinations.models import Destination
from places.models import Place
from trips.models import Itinerary, ItineraryDay, ItineraryStop, ExpenseBreakdown


class Phase10ASecurityAndDataIntegrityTests(TestCase):
    """
    Test suite verifying Phase 10A fixes:
    1. ExpenseBreakdownViewSet security & scoping (P1-SEC-01).
    2. Itinerary ownership isolation & guest privacy (P1-PRIV-01).
    3. Safe handling of non-numeric place IDs without HTTP 500 (P1-API-01).
    4. Continuous availability of guest read/planning endpoints.
    """

    def setUp(self):
        # Create User A
        self.user_a = User.objects.create_user(
            username="user_a",
            email="usera@example.com",
            password="PasswordA123!"
        )
        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.user_a)

        # Create User B
        self.user_b = User.objects.create_user(
            username="user_b",
            email="userb@example.com",
            password="PasswordB123!"
        )
        self.client_b = APIClient()
        self.client_b.force_authenticate(user=self.user_b)

        # Unauthenticated guest client
        self.guest_client = APIClient()

        # Seed test destination & places using exact model fields
        self.destination = Destination.objects.create(
            slug="visakhapatnam",
            name="Visakhapatnam",
            state="Andhra Pradesh",
            region="South",
            tagline="The City of Destiny",
            description="The City of Destiny on the eastern coast.",
            latitude=17.6868,
            longitude=83.2185,
            best_time_to_visit="October to March",
            average_daily_budget_inr=2500,
            verification_status="VERIFIED"
        )

        self.place_1 = Place.objects.create(
            destination=self.destination,
            name="Rishikonda Beach",
            category="beaches",
            description="Golden sands and water sports.",
            address="Beach Road, Visakhapatnam",
            latitude=17.7828,
            longitude=83.3852,
            ticket_price_inr=0,
            verification_status="VERIFIED"
        )

        self.place_2 = Place.objects.create(
            destination=self.destination,
            name="Submarine Museum",
            category="history",
            description="Decommissioned Russian submarine INS Kursura.",
            address="RK Beach, Visakhapatnam",
            latitude=17.7176,
            longitude=83.3330,
            ticket_price_inr=70,
            verification_status="VERIFIED"
        )

        # Create itinerary owned by User A with ExpenseBreakdown
        self.itin_a = Itinerary.objects.create(
            id=f"itin-a-{uuid.uuid4().hex[:8]}",
            title="User A Coastal Trip",
            destination_name="Visakhapatnam",
            group_type="solo",
            duration_days=2,
            daily_budget_inr=2500,
            total_budget_inr=5000,
            user=self.user_a,
            ai_provider_used="gemini"
        )
        self.expense_a = ExpenseBreakdown.objects.create(
            itinerary=self.itin_a,
            accommodation=2000,
            food_dining=1500,
            local_transport=800,
            sightseeing_tickets=400,
            buffer_contingency=300,
            total_per_day=2500,
            total_trip=5000,
            is_verified_basis=True
        )

        # Create itinerary owned by User B with ExpenseBreakdown
        self.itin_b = Itinerary.objects.create(
            id=f"itin-b-{uuid.uuid4().hex[:8]}",
            title="User B Coastal Trip",
            destination_name="Visakhapatnam",
            group_type="family",
            duration_days=3,
            daily_budget_inr=5000,
            total_budget_inr=15000,
            user=self.user_b,
            ai_provider_used="ollama"
        )
        self.expense_b = ExpenseBreakdown.objects.create(
            itinerary=self.itin_b,
            accommodation=6000,
            food_dining=4500,
            local_transport=2000,
            sightseeing_tickets=1500,
            buffer_contingency=1000,
            total_per_day=5000,
            total_trip=15000,
            is_verified_basis=True
        )

        # Create an unowned legacy itinerary (user=None)
        self.itin_unowned = Itinerary.objects.create(
            id=f"itin-legacy-{uuid.uuid4().hex[:8]}",
            title="Legacy Public Itinerary",
            destination_name="Visakhapatnam",
            group_type="couple",
            duration_days=2,
            daily_budget_inr=3000,
            total_budget_inr=6000,
            user=None,
            ai_provider_used="rule-based"
        )

    # 1. User A can access their own expense breakdown
    def test_01_user_a_can_access_own_expense_breakdown(self):
        url = f"/api/v1/itineraries/expenses/?itinerary__id={self.itin_a.id}"
        response = self.client_a.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        results = data.get("results", data)
        self.assertTrue(len(results) >= 1)
        self.assertEqual(results[0]["id"], self.expense_a.id)
        self.assertEqual(results[0]["totalTrip"], 5000)

        # Detail endpoint test
        detail_url = f"/api/v1/itineraries/expenses/{self.expense_a.id}/"
        detail_res = self.client_a.get(detail_url)
        self.assertEqual(detail_res.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_res.json()["totalTrip"], 5000)

    # 2. User B cannot access User A's expense breakdown
    def test_02_user_b_cannot_access_user_a_expense_breakdown(self):
        # Filtering by User A's itinerary should return empty list for User B
        url = f"/api/v1/itineraries/expenses/?itinerary__id={self.itin_a.id}"
        response = self.client_b.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        results = data.get("results", data)
        self.assertEqual(len(results), 0)

        # Direct detail access by User B to User A's expense must return 404
        detail_url = f"/api/v1/itineraries/expenses/{self.expense_a.id}/"
        detail_res = self.client_b.get(detail_url)
        self.assertEqual(detail_res.status_code, status.HTTP_404_NOT_FOUND)

    # 3. An unauthenticated guest cannot access private expenses
    def test_03_unauthenticated_guest_cannot_access_private_expenses(self):
        # List endpoint must reject with 401
        url = "/api/v1/itineraries/expenses/"
        res_list = self.guest_client.get(url)
        self.assertEqual(res_list.status_code, status.HTTP_401_UNAUTHORIZED)

        # Detail endpoint must reject with 401
        detail_url = f"/api/v1/itineraries/expenses/{self.expense_a.id}/"
        res_detail = self.guest_client.get(detail_url)
        self.assertEqual(res_detail.status_code, status.HTTP_401_UNAUTHORIZED)

    # 4. User A cannot retrieve User B's itinerary
    def test_04_user_a_cannot_retrieve_user_b_itinerary(self):
        url = f"/api/v1/itineraries/{self.itin_b.id}/"
        response = self.client_a.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # 5. User A cannot update or delete User B's itinerary
    def test_05_user_a_cannot_update_or_delete_user_b_itinerary(self):
        url = f"/api/v1/itineraries/{self.itin_b.id}/"
        # Update attempt
        patch_res = self.client_a.patch(url, {"title": "Hacked Title"}, format="json")
        self.assertEqual(patch_res.status_code, status.HTTP_404_NOT_FOUND)

        # Delete attempt
        del_res = self.client_a.delete(url)
        self.assertEqual(del_res.status_code, status.HTTP_404_NOT_FOUND)

        # Verify User B's trip unchanged
        self.itin_b.refresh_from_db()
        self.assertEqual(self.itin_b.title, "User B Coastal Trip")

    # 6. Guests cannot modify or delete unowned database itineraries
    def test_06_guests_cannot_modify_or_delete_unowned_database_itineraries(self):
        url = f"/api/v1/itineraries/{self.itin_unowned.id}/"
        # Guest PUT attempt
        put_res = self.guest_client.put(url, {"title": "Defaced Title"}, format="json")
        self.assertEqual(put_res.status_code, status.HTTP_401_UNAUTHORIZED)

        # Guest PATCH attempt
        patch_res = self.guest_client.patch(url, {"title": "Defaced Title"}, format="json")
        self.assertEqual(patch_res.status_code, status.HTTP_401_UNAUTHORIZED)

        # Guest DELETE attempt
        del_res = self.guest_client.delete(url)
        self.assertEqual(del_res.status_code, status.HTTP_401_UNAUTHORIZED)

        # Verify unowned itinerary remains intact
        self.itin_unowned.refresh_from_db()
        self.assertEqual(self.itin_unowned.title, "Legacy Public Itinerary")

        # Guest list query should not return all trips or leak them
        list_res = self.guest_client.get("/api/v1/itineraries/")
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        data = list_res.json()
        results = data.get("results", data)
        self.assertEqual(len(results), 0)

    # 7. Guests can still browse destinations and generate itineraries
    def test_07_guests_can_still_browse_destinations_and_generate_itineraries(self):
        # Destination list
        dest_res = self.guest_client.get("/api/v1/destinations/")
        self.assertEqual(dest_res.status_code, status.HTTP_200_OK)

        # Recommendations endpoint
        rec_res = self.guest_client.get("/api/v1/recommendations/?destination=visakhapatnam&pace=balanced")
        self.assertEqual(rec_res.status_code, status.HTTP_200_OK)

        # AI plan endpoint
        plan_res = self.guest_client.post(
            "/api/v1/ai/plan/",
            {
                "destination": "visakhapatnam",
                "interests": ["beaches", "history"],
                "budget_per_day": 2500,
                "group_type": "Duo",
                "duration_days": 2,
                "preferred_pace": "Moderate",
                "save_to_db": False
            },
            format="json"
        )
        self.assertEqual(plan_res.status_code, status.HTTP_200_OK)
        self.assertIn("days", plan_res.json())

    # 8. Authenticated users can save their own trips
    def test_08_authenticated_users_can_save_their_own_trips(self):
        payload = {
            "title": "Aarav's Vizag Weekend",
            "destinationName": "Visakhapatnam",
            "groupType": "friends",
            "durationDays": 2,
            "dailyBudgetInr": 2000,
            "totalBudgetInr": 4000,
            "aiProviderUsed": "gemini",
            "days": [
                {
                    "dayNumber": 1,
                    "theme": "Beach & Naval History",
                    "dayEstimatedCostInr": 2000,
                    "stops": [
                        {
                            "stopOrder": 1,
                            "timeSlot": "Morning",
                            "time": "09:00 AM",
                            "placeId": str(self.place_1.id),
                            "placeName": "Rishikonda Beach",
                            "category": "beaches",
                            "durationMinutes": 120,
                            "costInr": 0,
                            "costStatus": "free",
                            "localTips": "Enjoy the sunrise waves",
                            "transportToNext": "Auto rickshaw",
                            "latitude": 17.7828,
                            "longitude": 83.3852
                        }
                    ]
                }
            ],
            "expenses": {
                "accommodation": 1500,
                "foodDining": 1200,
                "localTransport": 600,
                "sightseeingTickets": 400,
                "bufferContingency": 300,
                "totalPerDay": 2000,
                "totalTrip": 4000,
                "isVerifiedBasis": True
            }
        }
        response = self.client_a.post("/api/v1/itineraries/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_id = response.json()["id"]

        # Confirm saved trip is owned by User A
        saved_itin = Itinerary.objects.get(id=created_id)
        self.assertEqual(saved_itin.user, self.user_a)
        self.assertEqual(saved_itin.days.count(), 1)
        self.assertEqual(saved_itin.days.first().stops.count(), 1)
        self.assertEqual(saved_itin.days.first().stops.first().place, self.place_1)
        self.assertIsNotNone(saved_itin.expenses)
        self.assertEqual(saved_itin.expenses.total_trip, 4000)

    # 9. Numeric place IDs are correctly linked to Place records
    def test_09_numeric_place_ids_correctly_linked_to_place_records(self):
        payload = {
            "title": "Numeric ID Trip",
            "destinationName": "Visakhapatnam",
            "groupType": "solo",
            "durationDays": 1,
            "dailyBudgetInr": 1500,
            "totalBudgetInr": 1500,
            "days": [
                {
                    "dayNumber": 1,
                    "theme": "Museum Day",
                    "dayEstimatedCostInr": 1500,
                    "stops": [
                        {
                            "stopOrder": 1,
                            "timeSlot": "Afternoon",
                            "time": "02:00 PM",
                            "placeId": self.place_2.id,  # Integer
                            "placeName": "Submarine Museum",
                            "category": "history",
                            "durationMinutes": 90,
                            "costInr": 70,
                            "costStatus": "paid",
                            "latitude": 17.7176,
                            "longitude": 83.3330
                        }
                    ]
                }
            ]
        }
        res = self.client_a.post("/api/v1/itineraries/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        created_id = res.json()["id"]
        saved = Itinerary.objects.get(id=created_id)
        stop = saved.days.first().stops.first()
        self.assertIsNotNone(stop.place)
        self.assertEqual(stop.place.id, self.place_2.id)
        self.assertEqual(stop.place_name, "Submarine Museum")

    # 10. Non-numeric and invalid place IDs do not crash API
    def test_10_non_numeric_and_invalid_place_ids_do_not_crash_api(self):
        non_numeric_ids = ["vizag-1", "place-visakhapatnam-0", "", "undefined", "null", "999999"]
        for test_id in non_numeric_ids:
            payload = {
                "title": f"Trip with ID {test_id}",
                "destinationName": "Visakhapatnam",
                "groupType": "solo",
                "durationDays": 1,
                "dailyBudgetInr": 1000,
                "totalBudgetInr": 1000,
                "days": [
                    {
                        "dayNumber": 1,
                        "theme": "Exploring",
                        "dayEstimatedCostInr": 1000,
                        "stops": [
                            {
                                "stopOrder": 1,
                                "timeSlot": "Morning",
                                "time": "10:00 AM",
                                "placeId": test_id,
                                "placeName": "Custom Stop",
                                "category": "custom",
                                "durationMinutes": 60,
                                "costInr": 0,
                                "costStatus": "free",
                                "latitude": 17.7,
                                "longitude": 83.3
                            }
                        ]
                    }
                ]
            }
            res = self.client_a.post("/api/v1/itineraries/", payload, format="json")
            # Must return 201 Created and NOT 500
            self.assertEqual(res.status_code, status.HTTP_201_CREATED, f"Failed for placeId: {test_id}")
            created_id = res.json()["id"]
            saved = Itinerary.objects.get(id=created_id)
            stop = saved.days.first().stops.first()
            # Place foreign key should be safely None
            self.assertIsNone(stop.place)
            self.assertEqual(stop.place_name, "Custom Stop")

    # 11. Existing database records remain intact
    def test_11_existing_database_records_remain_intact(self):
        dest_count = Destination.objects.count()
        place_count = Place.objects.count()
        self.assertGreaterEqual(dest_count, 1)
        self.assertGreaterEqual(place_count, 2)
        v = Destination.objects.filter(slug="visakhapatnam").first()
        self.assertIsNotNone(v)
        self.assertEqual(v.places.count(), 2)
