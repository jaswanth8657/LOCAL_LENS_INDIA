from rest_framework.routers import DefaultRouter
from .views import ItineraryViewSet, ExpenseBreakdownViewSet

router = DefaultRouter()
router.register(r'expenses', ExpenseBreakdownViewSet, basename='expense')
router.register(r'', ItineraryViewSet, basename='itinerary')

urlpatterns = router.urls

