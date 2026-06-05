from rest_framework import serializers
from django.contrib.auth import get_user_model

from accounts.serializers import UserMiniSerializer
from .models import Conversation, Message, MessageReaction

User = get_user_model()


class MessageReactionSerializer(serializers.ModelSerializer):
    user = UserMiniSerializer(read_only=True)

    class Meta:
        model = MessageReaction
        fields = ("id", "user", "emoji", "created_at")


class ReplyToSerializer(serializers.ModelSerializer):
    sender = UserMiniSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ("id", "sender", "body", "is_deleted", "created_at")


class MessageSerializer(serializers.ModelSerializer):
    sender = UserMiniSerializer(read_only=True)
    reactions = MessageReactionSerializer(many=True, read_only=True)
    reply_to = ReplyToSerializer(read_only=True)
    display_body = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = (
            "id", "conversation", "sender", "body", "display_body",
            "reply_to", "reactions", "read_by", "is_deleted", "created_at",
        )

    def get_display_body(self, obj):
        """Returns the text to display — redacted if message is deleted."""
        if obj.is_deleted:
            return None  # frontend renders "Message unsent"
        return obj.body


class ConversationSerializer(serializers.ModelSerializer):
    participants = UserMiniSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    pinned_message = MessageSerializer(read_only=True)

    class Meta:
        model = Conversation
        fields = (
            "id", "is_group", "name", "participants",
            "last_message", "unread_count", "pinned_message", "updated_at",
        )

    def get_last_message(self, obj):
        msg = obj.messages.order_by("-created_at").first()
        if msg:
            return MessageSerializer(msg).data
        return None

    def get_unread_count(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return 0
        return obj.messages.exclude(sender=request.user).exclude(read_by=request.user).count()


class ConversationCreateSerializer(serializers.ModelSerializer):
    participant_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True
    )

    class Meta:
        model = Conversation
        fields = ("id", "is_group", "name", "participant_ids")

    def create(self, validated_data):
        participant_ids = validated_data.pop("participant_ids", [])
        is_group = validated_data.get("is_group", False)

        request = self.context.get("request")
        user = request.user

        all_ids = set(participant_ids)
        all_ids.add(user.id)

        if not is_group and len(all_ids) == 2:
            user1, user2 = list(all_ids)
            conv = (
                Conversation.objects
                .filter(is_group=False, participants=user1)
                .filter(participants=user2)
                .first()
            )
            if conv:
                return conv

        conversation = super().create(validated_data)
        users = User.objects.filter(id__in=all_ids)
        conversation.participants.set(users)
        return conversation
