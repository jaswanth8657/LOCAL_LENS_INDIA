from django.db import models
from destinations.models import Destination

class Place(models.Model):
    CATEGORY_CHOICES = [
        ('history', 'History & Heritage'),
        ('culture', 'Culture & Arts'),
        ('nature', 'Nature & Outdoors'),
        ('beaches', 'Beaches & Coast'),
        ('food', 'Culinary & Street Food'),
        ('shopping', 'Shopping & Bazaars'),
        ('adventure', 'Adventure & Trekking'),
        ('photography', 'Photography & Views'),
        ('stay', 'Stay & Accommodation'),
        ('temple', 'Temple & Spiritual'),
    ]

    PRICE_TIER_CHOICES = [
        ('Budget', 'Budget (₹)'),
        ('Moderate', 'Moderate (₹₹)'),
        ('Premium', 'Premium (₹₹₹)'),
        ('Luxury', 'Luxury (₹₹₹₹)'),
    ]

    VERIFICATION_CHOICES = [
        ('VERIFIED', 'Verified Data'),
        ('ESTIMATED', 'Estimated Data'),
        ('UNAVAILABLE', 'Not Available'),
    ]

    destination = models.ForeignKey(
        Destination,
        on_delete=models.CASCADE,
        related_name='places',
        db_index=True
    )
    name = models.CharField(max_length=255, db_index=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, db_index=True)
    subcategory = models.CharField(max_length=100, blank=True)
    description = models.TextField()
    address = models.CharField(max_length=500)
    
    # Coordinates in WGS84
    latitude = models.FloatField(help_text="Verified latitude in decimal degrees")
    longitude = models.FloatField(help_text="Verified longitude in decimal degrees")

    price_tier = models.CharField(max_length=20, choices=PRICE_TIER_CHOICES, default='Budget')
    typical_cost_inr = models.PositiveIntegerField(null=True, blank=True, help_text="Typical spend per person in INR")
    ticket_price_inr = models.PositiveIntegerField(null=True, blank=True, help_text="Official entry ticket in INR (0 for free)")
    opening_hours = models.CharField(max_length=200, blank=True, help_text="Verified operating hours or empty if unavailable")
    
    rating = models.FloatField(null=True, blank=True)
    reviews_count = models.PositiveIntegerField(default=0)
    match_score = models.PositiveIntegerField(default=85, help_text="Dynamic recommendation score (0-100)")
    match_reason = models.CharField(max_length=300, blank=True)

    # Data Provenance & Verification
    data_source = models.CharField(max_length=200, default='OpenStreetMap & Official Sources')
    source_record_id = models.CharField(max_length=150, blank=True, help_text="Original provider ID, e.g. osm:way:12345")
    source_url = models.URLField(max_length=1000, blank=True)
    verification_status = models.CharField(
        max_length=20,
        choices=VERIFICATION_CHOICES,
        default='VERIFIED',
        db_index=True
    )
    last_verified_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-match_score', 'name']
        verbose_name = 'Place'
        verbose_name_plural = 'Places'
        indexes = [
            models.Index(fields=['destination', 'category']),
            models.Index(fields=['latitude', 'longitude']),
        ]

    def __str__(self):
        return f"{self.name} ({self.destination.name}) - {self.category}"


class DataProvenanceLog(models.Model):
    """
    Immutable audit trail for factual assertions. Never mark factual fields verified without evidence.
    """
    VERIFICATION_CHOICES = [
        ('VERIFIED', 'Verified Data'),
        ('ESTIMATED', 'Estimated Data'),
        ('UNAVAILABLE', 'Not Available'),
    ]

    place = models.ForeignKey(
        Place,
        on_delete=models.CASCADE,
        related_name='provenance_records'
    )
    field_name = models.CharField(max_length=100, help_text="e.g. ticket_price_inr, coordinates, opening_hours")
    claimed_value = models.CharField(max_length=500)
    source_name = models.CharField(max_length=200, help_text="e.g. Archaeological Survey of India, OpenStreetMap")
    source_url = models.URLField(max_length=1000, blank=True)
    retrieved_at = models.DateTimeField(auto_now_add=True)
    verification_status = models.CharField(max_length=20, choices=VERIFICATION_CHOICES, default='VERIFIED')
    evidence_notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-retrieved_at']
        verbose_name = 'Data Provenance Log'
        verbose_name_plural = 'Data Provenance Logs'

    def __str__(self):
        return f"{self.place.name} | {self.field_name}: {self.claimed_value} ({self.verification_status})"

