from django.urls import path

from .views import (
    AvatarUploadView,
    BlockListView,
    BlockToggleView,
    ChangePasswordView,
    CheckUsernameView,
    CoverPhotoUploadView,
    FollowToggleView,
    ForgotPasswordView,
    GoogleLoginView,
    MeView,
    RegisterView,
    ReportCreateView,
    ResendOTPView,
    ResetPasswordView,
    SearchView,
    UpdateStatusView,
    UserDetailView,
    UserFollowersView,
    UserFollowingView,
    VerifyEmailView,
    VerifyPendingEmailView,
)


urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("verify-pending/", VerifyPendingEmailView.as_view(), name="verify_pending"),
    path("verify-email/", VerifyEmailView.as_view(), name="verify_email"),
    path("resend-otp/", ResendOTPView.as_view(), name="resend_otp"),
    path("google/", GoogleLoginView.as_view(), name="google_login"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot_password"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset_password"),
    # Profile
    path("me/", MeView.as_view(), name="me"),
    path("me/password/", ChangePasswordView.as_view(), name="change_password"),
    path("me/avatar/", AvatarUploadView.as_view(), name="me_avatar"),
    path("me/cover/", CoverPhotoUploadView.as_view(), name="me_cover"),
    path("me/status/", UpdateStatusView.as_view(), name="me_status"),
    path("me/blocked/", BlockListView.as_view(), name="me_blocked"),
    # Users
    path("check-username/", CheckUsernameView.as_view(), name="check_username"),
    path("users/<int:pk>/", UserDetailView.as_view(), name="user_detail"),
    path("users/<int:pk>/follow/", FollowToggleView.as_view(), name="follow_toggle"),
    path("users/<int:pk>/block/", BlockToggleView.as_view(), name="block_toggle"),
    path("users/<int:pk>/followers/", UserFollowersView.as_view(), name="user_followers"),
    path("users/<int:pk>/following/", UserFollowingView.as_view(), name="user_following"),
    # Reporting
    path("report/", ReportCreateView.as_view(), name="report_create"),
]
