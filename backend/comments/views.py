from django.db.models import IntegerField, Sum
from django.db.models.functions import Coalesce
from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response

from notifications.utils import create_notification
from votes.services import set_vote, user_vote, vote_score

from .models import Comment
from .serializers import CommentSerializer


class IsCommentAuthorOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.author == request.user


class CommentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Comment.objects.select_related("author", "post").prefetch_related("replies").annotate(
        score=Coalesce(Sum("votes__value"), 0, output_field=IntegerField())
    )
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsCommentAuthorOrReadOnly]


class CommentVoteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        comment = generics.get_object_or_404(Comment.objects.select_related("author", "post"), pk=pk)
        value = request.data.get("value")
        try:
            vote = set_vote(request.user, comment, value)
        except (TypeError, ValueError):
            return Response({"detail": "Vote value must be 1, -1, or 0."}, status=400)

        if vote and vote.value == 1 and comment.author != request.user:
            create_notification(
                recipient=comment.author,
                actor=request.user,
                verb="upvoted your comment",
                target=comment,
            )

        return Response({"score": vote_score(comment), "user_vote": user_vote(request.user, comment)})
