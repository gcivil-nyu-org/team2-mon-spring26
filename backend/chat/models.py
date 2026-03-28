from django.db import models
from django.conf import settings


class Chat(models.Model):
    class ChatType(models.TextChoices):
        DIRECT = "direct", "Direct"
        GROUP = "group", "Group"

    # id is automatically created as a BigAutoField by Django
    type = models.CharField(max_length=20, choices=ChatType.choices)
    name = models.CharField(max_length=100, blank=True, null=True)
    group = models.OneToOneField(
        "groups.Group",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="chat",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="created_chats"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.get_type_display()} Chat: {self.name or self.id}"


class ChatMember(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MEMBER = "member", "Member"

    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_memberships",
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)
    left_at = models.DateTimeField(null=True, blank=True)
    is_muted = models.BooleanField(default=False)

    last_read_message = models.ForeignKey(
        "Message", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        unique_together = ("chat", "user")
        indexes = [
            models.Index(fields=["user", "left_at"]),
        ]

    def __str__(self):
        return f"{self.user} in Chat {self.chat.id}"


class Message(models.Model):
    class MessageType(models.TextChoices):
        TEXT = "text", "Text"
        SYSTEM = "system", "System"
        IMAGE = "image", "Image"

    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_messages",
        null=True,
        blank=True,
    )  # sender is null for system messages sometimes, though we can use a system user or let sender be nullable
    message_type = models.CharField(
        max_length=20, choices=MessageType.choices, default=MessageType.TEXT
    )
    body = models.TextField()

    reply_to_message = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="replies"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["chat", "-created_at"]),
        ]
        ordering = ["created_at"]

    def __str__(self):
        return f"Msg {self.id} in Chat {self.chat.id} by {self.sender}"
