from django.urls import path

from .views import CommentDetailView, CommentVoteView


urlpatterns = [
    path("comments/<int:pk>/", CommentDetailView.as_view(), name="comment_detail"),
    path("comments/<int:pk>/vote/", CommentVoteView.as_view(), name="comment_vote"),
]
