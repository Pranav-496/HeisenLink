from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.utils import timezone
from google.auth.transport import requests
from google.oauth2 import id_token
from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, MultiPartParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from notifications.utils import create_notification

from .models import Block, EmailVerification, Follow, PasswordResetToken, Report
from .serializers import (
    BlockSerializer, RegisterSerializer, ReportSerializer,
    UserSerializer, UserMiniSerializer,
)
from .services import (
    create_email_verification, create_password_reset,
    debug_otp_payload, validate_otp, verify_pending_registration,
)


User = get_user_model()


def token_payload_for(user):
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


# ── Auth ───────────────────────────────────────────────────────────────────────

class VerifiedTokenObtainPairView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get("username", "").strip()
        password = request.data.get("password", "")
        if not username or not password:
            return Response({"detail": "Username and password are required."}, status=400)

        user = User.objects.filter(username__iexact=username).first()
        if not user or not check_password(password, user.password):
            return Response({"detail": "No active account found with the given credentials"}, status=401)
        if not user.is_email_verified:
            verification, code = create_email_verification(user)
            return Response(
                {
                    "detail": "Email verification required before login. We sent a fresh OTP.",
                    "email": user.email,
                    "requires_verification": True,
                    **debug_otp_payload(code),
                },
                status=403,
            )
        if not user.is_active:
            return Response({"detail": "This account is disabled."}, status=403)

        # Update last_seen on login
        user.profile.last_seen = timezone.now()
        user.profile.status = "online"
        user.profile.save(update_fields=["last_seen", "status"])

        return Response({"user": UserSerializer(user, context={"request": request}).data, **token_payload_for(user)})


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pending = serializer.save()
        return Response(
            {
                "detail": "Registration initiated. Check your email for the 6-digit verification code.",
                "email": pending.email,
                "requires_verification": True,
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyPendingEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        otp = request.data.get("otp", "").strip()
        if not email or not otp:
            return Response({"detail": "Email and OTP are required."}, status=400)

        user, err = verify_pending_registration(email, otp)
        if err:
            return Response({"detail": err}, status=400)

        return Response(
            {
                "detail": "Email verified, account created.",
                "user": UserSerializer(user, context={"request": request}).data,
                **token_payload_for(user),
            },
            status=200,
        )


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        code = request.data.get("otp", "").strip()
        if not email or not code:
            return Response({"detail": "Email and OTP are required."}, status=400)

        user = generics.get_object_or_404(User, email__iexact=email)
        record = EmailVerification.objects.filter(user=user, used_at__isnull=True).first()
        ok, message = validate_otp(record, code)
        if not ok:
            return Response({"detail": message}, status=400)

        user.is_email_verified = True
        user.is_active = True
        user.save(update_fields=["is_email_verified", "is_active"])
        return Response({"user": UserSerializer(user, context={"request": request}).data, **token_payload_for(user)})


class ResendOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        if not email:
            return Response({"detail": "Email is required."}, status=400)

        user = generics.get_object_or_404(User, email__iexact=email)
        if user.is_email_verified and user.is_active:
            return Response({"detail": "This email is already verified."}, status=400)
        verification, code = create_email_verification(user)
        return Response({"detail": "A new verification code has been sent.", **debug_otp_payload(code)})


class GoogleLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        credential = request.data.get("credential")
        if not credential:
            return Response({"detail": "Google credential is required."}, status=400)
        if not settings.GOOGLE_CLIENT_ID:
            return Response({"detail": "GOOGLE_CLIENT_ID is not configured."}, status=500)

        try:
            info = id_token.verify_oauth2_token(
                credential, requests.Request(), settings.GOOGLE_CLIENT_ID,
            )
        except ValueError:
            return Response({"detail": "Invalid Google credential."}, status=400)

        email = info.get("email")
        username_seed = (info.get("name") or email.split("@")[0]).replace(" ", "").lower()
        username = username_seed
        counter = 1
        while User.objects.filter(username=username).exclude(email=email).exists():
            counter += 1
            username = f"{username_seed}{counter}"

        user, created = User.objects.get_or_create(
            email=email,
            defaults={"username": username, "is_active": False, "is_email_verified": False},
        )
        if created:
            user.set_unusable_password()
            user.save(update_fields=["password"])
            verification, code = create_email_verification(user)
            return Response(
                {
                    "detail": "Google account connected. Verify your email with the OTP we sent.",
                    "email": user.email,
                    "requires_verification": True,
                    **debug_otp_payload(code),
                },
                status=status.HTTP_202_ACCEPTED,
            )

        if not user.is_active or not user.is_email_verified:
            verification, code = create_email_verification(user)
            return Response(
                {
                    "detail": "Email verification required. We sent a fresh OTP.",
                    "email": user.email,
                    "requires_verification": True,
                    **debug_otp_payload(code),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response({"user": UserSerializer(user, context={"request": request}).data, **token_payload_for(user)})


class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        if email:
            user = User.objects.filter(email__iexact=email, is_active=True, is_email_verified=True).first()
            if user:
                reset, code = create_password_reset(user)
                return Response({"detail": "If an account exists, a reset code has been sent.", **debug_otp_payload(code)})
        return Response({"detail": "If an account exists, a reset code has been sent."})


class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        code = request.data.get("otp", "").strip()
        password = request.data.get("password", "")
        confirm_password = request.data.get("confirm_password", "")
        if not all([email, code, password, confirm_password]):
            return Response({"detail": "Email, OTP, password, and confirm password are required."}, status=400)
        if password != confirm_password:
            return Response({"confirm_password": "Passwords do not match."}, status=400)
        try:
            validate_password(password, user=None)
        except ValidationError as exc:
            return Response({"password": list(exc.messages)}, status=400)

        user = generics.get_object_or_404(User, email__iexact=email, is_active=True, is_email_verified=True)
        record = PasswordResetToken.objects.filter(user=user, used_at__isnull=True).first()
        ok, message = validate_otp(record, code)
        if not ok:
            return Response({"detail": message}, status=400)

        user.set_password(password)
        user.save(update_fields=["password"])
        return Response({"detail": "Password reset successful. You can login with your new password."})


# ── Profile ────────────────────────────────────────────────────────────────────

class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get_object(self):
        return self.request.user

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx


class AvatarUploadView(APIView):
    """PATCH /api/auth/me/avatar/ — upload or delete profile picture."""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def patch(self, request):
        profile = request.user.profile
        avatar = request.FILES.get("avatar")
        if not avatar:
            return Response({"detail": "No file provided."}, status=400)
        # Delete old avatar to save disk space
        if profile.avatar:
            profile.avatar.delete(save=False)
        profile.avatar = avatar
        profile.save(update_fields=["avatar"])
        from .serializers import ProfileSerializer
        return Response(ProfileSerializer(profile, context={"request": request}).data)

    def delete(self, request):
        profile = request.user.profile
        if profile.avatar:
            profile.avatar.delete(save=False)
            profile.avatar = None
            profile.save(update_fields=["avatar"])
        from .serializers import ProfileSerializer
        return Response(ProfileSerializer(profile, context={"request": request}).data)


class CoverPhotoUploadView(APIView):
    """PATCH /api/auth/me/cover/ — upload or delete cover photo."""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def patch(self, request):
        profile = request.user.profile
        cover = request.FILES.get("cover_photo")
        if not cover:
            return Response({"detail": "No file provided."}, status=400)
        if profile.cover_photo:
            profile.cover_photo.delete(save=False)
        profile.cover_photo = cover
        profile.save(update_fields=["cover_photo"])
        from .serializers import ProfileSerializer
        return Response(ProfileSerializer(profile, context={"request": request}).data)

    def delete(self, request):
        profile = request.user.profile
        if profile.cover_photo:
            profile.cover_photo.delete(save=False)
            profile.cover_photo = None
            profile.save(update_fields=["cover_photo"])
        return Response({"detail": "Cover photo removed."})


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        current = request.data.get("current_password", "")
        new_pw = request.data.get("new_password", "")
        confirm = request.data.get("confirm_password", "")
        if not all([current, new_pw, confirm]):
            return Response({"detail": "All fields are required."}, status=400)
        if not check_password(current, request.user.password):
            return Response({"detail": "Current password is incorrect."}, status=400)
        if new_pw != confirm:
            return Response({"detail": "New passwords do not match."}, status=400)
        try:
            validate_password(new_pw, user=request.user)
        except ValidationError as exc:
            return Response({"detail": list(exc.messages)}, status=400)
        request.user.set_password(new_pw)
        request.user.save(update_fields=["password"])
        return Response({"detail": "Password changed successfully."})


class UpdateStatusView(APIView):
    """PATCH /api/auth/me/status/ — update online status."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        new_status = request.data.get("status", "online")
        custom_status = request.data.get("custom_status", "")
        allowed = ["online", "away", "busy", "offline"]
        if new_status not in allowed:
            return Response({"detail": f"Status must be one of: {allowed}"}, status=400)
        profile = request.user.profile
        profile.status = new_status
        profile.last_seen = timezone.now()
        if custom_status is not None:
            profile.custom_status = custom_status[:100]
        profile.save(update_fields=["status", "last_seen", "custom_status"])
        return Response({"status": new_status, "custom_status": profile.custom_status})


# ── Users ──────────────────────────────────────────────────────────────────────

class CheckUsernameView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        username = request.query_params.get("username", "").strip().lower()
        if not username:
            return Response({"available": False, "detail": "Username is required."})
        if not username.isalnum():
            return Response({"available": False, "detail": "Username must be alphanumeric."})
        exists = User.objects.filter(username__iexact=username).exists()
        if exists and request.user.is_authenticated:
            own = User.objects.filter(username__iexact=username, pk=request.user.pk).exists()
            if own:
                return Response({"available": True})
        return Response({"available": not exists})


class UserDetailView(generics.RetrieveAPIView):
    queryset = User.objects.select_related("profile").prefetch_related("followers", "following")
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx


class UserFollowersView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get(self, request, pk):
        user = generics.get_object_or_404(User, pk=pk)
        follower_ids = Follow.objects.filter(following=user).values_list("follower_id", flat=True)
        followers = User.objects.filter(id__in=follower_ids).select_related("profile")
        return Response(UserMiniSerializer(followers, many=True, context={"request": request}).data)


class UserFollowingView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get(self, request, pk):
        user = generics.get_object_or_404(User, pk=pk)
        following_ids = Follow.objects.filter(follower=user).values_list("following_id", flat=True)
        following = User.objects.filter(id__in=following_ids).select_related("profile")
        return Response(UserMiniSerializer(following, many=True, context={"request": request}).data)


class FollowToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        target = generics.get_object_or_404(User, pk=pk)
        if target == request.user:
            return Response({"detail": "You cannot follow yourself."}, status=400)

        # Blocked users can't follow each other
        if Block.objects.filter(
            Q(blocker=request.user, blocked=target) | Q(blocker=target, blocked=request.user)
        ).exists():
            return Response({"detail": "Cannot follow this user."}, status=403)

        follow, created = Follow.objects.get_or_create(follower=request.user, following=target)
        if created:
            create_notification(
                recipient=target,
                actor=request.user,
                verb="followed you",
                target=request.user,
            )
            return Response({"following": True})

        follow.delete()
        return Response({"following": False})


class SearchView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get(self, request):
        from posts.models import Post
        from posts.serializers import PostSerializer

        q = request.query_params.get("q", "").strip()
        if not q or len(q) < 2:
            return Response({"users": [], "posts": []})

        # Exclude blocked users from results
        blocked_ids = set()
        if request.user.is_authenticated:
            blocked_ids = set(
                Block.objects.filter(
                    Q(blocker=request.user) | Q(blocked=request.user)
                ).values_list("blocker_id", "blocked_id")
            )
            # Flatten to a single set of IDs (both directions)
            flat_blocked = set()
            for pair in blocked_ids:
                flat_blocked.update(pair)
            flat_blocked.discard(request.user.id)
            blocked_ids = flat_blocked

        users = User.objects.filter(
            Q(username__icontains=q) | Q(profile__full_name__icontains=q),
            is_active=True,
            is_email_verified=True,
        ).exclude(id__in=blocked_ids).select_related("profile").distinct()[:20]

        posts = Post.objects.filter(
            Q(title__icontains=q) | Q(body__icontains=q)
        ).exclude(author_id__in=blocked_ids).select_related(
            "author", "author__profile", "community"
        ).order_by("-created_at")[:20]

        return Response({
            "users": UserMiniSerializer(users, many=True, context={"request": request}).data,
            "posts": PostSerializer(posts, many=True, context={"request": request}).data,
        })


# ── Block ──────────────────────────────────────────────────────────────────────

class BlockToggleView(APIView):
    """POST /api/users/<pk>/block/ — block or unblock a user."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        target = generics.get_object_or_404(User, pk=pk)
        if target == request.user:
            return Response({"detail": "You cannot block yourself."}, status=400)

        block, created = Block.objects.get_or_create(blocker=request.user, blocked=target)
        if created:
            # Also remove any follow relationships
            Follow.objects.filter(
                Q(follower=request.user, following=target) |
                Q(follower=target, following=request.user)
            ).delete()
            return Response({"blocked": True})

        block.delete()
        return Response({"blocked": False})


class BlockListView(generics.ListAPIView):
    """GET /api/me/blocked/ — list users I've blocked."""
    serializer_class = BlockSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Block.objects.filter(blocker=self.request.user).select_related(
            "blocked", "blocked__profile"
        )

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx


# ── Report ─────────────────────────────────────────────────────────────────────

class ReportCreateView(generics.CreateAPIView):
    """POST /api/report/ — report content."""
    serializer_class = ReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(reporter=self.request.user)
