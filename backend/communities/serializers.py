from rest_framework import serializers

from .models import Community


class CommunitySerializer(serializers.ModelSerializer):
    creator_username = serializers.CharField(source="creator.username", read_only=True)
    posts_count = serializers.IntegerField(source="posts.count", read_only=True)

    class Meta:
        model = Community
        fields = ("id", "name", "slug", "description", "creator", "creator_username", "posts_count", "created_at")
        read_only_fields = ("id", "slug", "creator", "creator_username", "posts_count", "created_at")
