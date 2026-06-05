from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Block, EmailVerification, Follow, PasswordResetToken, Profile, Report, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ("username", "email", "is_email_verified", "is_active", "is_staff", "date_joined")
    search_fields = ("username", "email")


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "created_at", "updated_at")
    search_fields = ("user__username", "bio")


@admin.register(Follow)
class FollowAdmin(admin.ModelAdmin):
    list_display = ("follower", "following", "created_at")
    search_fields = ("follower__username", "following__username")


@admin.register(EmailVerification)
class EmailVerificationAdmin(admin.ModelAdmin):
    list_display = ("user", "expires_at", "attempts", "used_at", "created_at")
    search_fields = ("user__username", "user__email")


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "expires_at", "attempts", "used_at", "created_at")
    search_fields = ("user__username", "user__email")


@admin.register(Block)
class BlockAdmin(admin.ModelAdmin):
    list_display = ("blocker", "blocked", "created_at")
    search_fields = ("blocker__username", "blocked__username")


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("reporter", "target_type", "target_id", "reason", "status", "created_at")
    list_filter = ("status", "reason", "target_type")
    search_fields = ("reporter__username", "description")
    actions = ["mark_resolved", "mark_dismissed"]

    @admin.action(description="Mark selected reports as resolved")
    def mark_resolved(self, request, queryset):
        queryset.update(status="resolved")

    @admin.action(description="Dismiss selected reports")
    def mark_dismissed(self, request, queryset):
        queryset.update(status="dismissed")

