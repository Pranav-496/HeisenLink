from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.views import VerifiedTokenObtainPairView


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/login/", VerifiedTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("accounts.public_urls")),
    path("api/", include("posts.urls")),
    path("api/", include("comments.urls")),
    path("api/", include("communities.urls")),
    path("api/", include("notifications.urls")),
    path("api/chat/", include("chat.urls")),
    path("api/stories/", include("stories.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
