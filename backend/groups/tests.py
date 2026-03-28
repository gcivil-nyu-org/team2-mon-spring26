from django.test import TestCase, Client
from django.contrib.auth import get_user_model
import json

from .models import Group, GroupMembership

User = get_user_model()


class GroupAPITests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user1 = User.objects.create_user(
            email="alice@example.com", password="password123"
        )
        self.user2 = User.objects.create_user(
            email="bob@example.com", password="password123"
        )
        self.user3 = User.objects.create_user(
            email="charlie@example.com", password="password123"
        )

    def test_create_group(self):
        """Test creating a group. Creator should automatically become a leader."""
        self.client.login(email="alice@example.com", password="password123")
        response = self.client.post(
            "/api/groups/",
            json.dumps(
                {
                    "name": "Dinner Club",
                    "group_type": "casual",
                    "privacy": "invite-only",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])

        group_id = data["group"]["id"]
        group = Group.objects.get(id=group_id)
        self.assertEqual(group.name, "Dinner Club")
        self.assertEqual(group.privacy, Group.PrivacyType.INVITE_ONLY)

        membership = GroupMembership.objects.get(user=self.user1, group=group)
        self.assertEqual(membership.role, GroupMembership.Role.LEADER)

    def test_edit_group_as_leader(self):
        group = Group.objects.create(name="Breakfast Club", created_by=self.user1)
        GroupMembership.objects.create(
            user=self.user1, group=group, role=GroupMembership.Role.LEADER
        )

        self.client.login(email="alice@example.com", password="password123")
        response = self.client.patch(
            f"/api/groups/{group.id}/",
            json.dumps({"name": "Brunch Club"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        group.refresh_from_db()
        self.assertEqual(group.name, "Brunch Club")

    def test_edit_group_as_member_fails(self):
        group = Group.objects.create(name="Breakfast Club", created_by=self.user1)
        GroupMembership.objects.create(
            user=self.user1, group=group, role=GroupMembership.Role.LEADER
        )
        GroupMembership.objects.create(
            user=self.user2, group=group, role=GroupMembership.Role.MEMBER
        )

        self.client.login(email="bob@example.com", password="password123")
        response = self.client.patch(
            f"/api/groups/{group.id}/",
            json.dumps({"name": "Hacked Club"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_invite_member(self):
        group = Group.objects.create(name="Lunch Club", created_by=self.user1)
        GroupMembership.objects.create(
            user=self.user1, group=group, role=GroupMembership.Role.LEADER
        )

        self.client.login(email="alice@example.com", password="password123")
        response = self.client.post(
            f"/api/groups/{group.id}/invite/",
            json.dumps({"email": "bob@example.com"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            GroupMembership.objects.filter(user=self.user2, group=group).exists()
        )

    def test_cannot_leave_if_only_leader(self):
        group = Group.objects.create(name="Solo Club", created_by=self.user1)
        GroupMembership.objects.create(
            user=self.user1, group=group, role=GroupMembership.Role.LEADER
        )
        GroupMembership.objects.create(
            user=self.user2, group=group, role=GroupMembership.Role.MEMBER
        )

        self.client.login(email="alice@example.com", password="password123")
        response = self.client.post(f"/api/groups/{group.id}/leave/")
        self.assertEqual(response.status_code, 400)
        self.assertIn("only leader", response.json()["error"])

    def test_update_group_constraints_as_leader(self):
        group = Group.objects.create(name="Constraint Club", created_by=self.user1)
        GroupMembership.objects.create(
            user=self.user1, group=group, role=GroupMembership.Role.LEADER
        )
        self.client.login(email="alice@example.com", password="password123")
        response = self.client.patch(
            f"/api/groups/{group.id}/constraints/",
            json.dumps({
                "dietary": ["Vegetarian"],
                "cuisines": ["Italian"],
                "foodTypes": ["Breakfast"],
                "minimumSanitationGrade": "B"
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        group.refresh_from_db()
        self.assertEqual(group.constraints.minimum_sanitation_grade, "B")
        self.assertTrue(group.constraints.dietary_tags.filter(name="Vegetarian").exists())
        self.assertTrue(group.constraints.cuisine_types.filter(name="Italian").exists())

    def test_update_group_constraints_as_member_fails(self):
        group = Group.objects.create(name="Constraint Club", created_by=self.user1)
        GroupMembership.objects.create(
            user=self.user1, group=group, role=GroupMembership.Role.LEADER
        )
        GroupMembership.objects.create(
            user=self.user2, group=group, role=GroupMembership.Role.MEMBER
        )
        self.client.login(email="bob@example.com", password="password123")
        response = self.client.patch(
            f"/api/groups/{group.id}/constraints/",
            json.dumps({"minimumSanitationGrade": "A"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_update_group_constraints_invalid_grade_ignored(self):
        group = Group.objects.create(name="Constraint Club", created_by=self.user1)
        GroupMembership.objects.create(
            user=self.user1, group=group, role=GroupMembership.Role.LEADER
        )
        from .models import GroupConstraint
        GroupConstraint.objects.create(group=group, minimum_sanitation_grade="A")

        self.client.login(email="alice@example.com", password="password123")
        response = self.client.patch(
            f"/api/groups/{group.id}/constraints/",
            json.dumps({"minimumSanitationGrade": "Z"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        group.refresh_from_db()
        self.assertEqual(group.constraints.minimum_sanitation_grade, "A")


class GroupModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="test@nyu.edu", password="testpass123"
        )
        self.group = Group.objects.create(name="Lunch Crew", created_by=self.user)

    def test_group_str(self):
        self.assertEqual(str(self.group), "Lunch Crew")


class GroupMembershipModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="test@nyu.edu", password="testpass123"
        )
        self.group = Group.objects.create(name="Lunch Crew", created_by=self.user)
        self.membership = GroupMembership.objects.create(
            user=self.user, group=self.group, role=GroupMembership.Role.LEADER
        )

    def test_membership_str(self):
        self.assertEqual(str(self.membership), "test@nyu.edu in Lunch Crew (leader)")
