import uuid
from django.db import transaction
from rest_framework import serializers
from destinations.models import Destination
from places.models import Place
from .models import Itinerary, ItineraryDay, ItineraryStop, ExpenseBreakdown

class ExpenseBreakdownSerializer(serializers.ModelSerializer):
    foodDining = serializers.IntegerField(source='food_dining')
    localTransport = serializers.IntegerField(source='local_transport')
    sightseeingTickets = serializers.IntegerField(source='sightseeing_tickets')
    bufferContingency = serializers.IntegerField(source='buffer_contingency')
    totalPerDay = serializers.IntegerField(source='total_per_day')
    totalTrip = serializers.IntegerField(source='total_trip')
    isVerifiedBasis = serializers.BooleanField(source='is_verified_basis')

    class Meta:
        model = ExpenseBreakdown
        fields = [
            'id',
            'accommodation',
            'foodDining',
            'localTransport',
            'sightseeingTickets',
            'bufferContingency',
            'totalPerDay',
            'totalTrip',
            'isVerifiedBasis',
        ]


class ItineraryStopSerializer(serializers.ModelSerializer):
    stopOrder = serializers.IntegerField(source='stop_order')
    timeSlot = serializers.CharField(source='time_slot')
    placeId = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    placeName = serializers.CharField(source='place_name')
    durationMinutes = serializers.IntegerField(source='duration_minutes')
    costInr = serializers.IntegerField(source='cost_inr')
    costStatus = serializers.CharField(source='cost_status')
    localTips = serializers.CharField(source='local_tips', allow_blank=True, required=False)
    transportToNext = serializers.CharField(source='transport_to_next', allow_blank=True, required=False)

    class Meta:
        model = ItineraryStop
        fields = [
            'id',
            'stopOrder',
            'timeSlot',
            'time',
            'placeId',
            'placeName',
            'category',
            'durationMinutes',
            'costInr',
            'costStatus',
            'localTips',
            'transportToNext',
            'latitude',
            'longitude',
        ]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if instance.place_id:
            ret['placeId'] = str(instance.place_id)
        return ret


class ItineraryDaySerializer(serializers.ModelSerializer):
    dayNumber = serializers.IntegerField(source='day_number')
    dayEstimatedCostInr = serializers.IntegerField(source='day_estimated_cost_inr')
    stops = ItineraryStopSerializer(many=True, required=False)

    class Meta:
        model = ItineraryDay
        fields = [
            'id',
            'dayNumber',
            'theme',
            'date',
            'dayEstimatedCostInr',
            'stops',
        ]


class ItinerarySerializer(serializers.ModelSerializer):
    id = serializers.CharField(required=False)
    destinationName = serializers.CharField(source='destination_name')
    groupType = serializers.CharField(source='group_type')
    durationDays = serializers.IntegerField(source='duration_days')
    dailyBudgetInr = serializers.IntegerField(source='daily_budget_inr')
    totalBudgetInr = serializers.IntegerField(source='total_budget_inr')
    aiProviderUsed = serializers.CharField(source='ai_provider_used', required=False)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    days = ItineraryDaySerializer(many=True, required=False)
    expenses = ExpenseBreakdownSerializer(required=False)

    class Meta:
        model = Itinerary
        fields = [
            'id',
            'title',
            'destinationName',
            'groupType',
            'durationDays',
            'dailyBudgetInr',
            'totalBudgetInr',
            'aiProviderUsed',
            'createdAt',
            'days',
            'expenses',
        ]

    def create(self, validated_data):
        with transaction.atomic():
            days_data = validated_data.pop('days', [])
            expenses_data = validated_data.pop('expenses', None)

            # Auto-generate ID if missing
            itinerary_id = validated_data.get('id')
            if not itinerary_id:
                dest_name = validated_data.get('destination_name', 'trip')
                clean_dest = dest_name.lower().replace(' ', '-')
                itinerary_id = f"itin-{clean_dest}-{uuid.uuid4().hex[:8]}"
                validated_data['id'] = itinerary_id

            # If an itinerary with this ID already exists, replace it cleanly
            existing = Itinerary.objects.filter(id=itinerary_id).first()
            if existing:
                existing.delete()

            # Attempt to associate destination ForeignKey
            dest_name = validated_data.get('destination_name', '')
            if dest_name:
                dest_obj = Destination.objects.filter(name__iexact=dest_name).first()
                if not dest_obj:
                    dest_obj = Destination.objects.filter(slug=dest_name.lower().replace(' ', '-')).first()
                if dest_obj:
                    validated_data['destination'] = dest_obj

            itinerary = Itinerary.objects.create(**validated_data)

            if expenses_data:
                ExpenseBreakdown.objects.create(itinerary=itinerary, **expenses_data)

            for day_data in days_data:
                stops_data = day_data.pop('stops', [])
                day_obj = ItineraryDay.objects.create(itinerary=itinerary, **day_data)
                for stop_data in stops_data:
                    place_id = stop_data.pop('placeId', None)
                    place_obj = None
                    if place_id is not None:
                        place_id_str = str(place_id).strip()
                        if place_id_str.isdigit():
                            try:
                                place_obj = Place.objects.filter(id=int(place_id_str)).first()
                            except (ValueError, TypeError, OverflowError):
                                place_obj = None
                        else:
                            # Non-numeric placeId values (e.g. client fallbacks 'vizag-1', 'place-visakhapatnam-0')
                            # must not trigger an unhandled Django ValueError. place_obj safely remains None.
                            place_obj = None

                    ItineraryStop.objects.create(day=day_obj, place=place_obj, **stop_data)

            return itinerary

