from django.urls import path

from .views import NotificationListView, NotificationMarkReadView


urlpatterns = [
    path("notifications/", NotificationListView.as_view(), name="notification_list"),
    path("notifications/read/", NotificationMarkReadView.as_view(), name="notification_mark_all_read"),
    path("notifications/<int:pk>/read/", NotificationMarkReadView.as_view(), name="notification_mark_read"),
]
