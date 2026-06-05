from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.contenttypes.models import ContentType

from .models import Notification
from .serializers import NotificationSerializer


def create_notification(recipient, actor, verb, target=None):
    if recipient == actor:
        return None

    target_content_type = None
    target_object_id = None
    if target is not None:
        target_content_type = ContentType.objects.get_for_model(target)
        target_object_id = target.pk

    notification = Notification.objects.create(
        recipient=recipient,
        actor=actor,
        verb=verb,
        target_content_type=target_content_type,
        target_object_id=target_object_id,
    )

    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            f"notifications_{recipient.id}",
            {
                "type": "notification.message",
                "notification": NotificationSerializer(notification).data,
            },
        )
    return notification
