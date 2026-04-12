import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from django.urls import reverse
from django.utils import timezone

from chat.models import Chat, ChatMember, Message
from groups.models import Group, GroupMembership

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


# ---------------------------------------------------------------------------
# Additional coverage — error paths, auth checks, DM flows, mute,
# and message deletion edge cases.
# ---------------------------------------------------------------------------


def _make_user(email):
    return User.objects.create_user(email=email, password="pass12345")


class ChatListCreateEdgeCasesTests(TestCase):
    def setUp(self):
        self.alice = _make_user("alice@example.com")
        self.bob = _make_user("bob@example.com")
        self.url = reverse("chat-list-create")

    def test_requires_authentication_get(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 401)

    def test_requires_authentication_post(self):
        resp = self.client.post(
            self.url,
            data=json.dumps({"participantId": self.bob.id}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 401)

    def test_method_not_allowed(self):
        self.client.force_login(self.alice)
        resp = self.client.patch(self.url)
        self.assertEqual(resp.status_code, 405)

    def test_create_dm_missing_participant_id(self):
        self.client.force_login(self.alice)
        resp = self.client.post(
            self.url,
            data=json.dumps({}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_create_dm_user_not_found(self):
        self.client.force_login(self.alice)
        resp = self.client.post(
            self.url,
            data=json.dumps({"participantId": 99999}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 404)

    def test_create_dm_invalid_json(self):
        self.client.force_login(self.alice)
        resp = self.client.post(
            self.url, data="not json", content_type="application/json"
        )
        self.assertEqual(resp.status_code, 400)

    def test_create_dm_returns_existing(self):
        """A second POST with the same participant should return the existing DM."""
        self.client.force_login(self.alice)
        first = self.client.post(
            self.url,
            data=json.dumps({"participantId": self.bob.id}),
            content_type="application/json",
        )
        self.assertEqual(first.status_code, 201)
        second = self.client.post(
            self.url,
            data=json.dumps({"participantId": self.bob.id}),
            content_type="application/json",
        )
        self.assertEqual(second.status_code, 200)
        # Only one DM should exist.
        self.assertEqual(Chat.objects.filter(type=Chat.ChatType.DIRECT).count(), 1)

    @patch("chat.views.Chat.objects")
    def test_get_exception_returns_500(self, mock_objects):
        mock_objects.filter.side_effect = Exception("boom")
        self.client.force_login(self.alice)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 500)

    @patch("chat.views.Chat.objects")
    def test_post_exception_returns_500(self, mock_objects):
        mock_objects.filter.side_effect = Exception("boom")
        self.client.force_login(self.alice)
        resp = self.client.post(
            self.url,
            data=json.dumps({"participantId": self.bob.id}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 500)


class ChatMessagesEdgeCasesTests(TestCase):
    def setUp(self):
        self.leader = _make_user("leader@example.com")
        self.member = _make_user("member@example.com")
        self.outsider = _make_user("outsider@example.com")

        self.group = Group.objects.create(name="Test Group", created_by=self.leader)
        GroupMembership.objects.create(
            user=self.leader, group=self.group, role=GroupMembership.Role.LEADER
        )
        GroupMembership.objects.create(
            user=self.member, group=self.group, role=GroupMembership.Role.MEMBER
        )

    def _url(self, chat_id):
        return reverse("chat-messages", args=[chat_id])

    def test_requires_authentication(self):
        resp = self.client.get(self._url(self.group.id))
        self.assertEqual(resp.status_code, 401)

    def test_dm_chat_not_found(self):
        self.client.force_login(self.leader)
        resp = self.client.get(self._url("dm-99999"))
        self.assertEqual(resp.status_code, 404)

    def test_group_not_found_numeric(self):
        self.client.force_login(self.leader)
        resp = self.client.get(self._url(99999))
        self.assertEqual(resp.status_code, 404)

    def test_group_not_found_non_numeric(self):
        """Passing a non-int group id should raise ValueError → 404."""
        self.client.force_login(self.leader)
        resp = self.client.get(self._url("abc"))
        self.assertEqual(resp.status_code, 404)

    def test_non_member_of_group_forbidden(self):
        self.client.force_login(self.outsider)
        resp = self.client.get(self._url(self.group.id))
        self.assertEqual(resp.status_code, 403)

    def test_lazy_provisions_group_chat_on_first_get(self):
        """First GET lazily creates the Chat + members."""
        self.assertFalse(Chat.objects.filter(group=self.group).exists())
        self.client.force_login(self.leader)
        resp = self.client.get(self._url(self.group.id))
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(Chat.objects.filter(group=self.group).exists())
        chat = Chat.objects.get(group=self.group)
        self.assertEqual(chat.members.count(), 2)

    def test_get_messages_returns_empty_list(self):
        # Provision once then read.
        self.client.force_login(self.leader)
        resp = self.client.get(self._url(self.group.id))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["messages"], [])

    def test_post_empty_body_returns_400(self):
        self.client.force_login(self.leader)
        # First GET provisions chat.
        self.client.get(self._url(self.group.id))
        resp = self.client.post(
            self._url(self.group.id),
            data=json.dumps({"message": ""}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_post_when_muted_forbidden(self):
        self.client.force_login(self.leader)
        self.client.get(self._url(self.group.id))  # provision
        chat = Chat.objects.get(group=self.group)
        leader_membership = ChatMember.objects.get(chat=chat, user=self.leader)
        leader_membership.is_muted = True
        leader_membership.save()
        resp = self.client.post(
            self._url(self.group.id),
            data=json.dumps({"message": "hi"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_method_not_allowed(self):
        self.client.force_login(self.leader)
        self.client.get(self._url(self.group.id))
        resp = self.client.delete(self._url(self.group.id))
        self.assertEqual(resp.status_code, 405)

    def test_invalid_json_body_returns_400(self):
        self.client.force_login(self.leader)
        self.client.get(self._url(self.group.id))
        resp = self.client.post(
            self._url(self.group.id),
            data="not json",
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_left_member_cannot_access(self):
        """A member whose left_at is set should get 403."""
        self.client.force_login(self.leader)
        self.client.get(self._url(self.group.id))  # provision
        chat = Chat.objects.get(group=self.group)
        membership = ChatMember.objects.get(chat=chat, user=self.member)
        membership.left_at = timezone.now()
        membership.save()
        self.client.force_login(self.member)
        # The member still has a GroupMembership, so we pass the 403
        # check in the outer membership query, but the chat-level
        # ChatMember filter excludes them with left_at set.
        resp = self.client.get(self._url(self.group.id))
        self.assertEqual(resp.status_code, 403)


class ChatDmMessagesTests(TestCase):
    """Tests the dm-<id> id path for api_chat_messages."""

    def setUp(self):
        self.alice = _make_user("alice@example.com")
        self.bob = _make_user("bob@example.com")
        self.chat = Chat.objects.create(
            type=Chat.ChatType.DIRECT, created_by=self.alice
        )
        ChatMember.objects.create(chat=self.chat, user=self.alice)
        ChatMember.objects.create(chat=self.chat, user=self.bob)

    def test_post_message_in_dm(self):
        self.client.force_login(self.alice)
        url = reverse("chat-messages", args=[f"dm-{self.chat.id}"])
        resp = self.client.post(
            url,
            data=json.dumps({"message": "hello"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(Message.objects.filter(chat=self.chat).count(), 1)

    def test_get_messages_in_dm(self):
        Message.objects.create(chat=self.chat, sender=self.alice, body="hi")
        self.client.force_login(self.alice)
        url = reverse("chat-messages", args=[f"dm-{self.chat.id}"])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()["messages"]), 1)


class ChatMessageDetailTests(TestCase):
    def setUp(self):
        self.leader = _make_user("leader@example.com")
        self.member = _make_user("member@example.com")
        self.outsider = _make_user("outsider@example.com")

        self.group = Group.objects.create(name="G", created_by=self.leader)
        GroupMembership.objects.create(
            user=self.leader, group=self.group, role=GroupMembership.Role.LEADER
        )
        GroupMembership.objects.create(
            user=self.member, group=self.group, role=GroupMembership.Role.MEMBER
        )

        # Provision the group chat via API call.
        self.client.force_login(self.leader)
        self.client.get(reverse("chat-messages", args=[self.group.id]))
        self.chat = Chat.objects.get(group=self.group)
        self.message = Message.objects.create(
            chat=self.chat, sender=self.member, body="hi"
        )
        self.client.logout()

    def _url(self, chat_id, message_id):
        return reverse("chat-message-detail", args=[chat_id, message_id])

    def test_method_not_allowed(self):
        self.client.force_login(self.leader)
        resp = self.client.get(self._url(self.group.id, self.message.id))
        self.assertEqual(resp.status_code, 405)

    def test_requires_auth(self):
        resp = self.client.delete(self._url(self.group.id, self.message.id))
        self.assertEqual(resp.status_code, 401)

    def test_chat_not_found(self):
        self.client.force_login(self.leader)
        resp = self.client.delete(self._url(99999, self.message.id))
        self.assertEqual(resp.status_code, 404)

    def test_dm_chat_not_found(self):
        self.client.force_login(self.leader)
        resp = self.client.delete(self._url("dm-99999", self.message.id))
        self.assertEqual(resp.status_code, 404)

    def test_non_member_forbidden(self):
        self.client.force_login(self.outsider)
        resp = self.client.delete(self._url(self.group.id, self.message.id))
        self.assertEqual(resp.status_code, 403)

    def test_non_admin_forbidden(self):
        self.client.force_login(self.member)
        resp = self.client.delete(self._url(self.group.id, self.message.id))
        self.assertEqual(resp.status_code, 403)

    def test_message_not_found(self):
        self.client.force_login(self.leader)
        resp = self.client.delete(self._url(self.group.id, 99999))
        self.assertEqual(resp.status_code, 404)

    def test_delete_success_strips_msg_prefix(self):
        self.client.force_login(self.leader)
        resp = self.client.delete(self._url(self.group.id, f"msg-{self.message.id}"))
        self.assertEqual(resp.status_code, 200)
        self.message.refresh_from_db()
        self.assertIsNotNone(self.message.deleted_at)

    def test_already_deleted(self):
        self.message.deleted_at = timezone.now()
        self.message.save()
        self.client.force_login(self.leader)
        resp = self.client.delete(self._url(self.group.id, self.message.id))
        self.assertEqual(resp.status_code, 400)

    def test_deleted_message_body_masked_for_non_admin(self):
        """After deletion, non-admin members should see the masked body."""
        self.message.deleted_at = timezone.now()
        self.message.save()
        self.client.force_login(self.member)
        resp = self.client.get(reverse("chat-messages", args=[self.group.id]))
        msgs = resp.json()["messages"]
        self.assertEqual(msgs[0]["message"], "[This message has been deleted]")
        self.assertTrue(msgs[0]["is_deleted"])

    def test_deleted_message_body_marked_for_admin(self):
        self.message.deleted_at = timezone.now()
        self.message.save()
        self.client.force_login(self.leader)
        resp = self.client.get(reverse("chat-messages", args=[self.group.id]))
        msgs = resp.json()["messages"]
        self.assertIn("(Deleted)", msgs[0]["message"])


class ChatMuteMemberTests(TestCase):
    def setUp(self):
        self.leader = _make_user("leader@example.com")
        self.member = _make_user("member@example.com")
        self.outsider = _make_user("outsider@example.com")

        self.group = Group.objects.create(name="G", created_by=self.leader)
        GroupMembership.objects.create(
            user=self.leader, group=self.group, role=GroupMembership.Role.LEADER
        )
        GroupMembership.objects.create(
            user=self.member, group=self.group, role=GroupMembership.Role.MEMBER
        )

        # Provision the chat.
        self.client.force_login(self.leader)
        self.client.get(reverse("chat-messages", args=[self.group.id]))
        self.chat = Chat.objects.get(group=self.group)
        self.client.logout()

    def _url(self, chat_id, user_id):
        return reverse("chat-member-mute", args=[chat_id, user_id])

    def test_method_not_allowed(self):
        self.client.force_login(self.leader)
        resp = self.client.get(self._url(self.group.id, self.member.id))
        self.assertEqual(resp.status_code, 405)

    def test_requires_auth(self):
        resp = self.client.post(self._url(self.group.id, self.member.id))
        self.assertEqual(resp.status_code, 401)

    def test_chat_not_found(self):
        self.client.force_login(self.leader)
        resp = self.client.post(self._url(99999, self.member.id))
        self.assertEqual(resp.status_code, 404)

    def test_dm_chat_not_found(self):
        self.client.force_login(self.leader)
        resp = self.client.post(self._url("dm-99999", self.member.id))
        self.assertEqual(resp.status_code, 404)

    def test_non_admin_cannot_mute(self):
        self.client.force_login(self.member)
        resp = self.client.post(self._url(self.group.id, self.leader.id))
        self.assertEqual(resp.status_code, 403)

    def test_outsider_cannot_mute(self):
        self.client.force_login(self.outsider)
        resp = self.client.post(self._url(self.group.id, self.member.id))
        self.assertEqual(resp.status_code, 403)

    def test_target_not_in_chat(self):
        new_user = _make_user("nobody@example.com")
        self.client.force_login(self.leader)
        resp = self.client.post(self._url(self.group.id, new_user.id))
        self.assertEqual(resp.status_code, 404)

    def test_mute_toggles(self):
        self.client.force_login(self.leader)
        resp = self.client.post(self._url(self.group.id, self.member.id))
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["is_muted"])

        resp = self.client.post(self._url(self.group.id, self.member.id))
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.json()["is_muted"])

    def test_dm_chat_path(self):
        dm = Chat.objects.create(type=Chat.ChatType.DIRECT, created_by=self.leader)
        ChatMember.objects.create(chat=dm, user=self.leader, role=ChatMember.Role.ADMIN)
        ChatMember.objects.create(chat=dm, user=self.member)
        self.client.force_login(self.leader)
        resp = self.client.post(self._url(f"dm-{dm.id}", self.member.id))
        self.assertEqual(resp.status_code, 200)

    @patch("chat.views.ChatMember.objects")
    def test_exception_returns_500(self, mock_objects):
        mock_objects.filter.side_effect = Exception("boom")
        self.client.force_login(self.leader)
        resp = self.client.post(self._url(self.group.id, self.member.id))
        self.assertEqual(resp.status_code, 500)
