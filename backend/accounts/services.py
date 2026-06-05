import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.utils import timezone

from .models import EmailVerification, PasswordResetToken, PendingRegistration


OTP_TTL_MINUTES = int(getattr(settings, "OTP_TTL_MINUTES", 10))


def generate_otp():
    return f"{secrets.randbelow(1_000_000):06d}"


def send_auth_email(user, subject, message):
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def create_email_verification(user):
    EmailVerification.objects.filter(user=user, used_at__isnull=True).update(used_at=timezone.now())
    code = generate_otp()
    verification = EmailVerification.objects.create(
        user=user,
        code_hash=make_password(code),
        expires_at=timezone.now() + timedelta(minutes=OTP_TTL_MINUTES),
    )
    send_auth_email(
        user,
        "Verify your HeisenLink email",
        (
            f"Your HeisenLink verification code is {code}.\n\n"
            f"It expires in {OTP_TTL_MINUTES} minutes. If you did not create this account, ignore this email."
        ),
    )
    return verification, code


def create_password_reset(user):
    PasswordResetToken.objects.filter(user=user, used_at__isnull=True).update(used_at=timezone.now())
    code = generate_otp()
    reset = PasswordResetToken.objects.create(
        user=user,
        code_hash=make_password(code),
        expires_at=timezone.now() + timedelta(minutes=OTP_TTL_MINUTES),
    )
    send_auth_email(
        user,
        "Reset your HeisenLink password",
        (
            f"Your HeisenLink password reset code is {code}.\n\n"
            f"It expires in {OTP_TTL_MINUTES} minutes. If you did not request this, ignore this email."
        ),
    )
    return reset, code

def create_pending_registration(username: str, email: str, password: str, full_name: str = ""):
    """Create a pending registration, store full_name, send OTP email.
    Returns (PendingRegistration, otp) – OTP is only for debugging.
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()
    if User.objects.filter(email=email).exists():
        raise ValueError("A user with this email already exists.")
    # Clean any previous pending entry for this email
    PendingRegistration.objects.filter(email=email).delete()
    code = generate_otp()
    pending = PendingRegistration.objects.create(
        username=username,
        email=email,
        full_name=full_name,
        password_hash=make_password(password),
        code_hash=make_password(code),
        expires_at=timezone.now() + timedelta(minutes=OTP_TTL_MINUTES),
    )
    # Send OTP email (using a minimal dummy user object for email address)
    class DummyUser:
        def __init__(self, email):
            self.email = email
    send_auth_email(
        DummyUser(email),
        "Verify your HeisenLink email",
        f"Your verification code is {code}.\n\nIt expires in {OTP_TTL_MINUTES} minutes. If you did not request this, ignore this email.",
    )
    return pending, code


def verify_pending_registration(email: str, code: str):
    """Validate OTP and create the actual User if correct. Returns (user, error_message)."""
    try:
        pending = PendingRegistration.objects.get(email=email)
    except PendingRegistration.DoesNotExist:
        return None, "No pending registration found."
    is_valid, err = validate_otp(pending, code)
    if not is_valid:
        return None, err
    # Create real user
    from django.contrib.auth import get_user_model
    from .models import Profile
    User = get_user_model()
    user = User.objects.create_user(
        username=pending.username,
        email=pending.email,
        password=pending.password_hash,  # already hashed; will be re‑hashed, so we set raw later
    )
    # Set the already‑hashed password directly
    user.password = pending.password_hash
    user.is_active = True
    user.is_email_verified = True
    user.save()
    # Persist full_name to profile (signal auto-creates the Profile)
    if pending.full_name:
        profile, _ = Profile.objects.get_or_create(user=user)
        profile.full_name = pending.full_name
        profile.save(update_fields=["full_name"])
    pending.delete()
    return user, None


def debug_otp_payload(code):
    # Security fix: Never send the OTP to the frontend, even in DEBUG mode.
    # Users must check their email to verify.
    return {}


def validate_otp(record, code):
    if not record:
        return False, "No active OTP was found."
    if record.used_at:
        return False, "This OTP has already been used."
    if record.is_expired:
        return False, "This OTP has expired."
    if record.attempts >= record.max_attempts:
        return False, "Too many incorrect attempts. Request a new OTP."

    record.attempts += 1
    record.save(update_fields=["attempts"])
    if not check_password(code, record.code_hash):
        return False, "Invalid OTP."

    record.used_at = timezone.now()
    record.save(update_fields=["used_at"])
    return True, ""
