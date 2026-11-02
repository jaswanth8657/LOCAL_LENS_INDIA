import logging
from typing import Dict, Any, List, Optional
from destinations.models import Destination
from places.models import Place
from .preprocessing import build_place_document, build_user_query_document
from .ml_engine import TFIDFRecommendationEngine
from .distance import haversine_distance_km, calculate_distance_score
from .scoring import RecommendationScorer

logger = logging.getLogger(__name__)

class RecommendationService:
    """
    High-level orchestrator for personalized travel recommendations.
    Connects Scikit-learn TF-IDF semantic matching, WGS84 distance calculation,
    budget fitting, and multi-factor explainability ranking.
    Supports both local database destinations and live-discovered external destinations.
    """

    def __init__(self):
        self.ml_engine = TFIDFRecommendationEngine()
        self.scorer = RecommendationScorer()

    def get_recommendations(
        self,
        destination_slug: str,
        interests: Optional[List[str]] = None,
        budget_per_day: int = 2000,
        group_type: str = 'Duo',
        group_size: int = 2,
        duration_days: int = 3,
        user_lat: Optional[float] = None,
        user_lon: Optional[float] = None,
        radius_km: Optional[float] = None,
        limit: int = 20,
        sort_by: str = 'match'
    ) -> Dict[str, Any]:
        destination = Destination.objects.filter(slug=destination_slug).first()
        is_live_dest = False
        dest_name = destination_slug.title()
        ref_lat = user_lat
        ref_lon = user_lon
        places = []

        if destination:
            ref_lat = user_lat if user_lat is not None else destination.latitude
            ref_lon = user_lon if user_lon is not None else destination.longitude
            places_qs = Place.objects.filter(destination=destination).select_related('destination').prefetch_related('provenance_records')
            places = list(places_qs)
            dest_name = destination.name
        else:
            # Live destination fallback for unseeded cities (e.g. Hyderabad, Bengaluru, Chandigarh)
            try:
                from data_providers.nominatim import NominatimProvider
                from places.search_service import LivePlaceSearchService
                nominatim = NominatimProvider()
                geocoded = nominatim.geocode_destination(f"{destination_slug}, India")
                if not geocoded:
                    geocoded = nominatim.geocode_destination(destination_slug)
                if geocoded:
                    is_live_dest = True
                    dest_name = geocoded.get('name') or destination_slug.title()
                    ref_lat = user_lat if user_lat is not None else geocoded['latitude']
                    ref_lon = user_lon if user_lon is not None else geocoded['longitude']

                    live_service = LivePlaceSearchService()
                    search_res = live_service.search_places(
                        destination_slug=destination_slug,
                        live=True,
                        limit=30
                    )
                    raw_pois = search_res.get('results', [])
                    for r in raw_pois:
                        class LivePlaceWrapper:
                            def __init__(self, d):
                                self.id = d.get('id')
                                self.name = d.get('name')
                                self.category = d.get('category', 'culture')
                                self.subcategory = d.get('subcategory', '')
                                self.description = d.get('description', '')
                                self.address = d.get('address', '')
                                self.latitude = d.get('latitude')
                                self.longitude = d.get('longitude')
                                self.price_tier = d.get('price_tier', 'Budget')
                                self.ticket_price_inr = d.get('ticket_price_inr')
                                self.typical_cost_inr = d.get('typical_cost_inr')
                                self.opening_hours = d.get('opening_hours', '')
                                self.rating = d.get('rating')
                                self.reviews_count = d.get('review_count', 0)
                                self.data_source = d.get('source_name', 'OpenStreetMap Live Discovery')
                                self.source_record_id = d.get('source_record_id', '')
                                self.source_url = d.get('source_url', '')
                                self.verification_status = d.get('verification_status', 'UNVERIFIED')
                                self.last_verified_at = None
                        places.append(LivePlaceWrapper(r))
            except Exception as e:
                logger.warning("Live recommendation discovery notice for '%s': %s", destination_slug, e)

        if not destination and not is_live_dest:
            return {
                'error': f"Destination '{destination_slug}' not found in database.",
                'recommendations': []
            }

        if not places:
            return {
                'destination': dest_name,
                'destinationSlug': destination_slug,
                'totalAvailablePlaces': 0,
                'recommendations': [],
                'weights': {
                    'similarity': self.scorer.w_similarity,
                    'category': self.scorer.w_category,
                    'budget': self.scorer.w_budget,
                    'distance': self.scorer.w_distance,
                    'quality': self.scorer.w_quality,
                }
            }

        user_interests = [i.strip().lower() for i in (interests or []) if i.strip()]

        # 1. Feature Extraction: Build place documents and user query document
        place_docs = []
        for p in places:
            doc = build_place_document({
                'name': p.name,
                'category': p.category,
                'subcategory': p.subcategory,
                'description': p.description,
                'address': p.address,
                'destination_name': dest_name,
            })
            place_docs.append(doc)

        user_query = build_user_query_document(user_interests)

        # 2. Machine Learning: TF-IDF Vectorization + Cosine Similarity
        similarity_scores = self.ml_engine.compute_similarity(place_docs, user_query)

        # 3. Spatial, Budget & Multi-Factor Scoring
        scored_results: List[Dict[str, Any]] = []

        for idx, place in enumerate(places):
            sim_score = similarity_scores[idx] if idx < len(similarity_scores) else 0.0

            # Distance calculation
            dist_km: Optional[float] = None
            if place.latitude is not None and place.longitude is not None and ref_lat is not None and ref_lon is not None:
                dist_km = haversine_distance_km(ref_lat, ref_lon, place.latitude, place.longitude)

            # Filter by radius if requested
            if radius_km is not None and dist_km is not None and dist_km > radius_km:
                continue

            dist_score = calculate_distance_score(dist_km, max_radius_km=radius_km or 30.0)

            # Combined multi-factor score
            eval_output = self.scorer.score_place(
                place=place,
                similarity_score=sim_score,
                user_interests=user_interests,
                distance_km=dist_km,
                distance_score=dist_score,
                daily_budget_inr=budget_per_day,
                group_type=group_type,
                group_size=group_size,
                duration_days=duration_days
            )

            # Format record for response
            scored_results.append({
                'id': place.id,
                'destinationId': destination.slug if destination else destination_slug,
                'name': place.name,
                'category': place.category,
                'subcategory': place.subcategory,
                'description': place.description,
                'address': place.address,
                'latitude': place.latitude,
                'longitude': place.longitude,
                'priceTier': place.price_tier,
                'ticketPriceInr': place.ticket_price_inr,
                'typicalCostInr': place.typical_cost_inr,
                'openingHours': place.opening_hours,
                'rating': place.rating,
                'reviewsCount': place.reviews_count,
                'dataSource': place.data_source,
                'sourceRecordId': place.source_record_id,
                'sourceUrl': place.source_url,
                'verificationStatus': place.verification_status,
                'lastVerifiedAt': place.last_verified_at.isoformat() if place.last_verified_at else None,
                'matchScore': eval_output['match_score'],
                'matchReason': eval_output['match_reason'],
                'matchedInterests': eval_output['matched_interests'],
                'distanceKm': eval_output['distance_km'],
                'scoringComponents': eval_output['components'],
            })

        # 4. Sorting
        if sort_by in ('price', 'budget_asc'):
            scored_results.sort(key=lambda x: (x['ticketPriceInr'] is None, x['ticketPriceInr'] or 0))
        elif sort_by in ('price_desc', 'budget_desc'):
            scored_results.sort(key=lambda x: (x['ticketPriceInr'] is not None, x['ticketPriceInr'] or 0), reverse=True)
        elif sort_by == 'rating':
            scored_results.sort(key=lambda x: (x['rating'] or 0), reverse=True)
        elif sort_by == 'distance':
            scored_results.sort(key=lambda x: (x['distanceKm'] is None, x['distanceKm'] or 9999))
        elif sort_by == 'name':
            scored_results.sort(key=lambda x: x['name'].lower())
        else:
            # Default: sort by matchScore descending
            scored_results.sort(key=lambda x: x['matchScore'], reverse=True)

        final_slice = scored_results[:limit]

        return {
            'destination': dest_name,
            'destinationSlug': destination.slug if destination else destination_slug,
            'userCriteria': {
                'interests': user_interests,
                'budgetPerDay': budget_per_day,
                'groupType': group_type,
                'groupSize': group_size,
                'durationDays': duration_days,
            },
            'userInterests': user_interests,
            'dailyBudgetInr': budget_per_day,
            'groupType': group_type,
            'groupSize': group_size,
            'durationDays': duration_days,
            'totalVerifiedPlaces': len(places),
            'totalAvailablePlaces': len(places),
            'returnedCount': len(final_slice),
            'weights': {
                'similarity': round(self.scorer.w_similarity, 3),
                'category': round(self.scorer.w_category, 3),
                'budget': round(self.scorer.w_budget, 3),
                'distance': round(self.scorer.w_distance, 3),
                'quality': round(self.scorer.w_quality, 3),
            },
            'recommendations': final_slice
        }
