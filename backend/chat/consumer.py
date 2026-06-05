import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model

User = get_user_model()


class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close()
            return

        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]

        # Verify user is a participant
        if not await self._is_participant(user, self.conversation_id):
            await self.close()
            return

        self.group_name = f"chat_{self.conversation_id}"
        self.user = user
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content):
        action = content.get("action")
        if action == "send_message":
            await self._handle_send(content)
        elif action == "react":
            await self._handle_react(content)
        elif action == "typing":
            await self._handle_typing(content)

    async def _handle_send(self, content):
        body = content.get("body", "").strip()
        reply_to_id = content.get("reply_to")
        if not body:
            return

        message = await self._save_message(body, reply_to_id)
        if not message:
            return

        msg_data = await self._serialize_message(message)
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "chat.message", "message": msg_data},
        )

    async def _handle_react(self, content):
        message_id = content.get("message_id")
        emoji = content.get("emoji", "").strip()
        if not message_id or not emoji:
            return

        result = await self._toggle_reaction(message_id, emoji)
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat.reaction",
                "message_id": message_id,
                "emoji": emoji,
                "user_id": self.user.id,
                "username": self.user.username,
                "action": result,
            },
        )

    async def _handle_typing(self, content):
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat.typing",
                "user_id": self.user.id,
                "username": self.user.username,
                "is_typing": content.get("is_typing", False),
            },
        )

    async def chat_message(self, event):
        await self.send_json({"type": "message", "message": event["message"]})

    async def chat_reaction(self, event):
        await self.send_json({"type": "reaction", **event})

    async def chat_typing(self, event):
        await self.send_json({"type": "typing", **event})

    async def chat_read(self, event):
        await self.send_json({"type": "read", **event})

    async def chat_unsend(self, event):
        await self.send_json({"type": "unsend", "message_id": event["message_id"]})

    async def chat_pin(self, event):
        await self.send_json({"type": "pin", "message_id": event.get("message_id"), "message": event.get("message")})


    # ── DB helpers ──
    @database_sync_to_async
    def _is_participant(self, user, conversation_id):
        from .models import Conversation
        return Conversation.objects.filter(id=conversation_id, participants=user).exists()

    @database_sync_to_async
    def _save_message(self, body, reply_to_id):
        from .models import Conversation, Message
        try:
            conversation = Conversation.objects.get(id=self.conversation_id)
            reply_to = None
            if reply_to_id:
                reply_to = Message.objects.filter(id=reply_to_id, conversation=conversation).first()
            message = Message.objects.create(
                conversation=conversation,
                sender=self.user,
                body=body,
                reply_to=reply_to,
            )
            conversation.save(update_fields=["updated_at"])
            return message
        except Exception:
            return None

    @database_sync_to_async
    def _serialize_message(self, message):
        from .serializers import MessageSerializer
        # Reload with all relations
        from .models import Message
        msg = Message.objects.select_related(
            "sender", "sender__profile", "reply_to", "reply_to__sender"
        ).prefetch_related("reactions", "reactions__user").get(id=message.id)
        return MessageSerializer(msg).data

    @database_sync_to_async
    def _toggle_reaction(self, message_id, emoji):
        from .models import Message, MessageReaction
        try:
            message = Message.objects.get(id=message_id, conversation_id=self.conversation_id)
            reaction, created = MessageReaction.objects.get_or_create(
                message=message, user=self.user, emoji=emoji
            )
            if not created:
                reaction.delete()
                return "removed"
            return "added"
        except Exception:
            return "error"
