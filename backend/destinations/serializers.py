from rest_framework import serializers
from .models import Destination

class DestinationSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='slug', read_only=True)
    imageUrl = serializers.CharField(source='image_url', required=False, allow_blank=True)
    bestTimeToVisit = serializers.CharField(source='best_time_to_visit', required=False)
    averageDailyBudgetInr = serializers.IntegerField(source='average_daily_budget_inr')
    popularCategories = serializers.ListField(source='popular_categories', required=False)
    verifiedStatus = serializers.CharField(source='verification_status', required=False)
    placesCount = serializers.SerializerMethodField()

    def get_placesCount(self, obj) -> int:
        if hasattr(obj, 'places_count'):
            return obj.places_count
        return obj.places.count()

    class Meta:
        model = Destination
        fields = [
            'id',
            'slug',
            'name',
            'state',
            'region',
            'tagline',
            'description',
            'imageUrl',
            'bestTimeToVisit',
            'averageDailyBudgetInr',
            'latitude',
            'longitude',
            'popularCategories',
            'verifiedStatus',
            'placesCount',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

