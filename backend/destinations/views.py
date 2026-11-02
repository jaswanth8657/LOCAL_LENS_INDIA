import re
import logging
from django.db.models import Count
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view
from .models import Destination
from .serializers import DestinationSerializer

logger = logging.getLogger(__name__)

INDIAN_REGIONS_BY_STATE = {
    'andhra pradesh': 'South',
    'telangana': 'South',
    'karnataka': 'South',
    'tamil nadu': 'South',
    'kerala': 'South',
    'puducherry': 'South',
    'goa': 'South',
    'delhi': 'North',
    'punjab': 'North',
    'haryana': 'North',
    'himachal pradesh': 'North',
    'uttarakhand': 'North',
    'uttar pradesh': 'North',
    'rajasthan': 'North',
    'chandigarh': 'North',
    'jammu and kashmir': 'North',
    'ladakh': 'North',
    'maharashtra': 'West',
    'gujarat': 'West',
    'west bengal': 'East',
    'odisha': 'East',
    'bihar': 'East',
    'jharkhand': 'East',
    'assam': 'North-East',
    'meghalaya': 'North-East',
    'manipur': 'North-East',
    'mizoram': 'North-East',
    'nagaland': 'North-East',
    'tripura': 'North-East',
    'arunachal pradesh': 'North-East',
    'sikkim': 'North-East',
    'madhya pradesh': 'Central',
    'chhattisgarh': 'Central',
}

def infer_indian_region(state_name: str, latitude: float) -> str:
    clean_state = (state_name or '').lower().strip()
    for state_key, region_val in INDIAN_REGIONS_BY_STATE.items():
        if state_key in clean_state or clean_state in state_key:
            return region_val
    if latitude < 18.0:
        return 'South'
    if latitude > 24.0:
        return 'North'
    return 'Central'

