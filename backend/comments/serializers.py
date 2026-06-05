from rest_framework import serializers

from votes.services import user_vote, vote_score

from .models import Comment


class CommentSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source="author.username", read_only=True)
    replies = serializers.SerializerMethodField()
    score = serializers.SerializerMethodField()
    user_vote = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = (
            "id",
            "post",
            "author",
            "author_username",
            "parent",
            "body",
            "score",
            "user_vote",
            "replies",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "post", "author", "author_username", "score", "user_vote", "replies", "created_at", "updated_at")

    def get_replies(self, obj):
        replies = obj.replies.select_related("author").prefetch_related("replies")
        return CommentSerializer(replies, many=True, context=self.context).data

    def get_score(self, obj):
        return getattr(obj, "score", vote_score(obj))

    def get_user_vote(self, obj):
        request = self.context.get("request")
        return user_vote(request.user, obj) if request else 0
