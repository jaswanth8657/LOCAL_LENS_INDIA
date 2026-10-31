from django.db import models
from django.conf import settings
from destinations.models import Destination
from places.models import Place

class Itinerary(models.Model):
    GROUP_CHOICES = [
        ('Solo', 'Solo Traveler'),
        ('Duo', 'Duo / Couple'),
        ('Family', 'Family'),
        ('Friends', 'Friends Group'),
    ]

    id = models.CharField(max_length=150, primary_key=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='itineraries'
    )
    title = models.CharField(max_length=255)
    destination_name = models.CharField(max_length=200)
    destination = models.ForeignKey(
        Destination,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='itineraries'
    )
    group_type = models.CharField(max_length=50, choices=GROUP_CHOICES, default='Duo')
    duration_days = models.PositiveIntegerField(default=3)
    daily_budget_inr = models.PositiveIntegerField(default=2000)
    total_budget_inr = models.PositiveIntegerField(default=6000)
    ai_provider_used = models.CharField(
        max_length=100,
        default='Deterministic Non-AI',
        help_text="Records whether generated via Gemini, Ollama, or deterministic fallback"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Itinerary'
        verbose_name_plural = 'Itineraries'

    def __str__(self):
        return f"{self.title} ({self.duration_days} days)"


class ItineraryDay(models.Model):
    itinerary = models.ForeignKey(
        Itinerary,
        on_delete=models.CASCADE,
        related_name='days'
    )
    day_number = models.PositiveIntegerField()
    theme = models.CharField(max_length=200)
    date = models.CharField(max_length=100, blank=True)
    day_estimated_cost_inr = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['day_number']
        unique_together = ('itinerary', 'day_number')
        verbose_name = 'Itinerary Day'
        verbose_name_plural = 'Itinerary Days'

    def __str__(self):
        return f"{self.itinerary.title} - Day {self.day_number}: {self.theme}"


class ItineraryStop(models.Model):
    TIME_SLOT_CHOICES = [
        ('Morning', 'Morning'),
        ('Afternoon', 'Afternoon'),
        ('Evening', 'Evening'),
        ('Night', 'Night'),
    ]

    VERIFICATION_CHOICES = [
        ('VERIFIED', 'Verified Data'),
        ('ESTIMATED', 'Estimated Data'),
        ('UNAVAILABLE', 'Not Available'),
    ]

    day = models.ForeignKey(
        ItineraryDay,
        on_delete=models.CASCADE,
        related_name='stops'
    )
    stop_order = models.PositiveIntegerField()
    time_slot = models.CharField(max_length=20, choices=TIME_SLOT_CHOICES, default='Morning')
    time = models.CharField(max_length=50, default='09:00 AM')
    place = models.ForeignKey(
        Place,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='itinerary_stops'
    )
    place_name = models.CharField(max_length=255)
    category = models.CharField(max_length=100, default='culture')
    duration_minutes = models.PositiveIntegerField(default=90)
    cost_inr = models.PositiveIntegerField(default=0)
    cost_status = models.CharField(max_length=20, choices=VERIFICATION_CHOICES, default='VERIFIED')
    local_tips = models.TextField(blank=True)
    transport_to_next = models.CharField(max_length=300, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ['stop_order']
        verbose_name = 'Itinerary Stop'
        verbose_name_plural = 'Itinerary Stops'

    def __str__(self):
        return f"Day {self.day.day_number} Stop {self.stop_order}: {self.place_name}"


class ExpenseBreakdown(models.Model):
    itinerary = models.OneToOneField(
        Itinerary,
        on_delete=models.CASCADE,
        related_name='expenses'
    )
    accommodation = models.PositiveIntegerField(default=800)
    food_dining = models.PositiveIntegerField(default=500)
    local_transport = models.PositiveIntegerField(default=300)
    sightseeing_tickets = models.PositiveIntegerField(default=200)
    buffer_contingency = models.PositiveIntegerField(default=200)
    total_per_day = models.PositiveIntegerField(default=2000)
    total_trip = models.PositiveIntegerField(default=6000)
    is_verified_basis = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Expense Breakdown'
        verbose_name_plural = 'Expense Breakdowns'

    def __str__(self):
        return f"Expenses for {self.itinerary.title} (₹{self.total_trip} Total)"