@extend_schema_view(
    list=extend_schema(summary="List all verified destinations with region and category filtering"),
    retrieve=extend_schema(summary="Retrieve detailed destination record by slug or id"),
    create=extend_schema(summary="Register a verified destination record"),
)
class DestinationViewSet(viewsets.ModelViewSet):
    queryset = Destination.objects.annotate(places_count=Count('places')).order_by('name')
    serializer_class = DestinationSerializer
    lookup_field = 'slug'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['region', 'state', 'verification_status']
    search_fields = ['name', 'state', 'description', 'tagline']
    ordering_fields = ['name', 'average_daily_budget_inr', 'created_at']
    ordering = ['name']

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        search_term = request.query_params.get('search') or request.query_params.get('q')

        # If searching and local database has no matches, perform live geographic discovery via Nominatim
        if search_term and not response.data:
            clean_search = search_term.strip()
            try:
                from data_providers.nominatim import NominatimProvider
                nominatim = NominatimProvider()
                geocoded = nominatim.geocode_destination(f"{clean_search}, India")
                if not geocoded:
                    geocoded = nominatim.geocode_destination(clean_search)

                if geocoded:
                    state = geocoded.get('state') or 'India'
                    lat = geocoded['latitude']
                    lon = geocoded['longitude']
                    region = infer_indian_region(state, lat)
                    name = geocoded['name']
                    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

                    live_dest = {
                        "id": slug,
                        "slug": slug,
                        "name": name,
                        "state": state,
                        "region": region,
                        "tagline": f"Live discovered destination in {state}",
                        "description": f"Real-world Indian destination discovered live via OpenStreetMap ({geocoded.get('display_name', '')[:100]}).",
                        "imageUrl": "",
                        "bestTimeToVisit": "October to March",
                        "averageDailyBudgetInr": 2500,
                        "latitude": lat,
                        "longitude": lon,
                        "popularCategories": ["culture", "food", "history"],
                        "verifiedStatus": "UNVERIFIED",
                        "placesCount": 0,
                        "isExternal": True,
                        "resultType": "live_external",
                        "provenanceLabel": "Live external discovery",
                    }
                    return Response([live_dest])
            except Exception as e:
                logger.warning("Live destination lookup notice for '%s': %s", clean_search, e)

        return response

    def retrieve(self, request, *args, **kwargs):
        lookup_value = kwargs.get('slug', '').strip().lower()
        dest = Destination.objects.filter(slug=lookup_value).first()
        if dest:
            return super().retrieve(request, *args, **kwargs)

        # Unseeded destination fallback lookup
        try:
            from data_providers.nominatim import NominatimProvider
            nominatim = NominatimProvider()
            geocoded = nominatim.geocode_destination(f"{lookup_value}, India")
            if not geocoded:
                geocoded = nominatim.geocode_destination(lookup_value)

            if geocoded:
                state = geocoded.get('state') or 'India'
                lat = geocoded['latitude']
                lon = geocoded['longitude']
                region = infer_indian_region(state, lat)
                name = geocoded['name']
                slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

                return Response({
                    "id": slug,
                    "slug": slug,
                    "name": name,
                    "state": state,
                    "region": region,
                    "tagline": f"Live discovered destination in {state}",
                    "description": f"Real-world Indian destination discovered live via OpenStreetMap.",
                    "imageUrl": "",
                    "bestTimeToVisit": "October to March",
                    "averageDailyBudgetInr": 2500,
                    "latitude": lat,
                    "longitude": lon,
                    "popularCategories": ["culture", "food", "history"],
                    "verifiedStatus": "UNVERIFIED",
                    "placesCount": 0,
                    "isExternal": True,
                    "resultType": "live_external",
                    "provenanceLabel": "Live external discovery",
                })
        except Exception as e:
            logger.warning("Retrieve live destination lookup notice for '%s': %s", lookup_value, e)

        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'], url_path='compare')
    def compare(self, request):
        """
        Compare 2 or 3 destinations with factual SQLite metrics and catalog status.
        Query parameter: ?destinations=visakhapatnam,jaipur or ?destinations=visakhapatnam&destinations=jaipur
        """
        raw_destinations = request.query_params.getlist('destinations')
        slugs = []
        for raw in raw_destinations:
            if ',' in raw:
                slugs.extend([s.strip().lower() for s in raw.split(',') if s.strip()])
            elif raw.strip():
                slugs.append(raw.strip().lower())

        if len(slugs) < 2 or len(slugs) > 3:
            return Response(
                {"detail": "Comparison requires between 2 and 3 destinations."},
                status=status.HTTP_400_BAD_REQUEST
            )

        results = []
        for slug in slugs:
            dest = Destination.objects.filter(slug__iexact=slug).first()
            if not dest:
                dest = Destination.objects.filter(name__iexact=slug).first()

            if not dest:
                results.append({
                    "slug": slug,
                    "name": slug.title(),
                    "state": "Unknown",
                    "region": "India",
                    "tagline": "Destination not found in catalog",
                    "description": "This destination is not registered in the database.",
                    "imageUrl": "",
                    "best_time_to_visit": "October to March",
                    "average_daily_budget_inr": 2500,
                    "popular_categories": [],
                    "catalog_status": "UNREGISTERED",
                    "catalog_badge": "Unregistered Destination",
                    "places_summary": {
                        "total_places": 0,
                        "categories_distribution": {},
                        "free_entry_count": 0,
                        "paid_entry_count": 0,
                        "price_unavailable_count": 0,
                        "avg_ticket_price_inr": 0,
                    },
                    "climate_summary": {
                        "ideal_season": "October to March",
                        "outdoor_places_count": 0,
                        "indoor_sheltered_count": 0,
                    }
                })
                continue

            places = dest.places.all()
            total_places = places.count()

            categories_dist = {}
            for p in places:
                cat = p.category or 'other'
                categories_dist[cat] = categories_dist.get(cat, 0) + 1

            free_count = places.filter(ticket_price_inr=0).count()
            paid_places = places.filter(ticket_price_inr__gt=0)
            paid_count = paid_places.count()
            unavail_count = places.filter(ticket_price_inr__isnull=True).count()

            avg_ticket = 0
            if paid_count > 0:
                total_ticket = sum(p.ticket_price_inr for p in paid_places if p.ticket_price_inr)
                avg_ticket = round(total_ticket / paid_count)

            outdoor_count = 0
            indoor_count = 0
            for p in places:
                cat_lower = (p.category or '').lower()
                name_lower = (p.name or '').lower()
                if any(w in cat_lower or w in name_lower for w in ['beach', 'nature', 'park', 'ghat', 'viewpoint', 'fort', 'outdoor', 'waterfall', 'lake']):
                    outdoor_count += 1
                else:
                    indoor_count += 1

            if total_places > 0:
                catalog_status = "CATALOG_SEEDED"
                catalog_badge = f"Catalog Seeded ({total_places} Spots)"
            else:
                catalog_status = "LIVE_DISCOVERY_TARGET"
                catalog_badge = "Live Discovery Target (Dynamic query on demand)"

            results.append({
                "slug": dest.slug,
                "name": dest.name,
                "state": dest.state,
                "region": dest.region,
                "tagline": dest.tagline,
                "description": dest.description,
                "imageUrl": dest.image_url,
                "best_time_to_visit": dest.best_time_to_visit,
                "average_daily_budget_inr": dest.average_daily_budget_inr,
                "popular_categories": dest.popular_categories or [],
                "catalog_status": catalog_status,
                "catalog_badge": catalog_badge,
                "places_summary": {
                    "total_places": total_places,
                    "categories_distribution": categories_dist,
                    "free_entry_count": free_count,
                    "paid_entry_count": paid_count,
                    "price_unavailable_count": unavail_count,
                    "avg_ticket_price_inr": avg_ticket,
                },
                "climate_summary": {
                    "ideal_season": dest.best_time_to_visit,
                    "outdoor_places_count": outdoor_count,
                    "indoor_sheltered_count": indoor_count,
                }
            })

        return Response({
            "count": len(results),
            "destinations": results
        })
