from django.urls import path
from . import views

urlpatterns = [
    path("", views.api_chat_list_create, name="chat-list-create"),
    path("<str:chat_id>/messages/", views.api_chat_messages, name="chat-messages"),
    path(
        "<str:chat_id>/messages/<str:message_id>/",
        views.api_chat_message_detail,
        name="chat-message-detail",
    ),
    path(
        "<str:chat_id>/members/<str:user_id>/mute/",
        views.api_chat_member_mute,
        name="chat-member-mute",
    ),
    path("sync/", views.api_chat_sync, name="chat-sync"),
]
