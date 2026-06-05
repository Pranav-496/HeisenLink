from rest_framework import generics, permissions

from .models import Community
from .serializers import CommunitySerializer


class CommunityListCreateView(generics.ListCreateAPIView):
    queryset = Community.objects.select_related("creator").prefetch_related("posts")
    serializer_class = CommunitySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(creator=self.request.user)


class CommunityDetailView(generics.RetrieveAPIView):
    queryset = Community.objects.select_related("creator").prefetch_related("posts")
    serializer_class = CommunitySerializer
    lookup_field = "slug"
