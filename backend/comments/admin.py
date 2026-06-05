from django.contrib import admin

from .models import Comment


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("id", "post", "author", "parent", "created_at")
    list_filter = ("created_at",)
    search_fields = ("body", "author__username", "post__title")
