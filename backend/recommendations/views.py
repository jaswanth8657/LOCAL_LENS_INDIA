from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes
from .services import RecommendationService

class RecommendationsAPIView(APIView):
    """
    Machine Learning Recommendation Engine API.
    Calculates TF-IDF cosine similarity, Haversine geographic proximity,
    budget compatibility, and multi-factor explainable ranking over verified places.
    """

    @extend_schema(
        summary="Generate ML-driven personalized travel recommendations",
        description="Extracts TF-IDF features from verified place descriptions and tags, computes cosine similarity against user interests, applies Haversine distance and budget constraints, and returns explainable scores.",
        parameters=[
            OpenApiParameter('destination', OpenApiTypes.STR, description="Destination slug (e.g. visakhapatnam, jaipur, kochi)", required=True),
            OpenApiParameter('interests', OpenApiTypes.STR, description="Comma-separated travel interests (e.g. beaches,food,history,nature)", required=False),
            OpenApiParameter('budget_per_day', OpenApiTypes.INT, description="User daily budget in INR (₹500 to ₹15,000+)", required=False),
            OpenApiParameter('group_type', OpenApiTypes.STR, description="Solo, Duo, Family, or Friends", required=False),
            OpenApiParameter('group_size', OpenApiTypes.INT, description="Number of travelers (default: 2)", required=False),
            OpenApiParameter('duration_days', OpenApiTypes.INT, description="Trip duration in days (1-21)", required=False),
            OpenApiParameter('latitude', OpenApiTypes.FLOAT, description="User current latitude for distance matching", required=False),
            OpenApiParameter('longitude', OpenApiTypes.FLOAT, description="User current longitude for distance matching", required=False),
            OpenApiParameter('radius_km', OpenApiTypes.FLOAT, description="Max search radius in kilometers", required=False),
            OpenApiParameter('sort_by', OpenApiTypes.STR, description="Sorting criteria: match (default), distance, price, name", required=False),
            OpenApiParameter('limit', OpenApiTypes.INT, description="Number of recommendations to return (default: 20)", required=False),
        ]
    )
    def get(self, request):
        dest_slug = request.query_params.get('destination', '').strip().lower()
        if not dest_slug:
            return Response(
                {"error": "The 'destination' parameter is required. Please specify a valid destination slug (e.g. 'visakhapatnam')."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Parse and sanitize query parameters
        raw_interests = request.query_params.get('interests', '')
        interests_list = [i.strip().lower() for i in raw_interests.split(',') if i.strip()]

        try:
            budget_per_day = int(request.query_params.get('budget_per_day', 2000))
            if budget_per_day <= 0:
                budget_per_day = 2000
        except ValueError:
            budget_per_day = 2000

        group_type = request.query_params.get('group_type', 'Duo').strip()

        try:
            group_size = max(1, min(20, int(request.query_params.get('group_size', 2))))
        except ValueError:
            group_size = 2
        
        try:
            duration_days = max(1, min(30, int(request.query_params.get('duration_days', 3))))
        except ValueError:
            duration_days = 3

        # Optional user coordinates
        user_lat = None
        user_lon = None
        raw_lat = request.query_params.get('latitude')
        raw_lon = request.query_params.get('longitude')
        if raw_lat and raw_lon:
            try:
                user_lat = float(raw_lat)
                user_lon = float(raw_lon)
            except ValueError:
                return Response(
                    {"error": "Invalid latitude or longitude format. Expected decimal numbers."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Optional radius filter
        radius_km = None
        raw_radius = request.query_params.get('radius_km')
        if raw_radius:
            try:
                radius_km = max(0.5, float(raw_radius))
            except ValueError:
                pass

        sort_by = request.query_params.get('sort_by', 'match').strip().lower()
        
        try:
            limit = max(1, min(100, int(request.query_params.get('limit', 20))))
        except ValueError:
            limit = 20

        # Execute Recommendation Service
        service = RecommendationService()
        result = service.get_recommendations(
            destination_slug=dest_slug,
            interests=interests_list,
            budget_per_day=budget_per_day,
            group_type=group_type,
            group_size=group_size,
            duration_days=duration_days,
            user_lat=user_lat,
            user_lon=user_lon,
            radius_km=radius_km,
            limit=limit,
            sort_by=sort_by
        )

        if 'error' in result:
            return Response(result, status=status.HTTP_404_NOT_FOUND)

        return Response(result, status=status.HTTP_200_OK)
