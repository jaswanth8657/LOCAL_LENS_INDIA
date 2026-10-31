from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import PlaceViewSet, DataProvenanceLogViewSet, LivePlaceSearchAPIView, ImportExternalPlaceAPIView

router = DefaultRouter()
router.register(r'provenance', DataProvenanceLogViewSet, basename='provenance')
router.register(r'', PlaceViewSet, basename='place')

urlpatterns = [
    path('search/', LivePlaceSearchAPIView.as_view(), name='places-live-search'),
    path('import-external/', ImportExternalPlaceAPIView.as_view(), name='places-import-external'),
] + router.urls


