from rest_framework import serializers
from .models import Story
from accounts.serializers import UserSerializer

class StorySerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    is_viewed = serializers.SerializerMethodField()
    mentions = UserSerializer(many=True, read_only=True)

    class Meta:
        model = Story
        fields = ['id', 'user', 'media', 'text', 'bg_color', 'created_at', 'expires_at', 'is_viewed', 'mentions', 'is_highlight']
        read_only_fields = ['id', 'user', 'created_at', 'expires_at']

    def get_is_viewed(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            # Optimize this with annotations in the queryset ideally, but this is okay for now
            return obj.viewers.filter(id=request.user.id).exists()
        return False
