import math
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from destinations.models import Destination
from places.models import Place
from recommendations.preprocessing import clean_text, expand_synonyms, build_place_document, build_user_query_document
from recommendations.distance import haversine_distance_km, calculate_distance_score
from recommendations.ml_engine import TFIDFRecommendationEngine
from recommendations.scoring import RecommendationScorer
from recommendations.services import RecommendationService


class PreprocessingUnitTests(TestCase):
    def test_clean_text_removes_punctuation_and_lowercases(self):
        raw = "Kailasagiri Hilltop Park! Features scenic views & cable-car @ ₹150."
        cleaned = clean_text(raw)
        self.assertNotIn("!", cleaned)
        self.assertNotIn("&", cleaned)
        self.assertNotIn("@", cleaned)
        self.assertEqual(cleaned, "kailasagiri hilltop park features scenic views cable car 150")

    def test_synonym_expansion_for_known_categories(self):
        exp_beach = expand_synonyms("beaches")
        self.assertIn("beach", exp_beach)
        self.assertIn("coastal", exp_beach)
        self.assertIn("sea", exp_beach)

        exp_food = expand_synonyms("food")
        self.assertIn("cuisine", exp_food)
        self.assertIn("street", exp_food)
        self.assertIn("thali", exp_food)

    def test_build_place_document_concatenates_metadata(self):
        data = {
            'name': 'Rushikonda Beach',
            'category': 'beaches',
            'subcategory': 'watersports',
            'description': 'Golden sand beach popular for swimming and surfing.',
            'address': 'Beach Road, Visakhapatnam',
            'destination_name': 'Visakhapatnam'
        }
        doc = build_place_document(data)
        self.assertIn('rushikonda beach', doc)
        self.assertIn('beaches', doc)
        self.assertIn('watersports', doc)
        self.assertIn('golden sand', doc)
        self.assertIn('visakhapatnam', doc)

    def test_build_user_query_document_includes_synonyms(self):
        interests = ['history', 'temples']
        query_doc = build_user_query_document(interests)
        self.assertIn('history', query_doc)
        self.assertIn('heritage', query_doc)
        self.assertIn('temples', query_doc)
        self.assertIn('mandir', query_doc)


class HaversineDistanceUnitTests(TestCase):
    def test_haversine_same_point_is_zero(self):
        dist = haversine_distance_km(17.6868, 83.2185, 17.6868, 83.2185)
        self.assertAlmostEqual(dist, 0.0, places=3)

    def test_haversine_known_distance(self):
        # Visakhapatnam center to Rushikonda Beach (~12-14 km)
        vizag_center = (17.6868, 83.2185)
        rushikonda = (17.7820, 83.3850)
        dist = haversine_distance_km(vizag_center[0], vizag_center[1], rushikonda[0], rushikonda[1])
        self.assertGreater(dist, 10.0)
        self.assertLess(dist, 25.0)

    def test_distance_score_decay(self):
        score_at_zero = calculate_distance_score(0.0)
        score_at_10km = calculate_distance_score(10.0)
        score_at_50km = calculate_distance_score(50.0)
        score_none = calculate_distance_score(None)

        self.assertAlmostEqual(score_at_zero, 1.0, places=2)
        self.assertGreater(score_at_10km, score_at_50km)
        self.assertEqual(score_none, 0.5)


class TFIDFRankingUnitTests(TestCase):
    def setUp(self):
        self.engine = TFIDFRecommendationEngine()
        self.docs = [
            "rushikonda beach golden sands coastline watersports swimming surfing ocean waves",
            "kailasagiri hilltop park ropeway panoramic view nature garden scenic overlook",
            "ins kursura submarine museum heritage naval history maritime exhibits war memorial"
        ]

    def test_compute_similarity_beach_query(self):
        user_query = "beach ocean surfing waves coast"
        scores = self.engine.compute_similarity(self.docs, user_query)
        self.assertEqual(len(scores), 3)
        # First doc (Rushikonda beach) must score highest
        self.assertGreater(scores[0], scores[1])
        self.assertGreater(scores[0], scores[2])
        self.assertGreater(scores[0], 0.15)

    def test_compute_similarity_history_museum_query(self):
        user_query = "submarine naval war museum maritime history"
        scores = self.engine.compute_similarity(self.docs, user_query)
        # Third doc (Submarine museum) must score highest
        self.assertGreater(scores[2], scores[0])
        self.assertGreater(scores[2], scores[1])

    def test_compute_similarity_empty_query_returns_neutral(self):
        scores = self.engine.compute_similarity(self.docs, "")
        self.assertEqual(scores, [0.0, 0.0, 0.0])

    def test_compute_similarity_empty_docs(self):
        scores = self.engine.compute_similarity([], "beach")
        self.assertEqual(scores, [])


