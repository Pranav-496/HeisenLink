from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .services import create_pending_registration

from .models import Block, Follow, Profile, Report


User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)
    full_name = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ("id", "username", "email", "password", "confirm_password", "full_name")

    def validate(self, attrs):
        username = attrs.get("username", "").strip().lower()
        if not username.isalnum():
            raise serializers.ValidationError({"username": "Username must be alphanumeric."})
        if User.objects.filter(username__iexact=username).exists():
            raise serializers.ValidationError({"username": "This username is already taken."})
        attrs["username"] = username
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        validate_password(attrs["password"])
        return attrs

    def create(self, validated_data):
        username = validated_data["username"]
        email = validated_data["email"]
        password = validated_data["password"]
        full_name = validated_data.get("full_name", "")
        pending, _ = create_pending_registration(username, email, password, full_name)
        return pending


class VerifiedTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.is_active or not self.user.is_email_verified:
            raise serializers.ValidationError({
                "detail": "Email verification required before login.",
                "email": self.user.email,
                "requires_verification": True,
            })
        return data


class ProfileSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    cover_photo_url = serializers.SerializerMethodField()
    is_online = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = (
            "full_name", "bio", "avatar", "avatar_url",
            "cover_photo", "cover_photo_url",
            "website", "location", "custom_status",
            "status", "is_online", "last_seen", "created_at",
        )
        read_only_fields = ("avatar_url", "cover_photo_url", "is_online", "last_seen", "created_at")
        extra_kwargs = {
            "avatar": {"write_only": True, "required": False},
            "cover_photo": {"write_only": True, "required": False},
        }

    def get_avatar_url(self, obj):
        request = self.context.get("request")
        if obj.avatar and request:
            return request.build_absolute_uri(obj.avatar.url)
        return None

    def get_cover_photo_url(self, obj):
        request = self.context.get("request")
        if obj.cover_photo and request:
            return request.build_absolute_uri(obj.cover_photo.url)
        return None

    def get_is_online(self, obj):
        return obj.is_online


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer()
    followers_count = serializers.IntegerField(source="followers.count", read_only=True)
    following_count = serializers.IntegerField(source="following.count", read_only=True)
    is_following = serializers.SerializerMethodField()
    is_blocked = serializers.SerializerMethodField()
    has_blocked_me = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "is_email_verified",
            "profile",
            "followers_count",
            "following_count",
            "is_following",
            "is_blocked",
            "has_blocked_me",
        )
        read_only_fields = (
            "id", "is_email_verified",
            "followers_count", "following_count",
            "is_following", "is_blocked", "has_blocked_me",
        )

    def get_is_following(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated or request.user == obj:
            return False
        return Follow.objects.filter(follower=request.user, following=obj).exists()

    def get_is_blocked(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated or request.user == obj:
            return False
        return Block.objects.filter(blocker=request.user, blocked=obj).exists()

    def get_has_blocked_me(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated or request.user == obj:
            return False
        return Block.objects.filter(blocker=obj, blocked=request.user).exists()

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("profile", None)

        new_username = validated_data.get("username")
        if new_username:
            new_username = new_username.strip().lower()
            if not new_username.isalnum():
                raise serializers.ValidationError({"username": "Username must be alphanumeric."})
            if User.objects.filter(username__iexact=new_username).exclude(pk=instance.pk).exists():
                raise serializers.ValidationError({"username": "This username is already taken."})
            instance.username = new_username

        new_email = validated_data.get("email")
        if new_email:
            instance.email = new_email

        instance.save()

        if profile_data is not None:
            profile = instance.profile
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()
        return instance


class UserMiniSerializer(serializers.ModelSerializer):
    """Lightweight serializer for search results, follower lists, chat participants."""
    full_name = serializers.CharField(source="profile.full_name", read_only=True)
    avatar_url = serializers.SerializerMethodField()
    is_online = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "full_name", "avatar_url", "is_online", "is_following")

    def get_avatar_url(self, obj):
        request = self.context.get("request")
        try:
            if obj.profile.avatar and request:
                return request.build_absolute_uri(obj.profile.avatar.url)
        except Profile.DoesNotExist:
            pass
        return None

    def get_is_online(self, obj):
        try:
            return obj.profile.is_online
        except Profile.DoesNotExist:
            return False

    def get_is_following(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated or request.user == obj:
            return False
        return Follow.objects.filter(follower=request.user, following=obj).exists()


class BlockSerializer(serializers.ModelSerializer):
    blocked_user = UserMiniSerializer(source="blocked", read_only=True)

    class Meta:
        model = Block
        fields = ("id", "blocked_user", "created_at")
        read_only_fields = fields


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ("id", "target_type", "target_id", "reason", "description", "created_at")
        read_only_fields = ("id", "created_at")

    def validate(self, attrs):
        reporter = self.context["request"].user
        # Prevent duplicate pending reports
        exists = Report.objects.filter(
            reporter=reporter,
            target_type=attrs["target_type"],
            target_id=attrs["target_id"],
            status="pending",
        ).exists()
        if exists:
            raise serializers.ValidationError("You have already reported this content.")
        return attrs
