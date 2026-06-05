from django.contrib import admin

from .models import Post


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "community", "created_at")
    list_filter = ("community", "created_at")
    search_fields = ("title", "body", "author__username")
