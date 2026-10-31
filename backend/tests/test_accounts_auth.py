from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from trips.models import Itinerary

class AccountAuthenticationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/api/v1/accounts/register/'
        self.login_url = '/api/v1/accounts/login/'
        self.logout_url = '/api/v1/accounts/logout/'
        self.profile_url = '/api/v1/accounts/profile/'

    def test_successful_registration(self):
        payload = {
            "name": "Aarav Sharma",
            "email": "aarav@example.com",
            "password": "StrongPassword123!",
            "confirm_password": "StrongPassword123!"
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertIn("token", data)
        self.assertEqual(data["user"]["email"], "aarav@example.com")
        self.assertEqual(data["user"]["name"], "Aarav Sharma")
        self.assertEqual(data["profile"]["theme_preference"], "dark")

        # Verify in DB
        user = User.objects.filter(email="aarav@example.com").first()
        self.assertIsNotNone(user)
        self.assertTrue(user.check_password("StrongPassword123!"))

    def test_duplicate_email_rejection(self):
        # Register first
        self.client.post(self.register_url, {
            "name": "Existing User",
            "email": "duplicate@example.com",
            "password": "Password1234!",
            "confirm_password": "Password1234!"
        }, format='json')

        # Try duplicate email
        response = self.client.post(self.register_url, {
            "name": "Another User",
            "email": "duplicate@example.com",
            "password": "Password9999!",
            "confirm_password": "Password9999!"
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.json())

    def test_password_mismatch_rejection(self):
        response = self.client.post(self.register_url, {
            "name": "Test User",
            "email": "test@example.com",
            "password": "Password123!",
            "confirm_password": "DifferentPassword456!"
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("confirm_password", response.json())

    def test_successful_login_with_email(self):
        # Create user
        User.objects.create_user(username="priya_v", email="priya@example.com", password="SecretPassword123!")

        response = self.client.post(self.login_url, {
            "email_or_username": "priya@example.com",
            "password": "SecretPassword123!"
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("token", data)
        self.assertEqual(data["user"]["email"], "priya@example.com")

    def test_successful_login_with_username(self):
        User.objects.create_user(username="rohit_sharma", email="rohit@example.com", password="SecretPassword123!")

        response = self.client.post(self.login_url, {
            "email_or_username": "rohit_sharma",
            "password": "SecretPassword123!"
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.json())

    def test_incorrect_password_rejection(self):
        User.objects.create_user(username="test_user", email="test@example.com", password="CorrectPassword123!")

        response = self.client.post(self.login_url, {
            "email_or_username": "test@example.com",
            "password": "WrongPassword!"
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_logout_invalidates_token(self):
        user = User.objects.create_user(username="logout_user", email="logout@example.com", password="Password123!")
        # Login to get token
        login_res = self.client.post(self.login_url, {
            "email_or_username": "logout@example.com",
            "password": "Password123!"
        }, format='json')
        token = login_res.json()["token"]

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token}')
        logout_res = self.client.post(self.logout_url)
        self.assertEqual(logout_res.status_code, status.HTTP_200_OK)

        # Profile access after logout should now fail
        profile_res = self.client.get(self.profile_url)
        self.assertEqual(profile_res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_update_preferences_and_theme(self):
        user = User.objects.create_user(username="pref_user", email="pref@example.com", password="Password123!")
        login_res = self.client.post(self.login_url, {
            "email_or_username": "pref@example.com",
            "password": "Password123!"
        }, format='json')
        token = login_res.json()["token"]

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token}')
        update_res = self.client.put(self.profile_url, {
            "name": "Priya Varma",
            "theme_preference": "light",
            "budget_per_day": 4500,
            "group_type": "Family",
            "group_size": 4,
            "interests": ["culture", "beaches", "food"]
        }, format='json')

        self.assertEqual(update_res.status_code, status.HTTP_200_OK)
        data = update_res.json()
        self.assertEqual(data["theme_preference"], "light")
        self.assertEqual(data["budget_per_day"], 4500)
        self.assertEqual(data["group_type"], "Family")
        self.assertEqual(data["group_size"], 4)
        self.assertEqual(data["name"], "Priya Varma")

    def test_profile_patch_partial_update(self):
        user = User.objects.create_user(username="patch_user", email="patch@example.com", password="Password123!")
        profile = user.profile
        profile.name = "Initial Name"
        profile.budget_per_day = 3000
        profile.theme_preference = "dark"
        profile.group_type = "Solo"
        profile.save()

        login_res = self.client.post(self.login_url, {
            "email_or_username": "patch@example.com",
            "password": "Password123!"
        }, format='json')
        token = login_res.json()["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token}')

        # 1. Partial update only changing theme_preference
        patch_res = self.client.patch(self.profile_url, {
            "theme_preference": "light"
        }, format='json')
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        data = patch_res.json()
        self.assertEqual(data["theme_preference"], "light")
        # Ensure omitted fields were untouched
        self.assertEqual(data["name"], "Initial Name")
        self.assertEqual(data["budget_per_day"], 3000)
        self.assertEqual(data["group_type"], "Solo")

        # 2. Invalid choice rejected with 400
        bad_patch = self.client.patch(self.profile_url, {
            "theme_preference": "neon_blue"
        }, format='json')
        self.assertEqual(bad_patch.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("theme_preference", bad_patch.json())

    def test_unauthenticated_profile_access_returns_401(self):
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class UserItineraryIsolationTests(TestCase):
    def setUp(self):
        self.client_a = APIClient()
        self.client_b = APIClient()
        self.guest_client = APIClient()

        # User A
        self.user_a = User.objects.create_user(username="user_a", email="a@example.com", password="Password123!")
        token_a = self.client_a.post('/api/v1/accounts/login/', {"email_or_username": "a@example.com", "password": "Password123!"}, format='json').json()['token']
        self.client_a.credentials(HTTP_AUTHORIZATION=f'Token {token_a}')

        # User B
        self.user_b = User.objects.create_user(username="user_b", email="b@example.com", password="Password123!")
        token_b = self.client_b.post('/api/v1/accounts/login/', {"email_or_username": "b@example.com", "password": "Password123!"}, format='json').json()['token']
        self.client_b.credentials(HTTP_AUTHORIZATION=f'Token {token_b}')

    def test_user_a_saves_itinerary_and_user_b_cannot_access_or_modify_it(self):
        # User A saves an itinerary
        payload = {
            "title": "User A Private Vizag Tour",
            "destinationName": "Visakhapatnam",
            "groupType": "Solo",
            "durationDays": 1,
            "dailyBudgetInr": 2000,
            "totalBudgetInr": 2000,
            "days": [
                {
                    "dayNumber": 1,
                    "theme": "Beaches",
                    "dayEstimatedCostInr": 1800,
                    "stops": [
                        {
                            "stopOrder": 1,
                            "timeSlot": "Morning",
                            "time": "09:00 AM",
                            "placeName": "Rushikonda Beach",
                            "category": "beaches",
                            "durationMinutes": 90,
                            "costInr": 20,
                            "costStatus": "VERIFIED"
                        }
                    ]
                }
            ]
        }
        res_a = self.client_a.post('/api/v1/itineraries/', payload, format='json')
        self.assertEqual(res_a.status_code, status.HTTP_201_CREATED)
        itin_id = res_a.json()['id']

        # User A can retrieve their own itinerary
        get_a = self.client_a.get(f'/api/v1/itineraries/{itin_id}/')
        self.assertEqual(get_a.status_code, status.HTTP_200_OK)
        self.assertEqual(get_a.json()['title'], "User A Private Vizag Tour")

        # User B CANNOT retrieve User A's itinerary (returns 403 Forbidden or 404)
        get_b = self.client_b.get(f'/api/v1/itineraries/{itin_id}/')
        self.assertIn(get_b.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

        # User B CANNOT modify User A's itinerary
        put_b = self.client_b.put(f'/api/v1/itineraries/{itin_id}/', {"title": "Hacked Title"}, format='json')
        self.assertIn(put_b.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

        # User B CANNOT delete User A's itinerary
        del_b = self.client_b.delete(f'/api/v1/itineraries/{itin_id}/')
        self.assertIn(del_b.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

        # Guest client CANNOT access User A's private itinerary
        get_guest = self.guest_client.get(f'/api/v1/itineraries/{itin_id}/')
        self.assertIn(get_guest.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    def test_legacy_unowned_itinerary_remains_intact_and_readable(self):
        # Unowned itinerary in database
        itin = Itinerary.objects.create(
            id="itin-legacy-public-01",
            title="Public Legacy Itinerary",
            destination_name="Jaipur",
            group_type="Duo",
            duration_days=2,
            daily_budget_inr=3000,
            total_budget_inr=6000,
            user=None
        )

        # Guest client can view public legacy itineraries
        resp = self.guest_client.get('/api/v1/itineraries/itin-legacy-public-01/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()['title'], "Public Legacy Itinerary")

