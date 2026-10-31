from django.db import models
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

class UserProfile(models.Model):
    THEME_CHOICES = [
        ('dark', 'Dark Mode'),
        ('light', 'Light Mode'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile'
    )
    name = models.CharField(max_length=200, blank=True)
    interests = models.JSONField(default=list, blank=True)
    budget_per_day = models.PositiveIntegerField(default=2000)
    group_type = models.CharField(max_length=50, default='Duo')
    group_size = models.PositiveIntegerField(default=2)
    preferred_destinations = models.JSONField(default=list, blank=True)
    theme_preference = models.CharField(max_length=20, default='dark', choices=THEME_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'User Profile'
        verbose_name_plural = 'User Profiles'

    def __str__(self):
        return f"Profile of {self.user.username} ({self.name or self.user.email})"


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(
            user=instance,
            name=instance.get_full_name() or instance.username
        )
    else:
        if hasattr(instance, 'profile'):
            instance.profile.save()

