from django.db.models import Count
from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view
from .models import Destination
from .serializers import DestinationSerializer

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

