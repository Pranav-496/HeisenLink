import os, sys, django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "heisenlink.settings")
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from django.core.mail import send_mail
from django.conf import settings

TEST_RECIPIENT = "pranav409600@gmail.com"

print("[INFO] Sending from : " + settings.EMAIL_HOST_USER)
print("[INFO] Sending to   : " + TEST_RECIPIENT)
print("[INFO] SMTP host    : " + settings.EMAIL_HOST + ":" + str(settings.EMAIL_PORT))
print("[INFO] TLS          : " + str(settings.EMAIL_USE_TLS))
print("")

try:
    send_mail(
        subject="HeisenLink OTP Test",
        message=(
            "This is a test email from HeisenLink.\n\n"
            "Your test OTP code is: 123456\n\n"
            "If you received this, SMTP is working correctly."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[TEST_RECIPIENT],
        fail_silently=False,
    )
    print("[OK] Email sent! Check pranav409600@gmail.com inbox and spam folder.")
except Exception as e:
    print("[FAIL] Email error: " + str(e))