class RecommendationScorerUnitTests(TestCase):
    def setUp(self):
        self.scorer = RecommendationScorer()
        self.destination = Destination.objects.create(
            slug='visakhapatnam',
            name='Visakhapatnam',
            state='Andhra Pradesh',
            region='South',
            tagline='City of Destiny',
            description='Coastal gem',
            latitude=17.6868,
            longitude=83.2185,
            average_daily_budget_inr=2000,
            verification_status='VERIFIED'
        )
        self.free_place = Place.objects.create(
            destination=self.destination,
            name='Ramakrishna Beach',
            category='beaches',
            description='Popular public promenade beach with evening food stalls.',
            latitude=17.7120,
            longitude=83.3150,
            ticket_price_inr=0,
            typical_cost_inr=0,
            price_tier='FREE',
            verification_status='VERIFIED',
            rating=4.5,
            reviews_count=200
        )
        self.expensive_place = Place.objects.create(
            destination=self.destination,
            name='Luxury Deep Sea Yacht Cruise',
            category='adventure',
            description='Exclusive yacht rental package along Andhra coast.',
            latitude=17.7250,
            longitude=83.3350,
            ticket_price_inr=4500,
            typical_cost_inr=5000,
            price_tier='LUXURY',
            verification_status='VERIFIED',
            rating=4.8,
            reviews_count=45
        )

    def test_scorer_weights_sum_to_one(self):
        total_w = (
            self.scorer.w_similarity +
            self.scorer.w_category +
            self.scorer.w_budget +
            self.scorer.w_distance +
            self.scorer.w_quality
        )
        self.assertAlmostEqual(total_w, 1.0, places=5)

    def test_free_place_budget_score(self):
        eval_free = self.scorer.score_place(
            place=self.free_place,
            similarity_score=0.8,
            user_interests=['beaches'],
            distance_km=2.0,
            distance_score=0.9,
            daily_budget_inr=1500
        )
        self.assertEqual(eval_free['components']['budget_score'], 1.0)
        self.assertGreaterEqual(eval_free['match_score'], 80)
        self.assertIn("Free public access", eval_free['match_reason'])
        self.assertIn("Beaches", eval_free['match_reason'])

    def test_expensive_place_budget_score_penalized(self):
        eval_exp = self.scorer.score_place(
            place=self.expensive_place,
            similarity_score=0.5,
            user_interests=['adventure'],
            distance_km=5.0,
            distance_score=0.7,
            daily_budget_inr=1000
        )
        # Place entry of 4500 exceeds daily budget of 1000, should be discounted
        self.assertLess(eval_exp['components']['budget_score'], 0.5)


