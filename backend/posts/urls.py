from django.urls import path

from .views import (
    BookmarkListView,
    BookmarkToggleView,
    CommunityPostListView,
    FeedView,
    HashtagPostListView,
    PostCommentCreateView,
    PostDetailView,
    PostListCreateView,
    PostVoteView,
    TrendingFeedView,
    TrendingHashtagsView,
)

urlpatterns = [
    # Feed
    path("feed/", FeedView.as_view(), name="feed"),
    path("feed/trending/", TrendingFeedView.as_view(), name="trending_feed"),

    # Posts CRUD
    path("posts/", PostListCreateView.as_view(), name="post_list"),
    path("posts/<int:pk>/", PostDetailView.as_view(), name="post_detail"),
    path("posts/<int:pk>/vote/", PostVoteView.as_view(), name="post_vote"),
    path("posts/<int:pk>/comment/", PostCommentCreateView.as_view(), name="post_comment"),

    # Bookmarks
    path("posts/<int:pk>/bookmark/", BookmarkToggleView.as_view(), name="post_bookmark"),
    path("bookmarks/", BookmarkListView.as_view(), name="bookmark_list"),

    # Hashtags
    path("hashtags/trending/", TrendingHashtagsView.as_view(), name="trending_hashtags"),
    path("hashtags/<str:tag>/posts/", HashtagPostListView.as_view(), name="hashtag_posts"),

    # Community posts
    path("communities/<slug:slug>/posts/", CommunityPostListView.as_view(), name="community_posts"),
]
