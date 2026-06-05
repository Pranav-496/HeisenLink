from django.utils import timezone


class LastSeenMiddleware:
    """Update Profile.last_seen on every authenticated API request."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Only update for authenticated users hitting the API
        if (
            hasattr(request, "user")
            and request.user.is_authenticated
            and request.path.startswith("/api/")
        ):
            try:
                profile = request.user.profile
                # Throttle DB writes — only update if stale by 60s+
                if not profile.last_seen or (timezone.now() - profile.last_seen).seconds > 60:
                    profile.last_seen = timezone.now()
                    profile.status = "online"
                    profile.save(update_fields=["last_seen", "status"])
            except Exception:
                pass

        return response
