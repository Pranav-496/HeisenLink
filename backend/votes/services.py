from django.contrib.contenttypes.models import ContentType
from django.db.models import Sum

from .models import Vote


def set_vote(user, obj, value):
    value = int(value)
    content_type = ContentType.objects.get_for_model(obj)
    lookup = {"user": user, "content_type": content_type, "object_id": obj.pk}

    if value == 0:
        Vote.objects.filter(**lookup).delete()
        return None

    if value not in (Vote.UPVOTE, Vote.DOWNVOTE):
        raise ValueError("Vote value must be 1, -1, or 0.")

    vote, _ = Vote.objects.update_or_create(defaults={"value": value}, **lookup)
    return vote


def vote_score(obj):
    content_type = ContentType.objects.get_for_model(obj)
    total = Vote.objects.filter(content_type=content_type, object_id=obj.pk).aggregate(total=Sum("value"))["total"]
    return total or 0


def user_vote(user, obj):
    if not user or not user.is_authenticated:
        return 0
    content_type = ContentType.objects.get_for_model(obj)
    vote = Vote.objects.filter(user=user, content_type=content_type, object_id=obj.pk).first()
    return vote.value if vote else 0
