from django.contrib.contenttypes.models import ContentType
from django.db.models import Count, IntegerField, OuterRef, Q, Subquery, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from comments.serializers import CommentSerializer
from communities.models import Community
from notifications.utils import create_notification
from votes.services import set_vote, user_vote, vote_score

from .models import Bookmark, Hashtag, Post
from .serializers import HashtagSerializer, PostDetailSerializer, PostSerializer


def _notify_mentions(body, actor, target, exclude_user=None):
    """Parse @username mentions in body and send mention notifications."""
    import re
    from django.contrib.auth import get_user_model
    User = get_user_model()
    raw_mentions = re.findall(r"@([a-zA-Z0-9_]+)", body or "")
    usernames = list({m.lower() for m in raw_mentions})
    if not usernames:
        return
    mentioned_users = User.objects.filter(
        username__in=usernames, is_active=True, is_email_verified=True
    ).exclude(id=actor.id)
    if exclude_user:
        mentioned_users = mentioned_users.exclude(id=exclude_user.id)
    for user in mentioned_users:
        create_notification(
            recipient=user,
            actor=actor,
            verb="mentioned you",
            target=target,
        )


class IsAuthorOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.author == request.user


def _score_subquery():
    """
    Correlated subquery for vote score.
    Using a Subquery instead of Sum("votes__value") JOIN means subsequent
    Count("comments") annotations can never multiply the result.
    """
    from votes.models import Vote

    return Coalesce(
        Subquery(
            Vote.objects.filter(
                content_type=ContentType.objects.get_for_model(Post),
                object_id=OuterRef("pk"),
            )
            .values("object_id")
            .annotate(total=Sum("value"))
            .values("total")[:1],
            output_field=IntegerField(),
        ),
        0,
        output_field=IntegerField(),
    )


def post_queryset():
    return (
        Post.objects.select_related("author", "author__profile", "community")
        .prefetch_related("comments", "hashtags")
        .annotate(score=_score_subquery())
    )


# ─── Post CRUD ────────────────────────────────────────────────────────────────

class PostListCreateView(generics.ListCreateAPIView):
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get_queryset(self):
        queryset = post_queryset()
        community = self.request.query_params.get("community")
        author    = self.request.query_params.get("author")
        search    = self.request.query_params.get("q")
        sort      = self.request.query_params.get("sort", "new")
        hashtag   = self.request.query_params.get("hashtag")

        if community:
            queryset = queryset.filter(community__slug=community)
        if author:
            queryset = queryset.filter(author_id=author)
        if search:
            queryset = queryset.filter(Q(title__icontains=search) | Q(body__icontains=search))
        if hashtag:
            queryset = queryset.filter(hashtags__name=hashtag.lower().lstrip("#"))
        if sort == "top":
            return queryset.order_by("-score", "-created_at")
        return queryset.order_by("-created_at")

    def perform_create(self, serializer):
        post = serializer.save(author=self.request.user)
        # Notify @mentions in the post body
        _notify_mentions(post.body, self.request.user, post)


class PostDetailView(generics.RetrieveUpdateDestroyAPIView):
    def get_queryset(self):
        return post_queryset()
    serializer_class = PostDetailSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]
    parser_classes = [JSONParser, FormParser, MultiPartParser]


# ─── Feeds ────────────────────────────────────────────────────────────────────

class FeedView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = post_queryset()
        scope = self.request.query_params.get("scope", "global")
        if scope == "following" and self.request.user.is_authenticated:
            followed_ids = self.request.user.following.values_list("following_id", flat=True)
            queryset = queryset.filter(Q(author_id__in=followed_ids) | Q(author=self.request.user))
        if self.request.query_params.get("sort") == "top":
            return queryset.order_by("-score", "-created_at")
        return queryset.order_by("-created_at")


