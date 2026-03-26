from django.test import TestCase, Client
from django.contrib.auth import get_user_model
import json

from .models import Group, GroupMembership, SwipeEvent, Swipe
from venues.models import Venue
from accounts.models import UserPreference

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


class SwipeEventAPITests(TestCase):
    def setUp(self):
        self.client = Client()
        self.leader = User.objects.create_user(
            email="leader@nyu.edu", password="pass123"
        )
        self.member1 = User.objects.create_user(
            email="member1@nyu.edu", password="pass123"
        )
        self.member2 = User.objects.create_user(
            email="member2@nyu.edu", password="pass123"
        )
        self.non_member = User.objects.create_user(
            email="outsider@nyu.edu", password="pass123"
        )

        self.group = Group.objects.create(name="Test Group", created_by=self.leader)
        GroupMembership.objects.create(
            user=self.leader, group=self.group, role=GroupMembership.Role.LEADER
        )
        GroupMembership.objects.create(
            user=self.member1, group=self.group, role=GroupMembership.Role.MEMBER
        )
        GroupMembership.objects.create(
            user=self.member2, group=self.group, role=GroupMembership.Role.MEMBER
        )

        # Create venues
        self.venue1 = Venue.objects.create(
            name="Pizza Place", sanitation_grade="A", is_active=True
        )
        self.venue2 = Venue.objects.create(
            name="Sushi Spot", sanitation_grade="A", is_active=True
        )
        self.venue3 = Venue.objects.create(
            name="Burger Joint", sanitation_grade="B", is_active=True
        )

    def test_create_event_as_leader(self):
        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/events/",
            json.dumps({"name": "Friday Dinner"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["event"]["name"], "Friday Dinner")
        self.assertEqual(data["event"]["status"], "active")

    def test_create_event_as_member_forbidden(self):
        self.client.login(email="member1@nyu.edu", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/events/",
            json.dumps({"name": "Not Allowed"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_list_events(self):
        SwipeEvent.objects.create(
            group=self.group, name="Event 1", created_by=self.leader
        )
        SwipeEvent.objects.create(
            group=self.group, name="Event 2", created_by=self.leader
        )
        self.client.login(email="member1@nyu.edu", password="pass123")
        response = self.client.get(f"/api/groups/{self.group.id}/events/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["events"]), 2)

    def test_non_member_cannot_access(self):
        self.client.login(email="outsider@nyu.edu", password="pass123")
        response = self.client.get(f"/api/groups/{self.group.id}/events/")
        self.assertEqual(response.status_code, 403)

    def test_submit_swipe(self):
        event = SwipeEvent.objects.create(
            group=self.group, name="Test Event", created_by=self.leader
        )
        self.client.login(email="member1@nyu.edu", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/events/{event.id}/swipes/",
            json.dumps({"venue_id": self.venue1.id, "direction": "right"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["swipe"]["direction"], "right")

        # Verify swipe was recorded
        self.assertTrue(
            Swipe.objects.filter(
                event=event, user=self.member1, venue=self.venue1
            ).exists()
        )

    def test_duplicate_swipe_updates(self):
        event = SwipeEvent.objects.create(
            group=self.group, name="Test Event", created_by=self.leader
        )
        self.client.login(email="member1@nyu.edu", password="pass123")
        # First swipe right
        self.client.post(
            f"/api/groups/{self.group.id}/events/{event.id}/swipes/",
            json.dumps({"venue_id": self.venue1.id, "direction": "right"}),
            content_type="application/json",
        )
        # Change to left
        self.client.post(
            f"/api/groups/{self.group.id}/events/{event.id}/swipes/",
            json.dumps({"venue_id": self.venue1.id, "direction": "left"}),
            content_type="application/json",
        )
        swipe = Swipe.objects.get(event=event, user=self.member1, venue=self.venue1)
        self.assertEqual(swipe.direction, "left")
        # Should still be only 1 swipe
        self.assertEqual(
            Swipe.objects.filter(event=event, user=self.member1).count(), 1
        )

    def test_results_with_match(self):
        """All 3 members swipe right on venue1 -> match found."""
        event = SwipeEvent.objects.create(
            group=self.group, name="Match Event", created_by=self.leader
        )
        # All three swipe right on venue1
        for user in [self.leader, self.member1, self.member2]:
            Swipe.objects.create(
                event=event, user=user, venue=self.venue1, direction="right"
            )
            # Some swipe left on venue2
            Swipe.objects.create(
                event=event, user=user, venue=self.venue2, direction="left"
            )

        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.get(
            f"/api/groups/{self.group.id}/events/{event.id}/results/"
        )
        data = response.json()
        self.assertTrue(data["success"])
        self.assertTrue(data["match_found"])
        self.assertEqual(data["matched_venue"]["name"], "Pizza Place")
        self.assertEqual(data["likes_count"], 3)

        # Event should be marked completed
        event.refresh_from_db()
        self.assertEqual(event.status, SwipeEvent.Status.COMPLETED)

    def test_results_no_match(self):
        """Only 1 of 3 members swipes right -> no match (threshold is 2)."""
        event = SwipeEvent.objects.create(
            group=self.group, name="No Match Event", created_by=self.leader
        )
        # Only leader swipes right, others left
        Swipe.objects.create(
            event=event, user=self.leader, venue=self.venue1, direction="right"
        )
        Swipe.objects.create(
            event=event, user=self.member1, venue=self.venue1, direction="left"
        )
        Swipe.objects.create(
            event=event, user=self.member2, venue=self.venue1, direction="left"
        )

        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.get(
            f"/api/groups/{self.group.id}/events/{event.id}/results/"
        )
        data = response.json()
        self.assertTrue(data["success"])
        self.assertFalse(data["match_found"])
        self.assertIsNone(data["matched_venue"])

    def test_results_majority_match(self):
        """2 of 3 members swipe right -> match found (2/3 threshold = 2)."""
        event = SwipeEvent.objects.create(
            group=self.group, name="Majority Event", created_by=self.leader
        )
        Swipe.objects.create(
            event=event, user=self.leader, venue=self.venue1, direction="right"
        )
        Swipe.objects.create(
            event=event, user=self.member1, venue=self.venue1, direction="right"
        )
        Swipe.objects.create(
            event=event, user=self.member2, venue=self.venue1, direction="left"
        )

        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.get(
            f"/api/groups/{self.group.id}/events/{event.id}/results/"
        )
        data = response.json()
        self.assertTrue(data["match_found"])
        self.assertEqual(data["matched_venue"]["name"], "Pizza Place")
        self.assertEqual(data["likes_count"], 2)
        self.assertEqual(data["threshold"], 2)

    def test_get_venues_excludes_already_swiped(self):
        event = SwipeEvent.objects.create(
            group=self.group, name="Venues Event", created_by=self.leader
        )
        # Member1 already swiped on venue1
        Swipe.objects.create(
            event=event, user=self.member1, venue=self.venue1, direction="right"
        )

        self.client.login(email="member1@nyu.edu", password="pass123")
        response = self.client.get(
            f"/api/groups/{self.group.id}/events/{event.id}/venues/"
        )
        data = response.json()
        venue_ids = [v["id"] for v in data["venues"]]
        self.assertNotIn(str(self.venue1.id), venue_ids)

    def test_swipe_on_inactive_event(self):
        event = SwipeEvent.objects.create(
            group=self.group,
            name="Done Event",
            created_by=self.leader,
            status=SwipeEvent.Status.COMPLETED,
        )
        self.client.login(email="member1@nyu.edu", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/events/{event.id}/swipes/",
            json.dumps({"venue_id": self.venue1.id, "direction": "right"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_swipe_event_str(self):
        event = SwipeEvent.objects.create(
            group=self.group, name="Dinner", created_by=self.leader
        )
        self.assertEqual(str(event), "Dinner (Test Group)")

    def test_swipe_str(self):
        event = SwipeEvent.objects.create(
            group=self.group, name="Dinner", created_by=self.leader
        )
        swipe = Swipe.objects.create(
            event=event, user=self.leader, venue=self.venue1, direction="right"
        )
        self.assertEqual(str(swipe), "leader@nyu.edu swiped right on Pizza Place")

    def test_venues_filtered_by_sanitation_grade(self):
        """Venues with grade below strictest member preference are excluded."""
        # Give member1 a strict preference (only grade A)
        UserPreference.objects.create(user=self.member1, minimum_sanitation_grade="A")

        event = SwipeEvent.objects.create(
            group=self.group, name="Filter Event", created_by=self.leader
        )

        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.get(
            f"/api/groups/{self.group.id}/events/{event.id}/venues/"
        )
        data = response.json()
        venue_grades = [v["sanitationGrade"] for v in data["venues"]]
        # venue3 has grade B, should be excluded because member1 requires A
        self.assertNotIn("B", venue_grades)