class RecommendationServiceAndAPIIntegrationTests(TestCase):
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
            popular_categories=['beaches', 'culture', 'heritage', 'food'],
            verification_status='VERIFIED'
        )
        self.place1 = Place.objects.create(
            destination=self.destination,
            name='Rushikonda Beach',
            category='beaches',
            subcategory='watersports',
            description='Blue-flag certified golden sand beach famous for watersports, sea kayaking and surfing.',
            address='Rushikonda, Visakhapatnam',
            latitude=17.7820,
            longitude=83.3850,
            price_tier='BUDGET',
            ticket_price_inr=20,
            typical_cost_inr=100,
            verification_status='VERIFIED',
            rating=4.5,
            reviews_count=320
        )
        self.place2 = Place.objects.create(
            destination=self.destination,
            name='INS Kursura Submarine Museum',
            category='culture',
            subcategory='museum',
            description='Decommissioned Soviet-built Kalvari-class submarine preserved as an onshore naval museum along RK Beach.',
            address='RK Beach Road, Visakhapatnam',
            latitude=17.7155,
            longitude=83.3330,
            price_tier='BUDGET',
            ticket_price_inr=70,
            typical_cost_inr=100,
            verification_status='VERIFIED',
            rating=4.7,
            reviews_count=850
        )
        self.place3 = Place.objects.create(
            destination=self.destination,
            name='Borra Caves',
            category='nature',
            subcategory='caves',
            description='Million-year-old limestone karst caves with stalactites and stalagmites in Ananthagiri hills.',
            address='Ananthagiri Hills, Araku Valley',
            latitude=18.2800,
            longitude=83.0400,
            price_tier='MODERATE',
            ticket_price_inr=110,
            typical_cost_inr=250,
            verification_status='VERIFIED',
            rating=4.6,
            reviews_count=410
        )

    def test_missing_destination_param_returns_400(self):
        response = self.client.get('/api/v1/recommendations/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.json())

    def test_nonexistent_destination_returns_404(self):
        response = self.client.get('/api/v1/recommendations/?destination=atlantis')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_recommendations_beach_interest_ranks_rushikonda_first(self):
        response = self.client.get('/api/v1/recommendations/?destination=visakhapatnam&interests=beaches,watersports,surfing')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['destinationSlug'], 'visakhapatnam')
        self.assertEqual(data['totalVerifiedPlaces'], 3)
        recs = data['recommendations']
        self.assertEqual(len(recs), 3)

        # Rushikonda Beach should be #1
        self.assertEqual(recs[0]['name'], 'Rushikonda Beach')
        self.assertGreater(recs[0]['matchScore'], recs[1]['matchScore'])
        self.assertIn('beaches', recs[0]['matchedInterests'])
        self.assertIn('matchReason', recs[0])
        self.assertIn('scoringComponents', recs[0])

    def test_recommendations_history_museum_interest_ranks_submarine_first(self):
        response = self.client.get('/api/v1/recommendations/?destination=visakhapatnam&interests=heritage,museum,history')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        recs = data['recommendations']
        self.assertEqual(recs[0]['name'], 'INS Kursura Submarine Museum')

    def test_recommendations_radius_filter(self):
        # Borra Caves is ~90km away from Vizag center (17.6868, 83.2185)
        # Search radius of 20km should include Rushikonda and Kursura but exclude Borra Caves
        response = self.client.get('/api/v1/recommendations/?destination=visakhapatnam&radius_km=25')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        names = [r['name'] for r in data['recommendations']]
        self.assertIn('Rushikonda Beach', names)
        self.assertIn('INS Kursura Submarine Museum', names)
        self.assertNotIn('Borra Caves', names)

    def test_recommendations_sorting_by_price(self):
        # Rushikonda (20), Kursura (70), Borra Caves (110)
        response = self.client.get('/api/v1/recommendations/?destination=visakhapatnam&sort_by=price')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        recs = response.json()['recommendations']
        prices = [r['ticketPriceInr'] for r in recs]
        self.assertEqual(prices, [20, 70, 110])

    def test_recommendations_sorting_by_name(self):
        response = self.client.get('/api/v1/recommendations/?destination=visakhapatnam&sort_by=name')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        recs = response.json()['recommendations']
        names = [r['name'] for r in recs]
        self.assertEqual(names, sorted(names, key=lambda x: x.lower()))

    def test_invalid_lat_lon_returns_400(self):
        response = self.client.get('/api/v1/recommendations/?destination=visakhapatnam&latitude=invalid&longitude=83.2')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_dynamic_recommendations_respond_to_budget_changes(self):
        # On a very low budget (₹400/day), cheap place (Rushikonda ₹20) gets a much higher budget score than Borra Caves (₹110)
        res_low = self.client.get('/api/v1/recommendations/?destination=visakhapatnam&budget_per_day=400')
        self.assertEqual(res_low.status_code, status.HTTP_200_OK)
        low_data = res_low.json()
        self.assertEqual(low_data['userCriteria']['budgetPerDay'], 400)
        recs_low = low_data['recommendations']

        res_high = self.client.get('/api/v1/recommendations/?destination=visakhapatnam&budget_per_day=10000')
        self.assertEqual(res_high.status_code, status.HTTP_200_OK)
        high_data = res_high.json()
        self.assertEqual(high_data['userCriteria']['budgetPerDay'], 10000)
        recs_high = high_data['recommendations']

        # Budget scores should differ between low and high budget runs
        rushikonda_low = next(r for r in recs_low if r['name'] == 'Rushikonda Beach')
        rushikonda_high = next(r for r in recs_high if r['name'] == 'Rushikonda Beach')
        borra_low = next(r for r in recs_low if r['name'] == 'Borra Caves')
        borra_high = next(r for r in recs_high if r['name'] == 'Borra Caves')

        # Borra Caves takes a larger percentage of a ₹400 budget than ₹10000
        self.assertLess(borra_low['scoringComponents']['budget_score'], borra_high['scoringComponents']['budget_score'])

    def test_dynamic_recommendations_support_group_size(self):
        res = self.client.get('/api/v1/recommendations/?destination=visakhapatnam&group_type=Family&group_size=5')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertEqual(data['userCriteria']['groupSize'], 5)
        self.assertEqual(data['userCriteria']['groupType'], 'Family')
