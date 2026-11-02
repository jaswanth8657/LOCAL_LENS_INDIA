import django_filters
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from .models import Place, DataProvenanceLog
from .serializers import PlaceSerializer, DataProvenanceLogSerializer
from .search_service import LivePlaceSearchService

class PlaceFilter(django_filters.FilterSet):
    destination = django_filters.CharFilter(field_name='destination__slug', lookup_expr='iexact')
    category = django_filters.CharFilter(field_name='category', lookup_expr='iexact')
    price_tier = django_filters.CharFilter(field_name='price_tier', lookup_expr='iexact')
    verification_status = django_filters.CharFilter(field_name='verification_status', lookup_expr='iexact')

    class Meta:
        model = Place
        fields = ['destination', 'category', 'price_tier', 'verification_status']


@extend_schema_view(
    list=extend_schema(summary="List all verified places with destination and category filtering"),
    retrieve=extend_schema(summary="Retrieve place details with full provenance records"),
    create=extend_schema(summary="Register a verified place record"),
)
class PlaceViewSet(viewsets.ModelViewSet):
    queryset = Place.objects.select_related('destination').prefetch_related('provenance_records').all()
    serializer_class = PlaceSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = PlaceFilter
    search_fields = ['name', 'address', 'description', 'subcategory']
    ordering_fields = ['match_score', 'ticket_price_inr', 'typical_cost_inr', 'name']
    ordering = ['-match_score', 'name']

    @action(detail=True, methods=['get'], url_path='provenance')
    def provenance(self, request, pk=None):
        """
        Return all immutable data provenance records for this place.
        """
        place = self.get_object()
        records = place.provenance_records.all().order_by('-retrieved_at')
        serializer = DataProvenanceLogSerializer(records, many=True)
        return Response({
            "placeId": place.id,
            "placeName": place.name,
            "verificationStatus": place.verification_status,
            "dataSource": place.data_source,
            "sourceUrl": place.source_url or None,
            "lastVerifiedAt": place.last_verified_at,
            "count": records.count(),
            "records": serializer.data,
        })


class DataProvenanceLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DataProvenanceLog.objects.select_related('place').all()
    serializer_class = DataProvenanceLogSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['place__id', 'verification_status', 'field_name']
    ordering = ['-retrieved_at']


class LivePlaceSearchAPIView(APIView):
    """
    Hybrid search combining verified SQLite records and live external OpenStreetMap POIs.
    Tag results with provenance labels ('Existing database record' or 'Live external search result').
    """

    @extend_schema(
        summary="Hybrid live place search across SQLite and external OpenStreetMap data",
        parameters=[
            OpenApiParameter('q', str, description="Search keyword"),
            OpenApiParameter('destination', str, description="Destination slug or name"),
            OpenApiParameter('category', str, description="Category filter"),
            OpenApiParameter('lat', float, description="Latitude for proximity search"),
            OpenApiParameter('lon', float, description="Longitude for proximity search"),
            OpenApiParameter('radius', int, description="Search radius in meters (default 15000)"),
            OpenApiParameter('limit', int, description="Maximum results count (default 25)"),
            OpenApiParameter('live', bool, description="Whether to query live external providers"),
        ],
        responses={200: dict}
    )
    def get(self, request):
        q = request.query_params.get('q')
        dest = request.query_params.get('destination') or request.query_params.get('destination_slug')
        cat = request.query_params.get('category')

        lat_val = request.query_params.get('lat')
        lon_val = request.query_params.get('lon')
        lat = float(lat_val) if lat_val is not None and lat_val != '' else None
        lon = float(lon_val) if lon_val is not None and lon_val != '' else None

        radius = int(request.query_params.get('radius', 15000))
        limit = int(request.query_params.get('limit', 25))
        live = request.query_params.get('live', 'true').lower() in ('true', '1', 'yes')

        service = LivePlaceSearchService()
        data = service.search_places(
            q=q,
            destination_slug=dest,
            category=cat,
            lat=lat,
            lon=lon,
            radius=radius,
            limit=limit,
            live=live
        )
        return Response(data, status=status.HTTP_200_OK)


class ImportExternalPlaceAPIView(APIView):
    """
    Explicitly persist an unverified live external place into the SQLite database.
    Guarantees user confirmation before committing external items to local storage.
    """

    @extend_schema(
        summary="Import live external place into SQLite with provenance logging",
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "destination_slug": {"type": "string"},
                    "category": {"type": "string"},
                    "latitude": {"type": "number"},
                    "longitude": {"type": "number"},
                    "address": {"type": "string"},
                    "source_record_id": {"type": "string"}
                },
                "required": ["name", "latitude", "longitude"]
            }
        },
        responses={201: dict, 400: dict}
    )
    def post(self, request):
        service = LivePlaceSearchService()
        try:
            result = service.import_external_place(request.data)
            status_code = status.HTTP_201_CREATED if result.get('created') else status.HTTP_200_OK
            return Response(result, status=status_code)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Import failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
