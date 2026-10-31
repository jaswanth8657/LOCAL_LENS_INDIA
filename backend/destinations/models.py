from django.db import models

class Destination(models.Model):
    REGION_CHOICES = [
        ('North', 'North'),
        ('South', 'South'),
        ('East', 'East'),
        ('West', 'West'),
        ('North-East', 'North-East'),
        ('Central', 'Central'),
    ]

    VERIFICATION_CHOICES = [
        ('VERIFIED', 'Verified Data'),
        ('ESTIMATED', 'Estimated Data'),
        ('UNAVAILABLE', 'Not Available'),
    ]

    slug = models.SlugField(max_length=100, unique=True, primary_key=True)
    name = models.CharField(max_length=200, db_index=True)
    state = models.CharField(max_length=100, db_index=True)
    region = models.CharField(max_length=50, choices=REGION_CHOICES, db_index=True)
    tagline = models.CharField(max_length=300)
    description = models.TextField()
    
    # Real factual coordinates (WGS84 decimal degrees)
    latitude = models.FloatField(help_text="Verified latitude in decimal degrees")
    longitude = models.FloatField(help_text="Verified longitude in decimal degrees")
    
    image_url = models.URLField(max_length=1000, blank=True)
    best_time_to_visit = models.CharField(max_length=200, default='October to March')
    average_daily_budget_inr = models.PositiveIntegerField(default=2000)
    popular_categories = models.JSONField(default=list, blank=True)
    
    verification_status = models.CharField(
        max_length=20,
        choices=VERIFICATION_CHOICES,
        default='VERIFIED',
        db_index=True
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Destination'
        verbose_name_plural = 'Destinations'

    def __str__(self):
        return f"{self.name}, {self.state} ({self.region})"

