from rest_framework import viewsets, filters, permissions
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view
from .models import Itinerary, ExpenseBreakdown
from .serializers import ItinerarySerializer, ExpenseBreakdownSerializer

class IsItineraryOwnerOrPublic(permissions.BasePermission):
    """
    Strict itinerary access policy:
    - User-owned itineraries: Access and modifications are strictly restricted to the owning authenticated user.
    - Unowned legacy itineraries: Read-only safe methods allowed for specific detail lookup;
      modifications and deletions are strictly prohibited for all callers.
    """
    def has_object_permission(self, request, view, obj):
        if obj.user is None:
            # Unowned legacy itineraries are strictly read-only; never modifiable or deletable
            return request.method in permissions.SAFE_METHODS
        # User-owned itineraries: strictly the owning authenticated user
        return request.user.is_authenticated and obj.user == request.user


class IsExpenseBreakdownOwner(permissions.BasePermission):
    """
    Ensure expense breakdowns are accessible only to the authenticated owner of the parent itinerary.
    """
    def has_object_permission(self, request, view, obj):
        return (
            request.user.is_authenticated and
            obj.itinerary is not None and
            obj.itinerary.user == request.user
        )


@extend_schema_view(
    list=extend_schema(summary="List saved travel itineraries for the authenticated user"),
    retrieve=extend_schema(summary="Retrieve an itinerary with day-by-day stops and budget breakdown"),
    create=extend_schema(summary="Save a new generated or customized itinerary (authentication required)"),
)
class ItineraryViewSet(viewsets.ModelViewSet):
    serializer_class = ItinerarySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['group_type', 'duration_days']
    search_fields = ['title', 'destination_name']
    ordering_fields = ['created_at', 'total_budget_inr']
    ordering = ['-created_at']

    def get_permissions(self):
        # Require authentication for new database persistence and write operations
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsItineraryOwnerOrPublic()]
        return [IsItineraryOwnerOrPublic()]

    def get_queryset(self):
        user = self.request.user
        qs = Itinerary.objects.prefetch_related('days__stops', 'expenses')
        if user and user.is_authenticated:
            # Authenticated users retrieve strictly their own saved itineraries
            return qs.filter(user=user)
        # Guests must not retrieve all user=None itineraries in list
        if self.action == 'list':
            return qs.none()
        # For specific detail retrieval of legacy unowned trips
        return qs.filter(user__isnull=True)

    def perform_create(self, serializer):
        # Enforce that created itineraries are strictly bound to the authenticated user
        serializer.save(user=self.request.user)


class ExpenseBreakdownViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ExpenseBreakdownSerializer
    permission_classes = [permissions.IsAuthenticated, IsExpenseBreakdownOwner]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['itinerary__id']
    ordering = ['-id']

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return ExpenseBreakdown.objects.none()
        # Restrict strictly to expense records for itineraries owned by the authenticated caller
        return ExpenseBreakdown.objects.select_related('itinerary').filter(itinerary__user=user).order_by('-id')


