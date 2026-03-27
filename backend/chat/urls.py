from django.urls import path
from . import views

urlpatterns = [
    path('', views.api_chat_list_create, name='chat-list-create'),
    path('<str:chat_id>/messages/', views.api_chat_messages, name='chat-messages'),
    path('<str:chat_id>/messages/<str:message_id>/', views.api_chat_message_detail, name='chat-message-detail'),
]
