import json
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from destinations.models import Destination
from places.models import Place, DataProvenanceLog

class Phase18TravelIntelligenceBackendTests(TestCase):
    """
    Tests for Phase 18 Travel Intelligence & Smart Discovery:
    - Pillar 3: Destination Comparison Endpoint (2 or 3 destinations, SQLite metrics, Catalog vs Live status).
    - Pillar 5: Place Data Provenance Endpoint (audit logs, timestamps, confidence levels).
    """

    def setUp(self):
        self.client = APIClient()

        # Seed 3 distinct destinations
        self.dest_vizag = Destination.objects.create(
            slug='visakhapatnam',
            name='Visakhapatnam',
            state='Andhra Pradesh',
            region='South',
            tagline='The Jewel of the East Coast',
            description='Coastal port city with beaches and hills.',
            latitude=17.6868,
            longitude=83.2185,
            best_time_to_visit='October to March',
            average_daily_budget_inr=2200,
            popular_categories=['beaches', 'nature', 'culture'],
            verification_status='VERIFIED',
        )

        self.dest_jaipur = Destination.objects.create(
            slug='jaipur',
            name='Jaipur',
            state='Rajasthan',
            region='North',
            tagline='The Pink City',
            description='Historic royal capital with forts and palaces.',
            latitude=26.9124,
            longitude=75.7873,
            best_time_to_visit='November to February',
            average_daily_budget_inr=2600,
            popular_categories=['history', 'culture', 'shopping'],
            verification_status='VERIFIED',
        )

        self.dest_hyderabad = Destination.objects.create(
            slug='hyderabad',
            name='Hyderabad',
            state='Telangana',
            region='South',
            tagline='City of Pearls',
            description='Metropolitan dynamic hub.',
            latitude=17.3850,
            longitude=78.4867,
            best_time_to_visit='October to March',
            average_daily_budget_inr=2800,
            popular_categories=['food', 'culture'],
            verification_status='VERIFIED',
        )

        # Add places to Vizag (Catalog Seeded)
        self.place_submarine = Place.objects.create(
            destination=self.dest_vizag,
            name='INS Kursura Submarine Museum',
            category='culture',
            subcategory='Museum',
            description='Decommissioned submarine museum on RK Beach.',
            address='RK Beach Road, Visakhapatnam',
            latitude=17.7169,
            longitude=83.3331,
            ticket_price_inr=70,
            typical_cost_inr=100,
            data_source='OpenStreetMap & Official Sources',
            verification_status='VERIFIED',
        )

        self.place_beach = Place.objects.create(
            destination=self.dest_vizag,
            name='Ramakrishna Beach Promenade',
            category='beaches',
            subcategory='Beach',
            description='Open beach promenade along the Bay of Bengal.',
            address='Beach Road, Visakhapatnam',
            latitude=17.7139,
            longitude=83.3235,
            ticket_price_inr=0,
            typical_cost_inr=50,
            data_source='OpenStreetMap & Official Sources',
            verification_status='VERIFIED',
        )

        # Add place to Jaipur (Catalog Seeded)
        self.place_amber = Place.objects.create(
            destination=self.dest_jaipur,
            name='Amber Palace & Fort',
            category='history',
            subcategory='Fort',
            description='Hilltop fort palace in Amer.',
            address='Amer, Jaipur',
            latitude=26.9855,
            longitude=75.8513,
            ticket_price_inr=100,
            typical_cost_inr=200,
            data_source='Archaeological Survey of India',
            verification_status='VERIFIED',
        )

        # Notice: Hyderabad has 0 places, making it a LIVE_DISCOVERY_TARGET

        # Add Data Provenance Logs for Submarine Museum
        self.prov_log_price = DataProvenanceLog.objects.create(
            place=self.place_submarine,
            field_name='ticket_price_inr',
            claimed_value='70',
            source_name='Andhra Pradesh Tourism Development Corporation (APTDC)',
            source_url='https://tourism.ap.gov.in',
            verification_status='VERIFIED',
            evidence_notes='Official adult admission tariff verified from state board.',
        )

        self.prov_log_coords = DataProvenanceLog.objects.create(
            place=self.place_submarine,
            field_name='coordinates',
            claimed_value='17.7169, 83.3331',
            source_name='OpenStreetMap Overpass API',
            source_url='https://www.openstreetmap.org/node/12345678',
            verification_status='VERIFIED',
            evidence_notes='High accuracy geocoded point on RK Beach.',
        )

    # -------------------------------------------------------------
    # PILLAR 3: DESTINATION COMPARISON WORKSPACE TESTS
    # -------------------------------------------------------------

    def test_compare_two_valid_destinations(self):
        """Test comparing 2 seeded destinations returns valid SQLite metrics."""
        url = '/api/v1/destinations/compare/?destinations=visakhapatnam,jaipur'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        self.assertEqual(data['count'], 2)
        dests = data['destinations']
        vizag = next(d for d in dests if d['slug'] == 'visakhapatnam')
        jaipur = next(d for d in dests if d['slug'] == 'jaipur')

        # Check Vizag metrics
        self.assertEqual(vizag['name'], 'Visakhapatnam')
        self.assertEqual(vizag['catalog_status'], 'CATALOG_SEEDED')
        self.assertIn('Catalog Seeded (2 Spots)', vizag['catalog_badge'])
        self.assertEqual(vizag['places_summary']['total_places'], 2)
        self.assertEqual(vizag['places_summary']['free_entry_count'], 1)
        self.assertEqual(vizag['places_summary']['paid_entry_count'], 1)
        self.assertEqual(vizag['places_summary']['avg_ticket_price_inr'], 70)

        # Check Jaipur metrics
        self.assertEqual(jaipur['name'], 'Jaipur')
        self.assertEqual(jaipur['catalog_status'], 'CATALOG_SEEDED')
        self.assertEqual(jaipur['places_summary']['total_places'], 1)
        self.assertEqual(jaipur['places_summary']['avg_ticket_price_inr'], 100)

    def test_compare_three_destinations_with_live_discovery_target(self):
        """Test comparing 3 destinations where one is a live-discovery destination (Hyderabad)."""
        url = '/api/v1/destinations/compare/?destinations=visakhapatnam,jaipur,hyderabad'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        self.assertEqual(data['count'], 3)
        dests = data['destinations']
        hyd = next(d for d in dests if d['slug'] == 'hyderabad')

        # Hyderabad has 0 seeded places -> Must be marked LIVE_DISCOVERY_TARGET
        self.assertEqual(hyd['catalog_status'], 'LIVE_DISCOVERY_TARGET')
        self.assertEqual(hyd['catalog_badge'], 'Live Discovery Target (Dynamic query on demand)')
        self.assertEqual(hyd['places_summary']['total_places'], 0)

    def test_compare_destinations_validation_limits(self):
        """Comparison requires between 2 and 3 destinations. 1 or 4 must return HTTP 400."""
        # 1 destination -> Bad Request
        res_one = self.client.get('/api/v1/destinations/compare/?destinations=visakhapatnam')
        self.assertEqual(res_one.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Comparison requires between 2 and 3 destinations.', res_one.json()['detail'])

        # 4 destinations -> Bad Request
        res_four = self.client.get('/api/v1/destinations/compare/?destinations=visakhapatnam,jaipur,kochi,hampi')
        self.assertEqual(res_four.status_code, status.HTTP_400_BAD_REQUEST)

    def test_compare_unregistered_destination_graceful_handling(self):
        """Test that non-existent destination in database does not crash and reports UNREGISTERED."""
        url = '/api/v1/destinations/compare/?destinations=visakhapatnam,atlantis'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        atlantis = next(d for d in data['destinations'] if d['slug'] == 'atlantis')
        self.assertEqual(atlantis['catalog_status'], 'UNREGISTERED')

    # -------------------------------------------------------------
    # PILLAR 5: DATA PROVENANCE & TRUST DRAWER TESTS
    # -------------------------------------------------------------

    def test_get_place_provenance_records(self):
        """Test GET /api/v1/places/<id>/provenance/ returns immutable audit records."""
        url = f'/api/v1/places/{self.place_submarine.id}/provenance/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        self.assertEqual(data['placeId'], self.place_submarine.id)
        self.assertEqual(data['placeName'], 'INS Kursura Submarine Museum')
        self.assertEqual(data['verificationStatus'], 'VERIFIED')
        self.assertEqual(data['count'], 2)
        self.assertEqual(len(data['records']), 2)

        # Verify field contents
        fields = [r['field_name'] for r in data['records']]
        self.assertIn('ticket_price_inr', fields)
        self.assertIn('coordinates', fields)

        price_record = next(r for r in data['records'] if r['field_name'] == 'ticket_price_inr')
        self.assertEqual(price_record['claimed_value'], '70')
        self.assertEqual(price_record['source_name'], 'Andhra Pradesh Tourism Development Corporation (APTDC)')
        self.assertEqual(price_record['verification_status'], 'VERIFIED')
        self.assertIn('Official adult admission tariff', price_record['evidence_notes'])

    def test_get_place_provenance_nonexistent_returns_404(self):
        """Test provenance request for a nonexistent place ID returns HTTP 404."""
        url = '/api/v1/places/999999/provenance/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

