from rest_framework import serializers

from comments.serializers import CommentSerializer
from votes.services import user_vote, vote_score

from .models import Bookmark, Hashtag, Post


class HashtagSerializer(serializers.ModelSerializer):
    post_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Hashtag
        fields = ("id", "name", "post_count")


class PostSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source="author.username", read_only=True)
    author_avatar_url = serializers.SerializerMethodField()
    community_name = serializers.CharField(source="community.name", read_only=True)
    community_slug = serializers.CharField(source="community.slug", read_only=True)
    image_url = serializers.SerializerMethodField()
    score = serializers.SerializerMethodField()
    user_vote = serializers.SerializerMethodField()
    comment_count = serializers.IntegerField(source="comments.count", read_only=True)
    hashtags = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = (
            "id",
            "author",
            "author_username",
            "author_avatar_url",
            "community",
            "community_name",
            "community_slug",
            "title",
            "body",
            "image",
            "image_url",
            "score",
            "user_vote",
            "comment_count",
            "hashtags",
            "is_bookmarked",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id", "author", "author_username", "author_avatar_url",
            "community_name", "community_slug",
            "image_url", "score", "user_vote",
            "comment_count", "hashtags", "is_bookmarked",
            "created_at", "updated_at",
        )

    def get_author_avatar_url(self, obj):
        request = self.context.get("request")
        try:
            if obj.author.profile.avatar and request:
                return request.build_absolute_uri(obj.author.profile.avatar.url)
        except Exception:
            pass
        return None

    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return None

    def get_score(self, obj):
        return getattr(obj, "score", vote_score(obj))

    def get_user_vote(self, obj):
        request = self.context.get("request")
        return user_vote(request.user, obj) if request else 0

    def get_hashtags(self, obj):
        return [tag.name for tag in obj.hashtags.all()]

    def get_is_bookmarked(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return Bookmark.objects.filter(user=request.user, post=obj).exists()


class PostDetailSerializer(PostSerializer):
    comments = serializers.SerializerMethodField()

    class Meta(PostSerializer.Meta):
        fields = PostSerializer.Meta.fields + ("comments",)

    def get_comments(self, obj):
        roots = obj.comments.filter(parent__isnull=True).select_related("author").prefetch_related("replies")
        return CommentSerializer(roots, many=True, context=self.context).data
