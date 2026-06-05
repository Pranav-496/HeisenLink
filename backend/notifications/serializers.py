from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True)
    actor_avatar_url = serializers.SerializerMethodField()
    target_type = serializers.SerializerMethodField()
    target_url = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            "id",
            "actor",
            "actor_username",
            "actor_avatar_url",
            "verb",
            "target_type",
            "target_object_id",
            "target_url",
            "is_read",
            "created_at",
        )
        read_only_fields = fields

    def get_actor_avatar_url(self, obj):
        request = self.context.get("request")
        try:
            if obj.actor.profile.avatar and request:
                return request.build_absolute_uri(obj.actor.profile.avatar.url)
        except Exception:
            pass
        return None

    def get_target_type(self, obj):
        return obj.target_content_type.model if obj.target_content_type else None

    def get_target_url(self, obj):
        """Return a frontend route for the notification target so the UI can deep-link."""
        if not obj.target_content_type or not obj.target_object_id:
            return None

        model = obj.target_content_type.model

        if model == "post":
            return f"/posts/{obj.target_object_id}"

        if model == "comment":
            # Resolve the post that the comment belongs to
            try:
                from comments.models import Comment
                comment = Comment.objects.select_related("post").get(pk=obj.target_object_id)
                return f"/posts/{comment.post_id}"
            except Exception:
                return None

        if model == "user":
            return f"/users/{obj.target_object_id}"

        return None
