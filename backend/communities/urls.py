from django.urls import path

from .views import CommunityDetailView, CommunityListCreateView


urlpatterns = [
    path("communities/", CommunityListCreateView.as_view(), name="community_list"),
    path("communities/<slug:slug>/", CommunityDetailView.as_view(), name="community_detail"),
]
