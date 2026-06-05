import re

from django.conf import settings
from django.contrib.contenttypes.fields import GenericRelation
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class Hashtag(models.Model):
    """A unique hashtag that can be attached to posts."""
    name = models.CharField(max_length=100, unique=True)  # stored lowercase, no #

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"#{self.name}"


class Post(models.Model):
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="posts")
    community = models.ForeignKey("communities.Community", on_delete=models.SET_NULL, related_name="posts", blank=True, null=True)
    title = models.CharField(max_length=220)
    body = models.TextField()
    image = models.ImageField(upload_to="posts/", blank=True, null=True)
    hashtags = models.ManyToManyField(Hashtag, blank=True, related_name="posts")
    votes = GenericRelation("votes.Vote")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["author", "-created_at"]),
            models.Index(fields=["community", "-created_at"]),
        ]

    def __str__(self):
        return self.title

    def sync_hashtags(self):
        """Parse #tags from body and sync the M2M relation."""
        raw_tags = re.findall(r"#([a-zA-Z][a-zA-Z0-9_]{0,49})", self.body or "")
        tags = list({t.lower() for t in raw_tags})  # deduplicate, lowercase
        tag_objs = []
        for name in tags:
            obj, _ = Hashtag.objects.get_or_create(name=name)
            tag_objs.append(obj)
        self.hashtags.set(tag_objs)


@receiver(post_save, sender=Post)
def sync_post_hashtags(sender, instance, **kwargs):
    """Automatically sync hashtags after every Post save."""
    instance.sync_hashtags()


class Bookmark(models.Model):
    """A user saving a post for later."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookmarks")
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="bookmarked_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "post"], name="unique_bookmark")
        ]
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.user.username} → {self.post.title[:40]}"
