from django.db import models
from django.conf import settings
from django.utils import timezone
import datetime

class Story(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="stories")
    media = models.FileField(upload_to="stories/", blank=True, null=True) # Changed to FileField for Video support
    text = models.TextField(blank=True, max_length=500)
    bg_color = models.CharField(max_length=20, default="#000000", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(blank=True, null=True)
    viewers = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="viewed_stories", blank=True)
    mentions = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="story_mentions", blank=True)
    is_highlight = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if not self.expires_at:
            # Set expiry to 24 hours from now if not explicitly set
            self.expires_at = timezone.now() + datetime.timedelta(hours=24)
        super().save(*args, **kwargs)

    @property
    def is_active(self):
        return timezone.now() < self.expires_at

    def __str__(self):
        return f"Story by {self.user.username} at {self.created_at}"
