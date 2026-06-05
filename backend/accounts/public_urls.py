from django.urls import path

from .views import (
    BlockListView, BlockToggleView, FollowToggleView,
    MeView, ReportCreateView, SearchView,
    UserDetailView, UserFollowersView, UserFollowingView,
)


urlpatterns = [
    path("me/", MeView.as_view(), name="public_me"),
    path("me/blocked/", BlockListView.as_view(), name="public_me_blocked"),
    path("users/<int:pk>/", UserDetailView.as_view(), name="public_user_detail"),
    path("users/<int:pk>/follow/", FollowToggleView.as_view(), name="public_follow_toggle"),
    path("users/<int:pk>/block/", BlockToggleView.as_view(), name="public_block_toggle"),
    path("users/<int:pk>/followers/", UserFollowersView.as_view(), name="public_user_followers"),
    path("users/<int:pk>/following/", UserFollowingView.as_view(), name="public_user_following"),
    path("search/", SearchView.as_view(), name="search"),
    path("report/", ReportCreateView.as_view(), name="public_report"),
]
