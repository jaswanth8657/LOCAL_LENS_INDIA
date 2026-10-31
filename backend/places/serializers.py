from rest_framework import serializers
from .models import Place, DataProvenanceLog

class DataProvenanceLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataProvenanceLog
        fields = [
            'id',
            'place',
            'field_name',
            'claimed_value',
            'source_name',
            'source_url',
            'retrieved_at',
            'verification_status',
            'evidence_notes',
        ]
        read_only_fields = ['retrieved_at']


class PlaceSerializer(serializers.ModelSerializer):
    destinationId = serializers.CharField(source='destination.slug', read_only=True)
    destination_slug = serializers.CharField(write_only=True, required=False)
    priceTier = serializers.CharField(source='price_tier')
    typicalCostInr = serializers.IntegerField(source='typical_cost_inr', required=False, allow_null=True)
    ticketPriceInr = serializers.IntegerField(source='ticket_price_inr', required=False, allow_null=True)
    openingHours = serializers.CharField(source='opening_hours', required=False, allow_blank=True)
    reviewsCount = serializers.IntegerField(source='reviews_count', required=False)
    matchScore = serializers.IntegerField(source='match_score', required=False)
    matchReason = serializers.CharField(source='match_reason', required=False, allow_blank=True)
    dataSource = serializers.CharField(source='data_source', required=False)
    sourceRecordId = serializers.CharField(source='source_record_id', required=False, allow_blank=True)
    sourceUrl = serializers.CharField(source='source_url', required=False, allow_blank=True)
    verificationStatus = serializers.CharField(source='verification_status', required=False)
    lastVerifiedAt = serializers.DateTimeField(source='last_verified_at', read_only=True)
    provenance_records = DataProvenanceLogSerializer(many=True, read_only=True)

    class Meta:
        model = Place
        fields = [
            'id',
            'destinationId',
            'destination_slug',
            'name',
            'category',
            'subcategory',
            'description',
            'address',
            'latitude',
            'longitude',
            'priceTier',
            'typicalCostInr',
            'ticketPriceInr',
            'openingHours',
            'rating',
            'reviewsCount',
            'matchScore',
            'matchReason',
            'dataSource',
            'sourceRecordId',
            'sourceUrl',
            'verificationStatus',
            'lastVerifiedAt',
            'provenance_records',
        ]

