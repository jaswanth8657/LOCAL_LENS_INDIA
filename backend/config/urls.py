from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path('admin/', admin.site.urls),

    # Versioned API Endpoints under /api/v1/
    path('api/v1/accounts/', include('accounts.urls')),
    path('api/v1/destinations/', include('destinations.urls')),
    path('api/v1/places/', include('places.urls')),
    path('api/v1/recommendations/', include('recommendations.urls')),
    path('api/v1/itineraries/', include('trips.urls')),
    path('api/v1/ai/', include('ai.urls')),

    # OpenAPI 3 Schema & Interactive Documentation
    path('api/v1/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/v1/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/v1/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

