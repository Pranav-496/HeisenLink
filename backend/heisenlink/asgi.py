import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "heisenlink.settings")

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

from notifications.middleware import JwtAuthMiddleware
from notifications.routing import websocket_urlpatterns as notif_ws
from chat.routing import websocket_urlpatterns as chat_ws


django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JwtAuthMiddleware(
            AuthMiddlewareStack(URLRouter(notif_ws + chat_ws))
        ),
    }
)
