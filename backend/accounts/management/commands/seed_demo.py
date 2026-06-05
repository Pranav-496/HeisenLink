from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from comments.models import Comment
from communities.models import Community
from posts.models import Post
from votes.services import set_vote


class Command(BaseCommand):
    help = "Create sample HeisenLink users, communities, posts, comments, and votes."

    def handle(self, *args, **options):
        User = get_user_model()
        users = {}
        for username in ("walter", "jesse", "skyler"):
            user, created = User.objects.get_or_create(
                username=username,
                defaults={"email": f"{username}@heisenlink.test"},
            )
            if created:
                user.set_password("Password123!")
                user.save()
            if not user.is_active or not user.is_email_verified:
                user.is_active = True
                user.is_email_verified = True
                user.save(update_fields=["is_active", "is_email_verified"])
            user.profile.bio = f"{username.title()} is exploring the science of social connection."
            user.profile.save()
            users[username] = user

        science, _ = Community.objects.get_or_create(
            name="Science",
            defaults={
                "description": "Questions, discoveries, and careful curiosity.",
                "creator": users["walter"],
            },
        )
        social, _ = Community.objects.get_or_create(
            name="Social Experiments",
            defaults={
                "description": "Tiny experiments in how people connect.",
                "creator": users["jesse"],
            },
        )

        post1, _ = Post.objects.get_or_create(
            title="What makes an online community feel alive?",
            defaults={
                "author": users["walter"],
                "community": social,
                "body": "Is it fast replies, shared rituals, or good moderation? I suspect it is all three.",
            },
        )
        post2, _ = Post.objects.get_or_create(
            title="A tiny framework for better comment threads",
            defaults={
                "author": users["jesse"],
                "community": science,
                "body": "Ask one real question, add one useful source, and leave the thread better than you found it.",
            },
        )

        c1, _ = Comment.objects.get_or_create(
            post=post1,
            author=users["skyler"],
            body="Good defaults help. People contribute more when the first step is obvious.",
        )
        Comment.objects.get_or_create(
            post=post1,
            parent=c1,
            author=users["jesse"],
            body="The first reply sets the tone for the whole thread.",
        )

        set_vote(users["jesse"], post1, 1)
        set_vote(users["skyler"], post1, 1)
        set_vote(users["walter"], post2, 1)

        self.stdout.write(self.style.SUCCESS("Seeded demo data. Login with walter / Password123!"))