class TrendingFeedView(generics.ListAPIView):
    """Posts ordered by engagement score (votes×2 + comments) in a time window."""
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        window = self.request.query_params.get("window", "week")
        days   = {"day": 1, "week": 7, "month": 30}.get(window, 7)
        since  = timezone.now() - timezone.timedelta(days=days)

        # _score_subquery() is a correlated subquery — safe to combine with Count JOIN.
        # No row multiplication because the score is not a GROUP BY aggregate.
        return (
            post_queryset()
            .filter(created_at__gte=since)
            .annotate(
                comment_count_ann=Count("comments", distinct=True),
                trending_score=_score_subquery() * 2 + Count("comments", distinct=True),
            )
            .order_by("-trending_score", "-score", "-created_at")
        )


# ─── Votes ────────────────────────────────────────────────────────────────────

class PostVoteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        post = generics.get_object_or_404(Post.objects.select_related("author"), pk=pk)
        value = request.data.get("value")
        try:
            vote = set_vote(request.user, post, value)
        except (TypeError, ValueError):
            return Response({"detail": "Vote value must be 1, -1, or 0."}, status=400)

        if vote and vote.value == 1 and post.author != request.user:
            create_notification(
                recipient=post.author,
                actor=request.user,
                verb="upvoted your post",
                target=post,
            )

        return Response({"score": vote_score(post), "user_vote": user_vote(request.user, post)})


# ─── Comments ─────────────────────────────────────────────────────────────────

class PostCommentCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        post = generics.get_object_or_404(Post.objects.select_related("author"), pk=pk)
        serializer = CommentSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        parent = serializer.validated_data.get("parent")
        if parent and parent.post_id != post.id:
            return Response({"detail": "Parent comment must belong to this post."}, status=400)
        comment = serializer.save(author=request.user, post=post)

        recipient = comment.parent.author if comment.parent else post.author
        if recipient != request.user:
            create_notification(
                recipient=recipient,
                actor=request.user,
                verb="replied to your comment" if comment.parent else "commented on your post",
                target=comment,
            )

        # Notify @mentions in comment body (exclude thread author who already got notified)
        _notify_mentions(comment.body, request.user, comment, exclude_user=recipient)

        return Response(CommentSerializer(comment, context={"request": request}).data, status=status.HTTP_201_CREATED)


# ─── Community posts ──────────────────────────────────────────────────────────

class CommunityPostListView(generics.ListAPIView):
    serializer_class = PostSerializer

    def get_queryset(self):
        community = generics.get_object_or_404(Community, slug=self.kwargs["slug"])
        return post_queryset().filter(community=community).order_by("-created_at")


# ─── Bookmarks ────────────────────────────────────────────────────────────────

class BookmarkToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        post = generics.get_object_or_404(Post, pk=pk)
        _, created = Bookmark.objects.get_or_create(user=request.user, post=post)
        return Response({"bookmarked": True, "created": created}, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        post = generics.get_object_or_404(Post, pk=pk)
        deleted, _ = Bookmark.objects.filter(user=request.user, post=post).delete()
        return Response({"bookmarked": False, "deleted": deleted > 0}, status=status.HTTP_200_OK)


class BookmarkListView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Case, When
        bookmarked_ids = (
            Bookmark.objects.filter(user=self.request.user)
            .values_list("post_id", flat=True)
            .order_by("-created_at")
        )
        ordering = [
            Case(
                *[When(id=pid, then=i) for i, pid in enumerate(bookmarked_ids)],
                output_field=IntegerField(),
            )
        ]
        return post_queryset().filter(id__in=bookmarked_ids).order_by(*ordering)


# ─── Hashtags ────────────────────────────────────────────────────────────────

class TrendingHashtagsView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get(self, request):
        since = timezone.now() - timezone.timedelta(days=7)
        tags = (
            Hashtag.objects.filter(posts__created_at__gte=since)
            .annotate(post_count=Count("posts", distinct=True))
            .order_by("-post_count")[:15]
        )
        return Response(HashtagSerializer(tags, many=True).data)


class HashtagPostListView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        tag = self.kwargs["tag"].lower().lstrip("#")
        return post_queryset().filter(hashtags__name=tag).order_by("-created_at")
