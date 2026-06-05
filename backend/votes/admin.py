from django.contrib import admin

from .models import Vote


@admin.register(Vote)
class VoteAdmin(admin.ModelAdmin):
    list_display = ("user", "content_type", "object_id", "value", "updated_at")
    list_filter = ("content_type", "value")
    search_fields = ("user__username",)
