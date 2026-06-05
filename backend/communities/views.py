from rest_framework import generics, permissions

from .models import Community
from .serializers import CommunitySerializer


class IsCreatorOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.creator == request.user

class CommunityListCreateView(generics.ListCreateAPIView):
    queryset = Community.objects.select_related("creator").prefetch_related("posts")
    serializer_class = CommunitySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(creator=self.request.user)


class CommunityDetailView(generics.RetrieveDestroyAPIView):
    queryset = Community.objects.select_related("creator").prefetch_related("posts")
    serializer_class = CommunitySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsCreatorOrReadOnly]
    lookup_field = "slug"
