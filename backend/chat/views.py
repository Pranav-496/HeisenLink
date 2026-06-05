from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Conversation, Message, MessageReaction
from .serializers import (
    ConversationCreateSerializer,
    ConversationSerializer,
    MessageSerializer,
)

User = get_user_model()

channel_layer = get_channel_layer()


def broadcast(group, payload):
    async_to_sync(channel_layer.group_send)(group, payload)


class ConversationListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ConversationCreateSerializer
        return ConversationSerializer

    def get_queryset(self):
        return (
            Conversation.objects.filter(participants=self.request.user)
            .prefetch_related("participants", "participants__profile", "messages")
            .select_related("pinned_message", "pinned_message__sender")
            .order_by("-updated_at")
        )

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def create(self, request, *args, **kwargs):
        serializer = ConversationCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        conversation = serializer.save()
        return Response(
            ConversationSerializer(conversation, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ConversationDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ConversationSerializer

    def get_queryset(self):
        return Conversation.objects.filter(participants=self.request.user).prefetch_related(
            "participants", "participants__profile"
        ).select_related("pinned_message", "pinned_message__sender")


class MessageListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageSerializer

    def get_queryset(self):
        conversation_id = self.kwargs["pk"]
        conversation = get_object_or_404(
            Conversation, pk=conversation_id, participants=self.request.user
        )
        return (
            Message.objects.filter(conversation=conversation)
            .select_related("sender", "sender__profile", "reply_to", "reply_to__sender")
            .prefetch_related("reactions", "reactions__user")
            .order_by("created_at")
        )


class MessageCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        conversation = get_object_or_404(Conversation, pk=pk, participants=request.user)
        body = request.data.get("body", "").strip()
        reply_to_id = request.data.get("reply_to")
        if not body:
            return Response({"detail": "Message body is required."}, status=400)

        reply_to = None
        if reply_to_id:
            reply_to = Message.objects.filter(id=reply_to_id, conversation=conversation).first()

        message = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            body=body,
            reply_to=reply_to,
        )
        conversation.save(update_fields=["updated_at"])

        msg_data = MessageSerializer(
            Message.objects.select_related("sender", "sender__profile", "reply_to", "reply_to__sender")
            .prefetch_related("reactions", "reactions__user")
            .get(id=message.id)
        ).data

        broadcast(f"chat_{conversation.id}", {"type": "chat.message", "message": msg_data})
        return Response(msg_data, status=status.HTTP_201_CREATED)


class MessageUnsendView(APIView):
    """Soft-delete a message (only sender can unsend)."""
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        message = get_object_or_404(
            Message, pk=pk, conversation__participants=request.user
        )
        if message.sender_id != request.user.id:
            return Response({"detail": "You can only unsend your own messages."}, status=403)

        message.is_deleted = True
        message.body = ""           # wipe content on server
        message.save(update_fields=["is_deleted", "body"])

        # Notify room members in real-time
        broadcast(
            f"chat_{message.conversation_id}",
            {"type": "chat.unsend", "message_id": message.id},
        )
        return Response({"unsent": True})


class MessageForwardView(APIView):
    """Forward a message to another conversation."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        source = get_object_or_404(Message, pk=pk, conversation__participants=request.user)
        if source.is_deleted:
            return Response({"detail": "Cannot forward a deleted message."}, status=400)

        target_conv_id = request.data.get("conversation_id")
        if not target_conv_id:
            return Response({"detail": "conversation_id is required."}, status=400)

        target_conv = get_object_or_404(Conversation, pk=target_conv_id, participants=request.user)

        forwarded = Message.objects.create(
            conversation=target_conv,
            sender=request.user,
            body=source.body,
        )
        target_conv.save(update_fields=["updated_at"])

        msg_data = MessageSerializer(
            Message.objects.select_related("sender", "sender__profile")
            .prefetch_related("reactions", "reactions__user")
            .get(id=forwarded.id)
        ).data

        broadcast(f"chat_{target_conv.id}", {"type": "chat.message", "message": msg_data})
        return Response(msg_data, status=status.HTTP_201_CREATED)


class MessagePinView(APIView):
    """Pin or unpin a message in a conversation."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        message = get_object_or_404(Message, pk=pk, conversation__participants=request.user)
        conv = message.conversation

        if conv.pinned_message_id == message.id:
            # Unpin
            conv.pinned_message = None
            conv.save(update_fields=["pinned_message"])
            broadcast(f"chat_{conv.id}", {"type": "chat.pin", "message_id": None})
            return Response({"pinned": False})

        conv.pinned_message = message
        conv.save(update_fields=["pinned_message"])
        msg_data = MessageSerializer(message).data
        broadcast(f"chat_{conv.id}", {"type": "chat.pin", "message_id": message.id, "message": msg_data})
        return Response({"pinned": True, "message": msg_data})


class MessageReactionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        message = get_object_or_404(Message, pk=pk)
        if not message.conversation.participants.filter(id=request.user.id).exists():
            return Response({"detail": "Not a participant."}, status=403)
        emoji = request.data.get("emoji", "").strip()
        if not emoji:
            return Response({"detail": "Emoji required."}, status=400)

        reaction, created = MessageReaction.objects.get_or_create(
            message=message, user=request.user, emoji=emoji
        )
        action_str = "added"
        if not created:
            reaction.delete()
            action_str = "removed"

        broadcast(
            f"chat_{message.conversation.id}",
            {
                "type": "chat.reaction",
                "message_id": message.id,
                "emoji": emoji,
                "user_id": request.user.id,
                "username": request.user.username,
                "action": action_str,
            },
        )
        return Response({action_str: True, "emoji": emoji})


class ConversationReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        conv = get_object_or_404(Conversation, id=pk, participants=request.user)
        messages = conv.messages.exclude(sender=request.user)
        for msg in messages:
            msg.read_by.add(request.user)

        broadcast(
            f"chat_{pk}",
            {"type": "chat.read", "user_id": request.user.id},
        )
        return Response({"status": "success"})
