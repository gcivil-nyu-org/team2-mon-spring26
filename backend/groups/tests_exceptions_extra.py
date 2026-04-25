from django.test import TestCase
from django.urls import reverse
from unittest.mock import patch
from accounts.models import User
from .models import Group, GroupMembership


class ExceptionCoverageTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com", username="testuser", password="password123"
        )
        self.client.login(username="testuser", password="password123")
        self.group = Group.objects.create(name="Test Group", created_by=self.user)
        GroupMembership.objects.create(
            group=self.group, user=self.user, role=GroupMembership.Role.LEADER
        )

    @patch("groups.views.Group.objects.get", side_effect=Exception("boom"))
    def test_exceptions_views(self, mock_get):
        endpoints = [
            ("api_edit_group", [self.group.id]),
            ("api_delete_group", [self.group.id]),
            ("api_invite_to_group", [self.group.id]),
            ("api_remove_from_group", [self.group.id, self.user.id]),
            ("api_make_leader", [self.group.id, self.user.id]),
            ("api_leave_group", [self.group.id]),
            ("api_swipe_events", [self.group.id]),
            ("api_group_effective_constraints", [self.group.id]),
            ("api_group_preview_venues", [self.group.id]),
        ]

        for url_name, args in endpoints:
            url = reverse(url_name, args=args)
            self.client.get(url)
            self.client.post(url, "{}", content_type="application/json")
            self.client.patch(url, "{}", content_type="application/json")
            self.client.delete(url)
