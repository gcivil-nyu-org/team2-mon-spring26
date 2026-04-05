from django.test import TestCase, Client
from django.contrib.auth import get_user_model
import json

from groups.models import Group, GroupMembership
from .models import Chat, ChatMember, Message

User = get_user_model()


class ChatAPITests(TestCase):
    def setUp(self):
        self.client = Client()
        self.leader = User.objects.create_user(
            email="leader@example.com",
            password="password123",
            first_name="Leader",
            last_name="User",
        )
        self.member1 = User.objects.create_user(
            email="member1@example.com",
            password="password123",
            first_name="Member",
            last_name="One",
        )
        self.member2 = User.objects.create_user(
            email="member2@example.com",
            password="password123",
            first_name="Member",
            last_name="Two",
        )

        self.group = Group.objects.create(name="Chat Group", created_by=self.leader)
        GroupMembership.objects.create(
            user=self.leader, group=self.group, role=GroupMembership.Role.LEADER
        )
        GroupMembership.objects.create(
            user=self.member1, group=self.group, role=GroupMembership.Role.MEMBER
        )

    def test_list_chats_auto_creates_group_chat(self):
        """Fetching chat list should automatically create missing group chats."""
        self.assertEqual(Chat.objects.count(), 0)

        self.client.login(email="leader@example.com", password="password123")
        response = self.client.get("/api/chat/")
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(len(data["chats"]), 1)
        self.assertEqual(data["chats"][0]["name"], "Chat Group")
        self.assertEqual(Chat.objects.count(), 1)

        chat = Chat.objects.first()
        self.assertEqual(chat.members.count(), 2)
        # Leader should be ADMIN in chat
        leader_member = chat.members.get(user=self.leader)
        self.assertEqual(leader_member.role, ChatMember.Role.ADMIN)

    def test_create_dm_chat(self):
        self.client.login(email="leader@example.com", password="password123")
        response = self.client.post(
            "/api/chat/",
            json.dumps({"participantId": str(self.member2.id)}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["chat"]["type"], "direct")

        # Verify DB
        chat = Chat.objects.get(type="direct")
        self.assertEqual(chat.members.count(), 2)

    def test_post_message(self):
        self.client.login(email="leader@example.com", password="password123")
        # trigger auto creation
        self.client.get("/api/chat/")
        chat = Chat.objects.get(group=self.group)

        response = self.client.post(
            f"/api/chat/{self.group.id}/messages/",
            json.dumps({"message": "Hello world!"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["message"]["message"], "Hello world!")

        msg = Message.objects.get(chat=chat)
        self.assertEqual(msg.body, "Hello world!")

    def test_delete_message_as_leader(self):
        chat = Chat.objects.create(
            type="group", group=self.group, created_by=self.leader
        )
        ChatMember.objects.create(chat=chat, user=self.leader, role="admin")
        ChatMember.objects.create(chat=chat, user=self.member1, role="member")

        msg = Message.objects.create(
            chat=chat, sender=self.member1, body="Bad message", message_type="user"
        )

        self.client.login(email="leader@example.com", password="password123")
        response = self.client.delete(f"/api/chat/{self.group.id}/messages/{msg.id}/")

        self.assertEqual(response.status_code, 200)
        msg.refresh_from_db()
        self.assertIsNotNone(msg.deleted_at)

        # When leader gets messages, they should see (Deleted)
        response = self.client.get("/api/chat/")
        data = response.json()
        chat_data = data["chats"][0]
        deleted_msg = chat_data["messages"][0]
        self.assertIn("(Deleted)", deleted_msg["message"])

    def test_delete_message_as_non_leader_fails(self):
        chat = Chat.objects.create(
            type="group", group=self.group, created_by=self.leader
        )
        ChatMember.objects.create(chat=chat, user=self.leader, role="admin")
        ChatMember.objects.create(chat=chat, user=self.member1, role="member")

        msg = Message.objects.create(
            chat=chat, sender=self.leader, body="Good message", message_type="user"
        )

        self.client.login(email="member1@example.com", password="password123")
        response = self.client.delete(f"/api/chat/{self.group.id}/messages/{msg.id}/")

        self.assertEqual(response.status_code, 403)
        msg.refresh_from_db()
        self.assertIsNone(msg.deleted_at)

    def test_non_member_cannot_access_chat(self):
        Chat.objects.create(type="group", group=self.group, created_by=self.leader)
        self.client.login(email="member2@example.com", password="password123")
        response = self.client.get(f"/api/chat/{self.group.id}/messages/")
        self.assertEqual(response.status_code, 403)
