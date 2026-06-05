from django.urls import path

from .views import (
    ConversationListCreateView,
    ConversationDetailView,
    MessageListView,
    MessageCreateView,
    MessageUnsendView,
    MessageForwardView,
    MessagePinView,
    MessageReactionView,
    ConversationReadView,
)

urlpatterns = [
    path("conversations/", ConversationListCreateView.as_view(), name="conversation_list"),
    path("conversations/<int:pk>/", ConversationDetailView.as_view(), name="conversation_detail"),
    path("conversations/<int:pk>/messages/", MessageListView.as_view(), name="message_list"),
    path("conversations/<int:pk>/messages/send/", MessageCreateView.as_view(), name="message_create"),
    path("conversations/<int:pk>/read/", ConversationReadView.as_view(), name="conversation_read"),
    path("messages/<int:pk>/react/", MessageReactionView.as_view(), name="message_react"),
    path("messages/<int:pk>/unsend/", MessageUnsendView.as_view(), name="message_unsend"),
    path("messages/<int:pk>/forward/", MessageForwardView.as_view(), name="message_forward"),
    path("messages/<int:pk>/pin/", MessagePinView.as_view(), name="message_pin"),
]
