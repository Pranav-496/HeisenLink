from rest_framework import views, response, status, permissions, parsers
from django.utils import timezone
from django.db.models import Q
from .models import Story
from .serializers import StorySerializer
from accounts.models import User
from accounts.serializers import UserSerializer

class ActiveStoriesView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        
        # Get users we follow + ourselves
        following_ids = list(request.user.following.values_list('following_id', flat=True))
        following_ids.append(request.user.id)

        # Fetch active stories OR highlights
        active_stories = Story.objects.filter(
            Q(user_id__in=following_ids) & (Q(expires_at__gt=now) | Q(is_highlight=True))
        ).select_related('user').order_by('created_at')

        grouped = {}
        for story in active_stories:
            uid = story.user.id
            if uid not in grouped:
                grouped[uid] = {
                    "user": UserSerializer(story.user, context={'request': request}).data,
                    "stories": []
                }
            grouped[uid]["stories"].append(StorySerializer(story, context={'request': request}).data)

        # Convert to list
        result = list(grouped.values())
        
        # Sort: current user first, then others
        result.sort(key=lambda x: (x['user']['id'] != request.user.id))
        
        return response.Response(result)

class StoryCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def post(self, request):
        serializer = StorySerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            story = serializer.save(user=request.user)
            mentions = request.data.getlist('mentions') if hasattr(request.data, 'getlist') else request.data.get('mentions', [])
            if isinstance(mentions, str):
                mentions = [mentions]
            if mentions:
                users = User.objects.filter(username__in=mentions)
                story.mentions.set(users)
            return response.Response(StorySerializer(story, context={'request': request}).data, status=status.HTTP_201_CREATED)
        return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class MarkStoryViewedView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            story = Story.objects.get(pk=pk)
            story.viewers.add(request.user)
            return response.Response({"status": "viewed"})
        except Story.DoesNotExist:
            return response.Response({"error": "Story not found"}, status=status.HTTP_404_NOT_FOUND)

class StoryDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        try:
            story = Story.objects.get(pk=pk, user=request.user)
            story.delete()
            return response.Response(status=status.HTTP_204_NO_CONTENT)
        except Story.DoesNotExist:
            return response.Response({"error": "Not found or forbidden"}, status=status.HTTP_404_NOT_FOUND)

class ToggleHighlightView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            story = Story.objects.get(pk=pk, user=request.user)
            story.is_highlight = not story.is_highlight
            story.save()
            return response.Response({"is_highlight": story.is_highlight})
        except Story.DoesNotExist:
            return response.Response({"error": "Not found or forbidden"}, status=status.HTTP_404_NOT_FOUND)

class UserHighlightsView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, user_id):
        highlights = Story.objects.filter(user_id=user_id, is_highlight=True).order_by('-created_at')
        if not highlights.exists():
            return response.Response([])

        user = highlights.first().user
        data = {
            "user": UserSerializer(user, context={'request': request}).data,
            "stories": StorySerializer(highlights, many=True, context={'request': request}).data
        }
        return response.Response([data])
