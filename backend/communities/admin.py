from django.contrib import admin

from .models import Community


@admin.register(Community)
class CommunityAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "creator", "created_at")
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name", "description")
