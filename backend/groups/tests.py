import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from django.urls import reverse

from accounts.models import UserPreference
from chat.models import Chat, ChatMember, Message
from groups.models import (
    Group,
    GroupMembership,
    SwipeEvent,
    Swipe,
    GroupInvitation,
)
from venues.models import Venue, VenuePhoto

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
            GroupInvitation.objects.filter(
                invitee=self.user2, group=group, status="pending"
            ).exists()
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
            json.dumps(
                {
                    "dietary": ["Vegetarian"],
                    "cuisines": ["Italian"],
                    "foodTypes": ["Breakfast"],
                    "minimumSanitationGrade": "B",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        group.refresh_from_db()
        self.assertEqual(group.constraints.minimum_sanitation_grade, "B")
        self.assertTrue(
            group.constraints.dietary_tags.filter(name="Vegetarian").exists()
        )
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
            json.dumps({"minimumSanitationGrade": "INVALID"}),
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

        # Create venues with google_place_id and a pre-cached photo so they pass
        # the "has place ID or photo" filter and bulk_prefetch_photos skips API calls.
        self.venue1 = Venue.objects.create(
            name="Pizza Place",
            sanitation_grade="A",
            is_active=True,
            google_place_id="test_place_id_1",
        )
        VenuePhoto.objects.create(
            venue=self.venue1,
            image_url="https://example.com/pizza.jpg",
            source="google_places",
            is_primary=True,
        )
        self.venue2 = Venue.objects.create(
            name="Sushi Spot",
            sanitation_grade="A",
            is_active=True,
            google_place_id="test_place_id_2",
        )
        VenuePhoto.objects.create(
            venue=self.venue2,
            image_url="https://example.com/sushi.jpg",
            source="google_places",
            is_primary=True,
        )
        self.venue3 = Venue.objects.create(
            name="Burger Joint",
            sanitation_grade="B",
            is_active=True,
            google_place_id="test_place_id_3",
        )
        VenuePhoto.objects.create(
            venue=self.venue3,
            image_url="https://example.com/burger.jpg",
            source="google_places",
            is_primary=True,
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

    def test_swipe_on_inactive_venue(self):
        """Cannot swipe on a venue that is not active."""
        inactive_venue = Venue.objects.create(
            name="Closed Place", sanitation_grade="A", is_active=False
        )
        event = SwipeEvent.objects.create(
            group=self.group, name="Event", created_by=self.leader
        )
        self.client.login(email="member1@nyu.edu", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/events/{event.id}/swipes/",
            json.dumps({"venue_id": inactive_venue.id, "direction": "right"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("not active", response.json()["error"])

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

    def test_results_cached_after_match(self):
        """Once a match is found and saved, subsequent calls return cached result."""
        event = SwipeEvent.objects.create(
            group=self.group, name="Cached Event", created_by=self.leader
        )
        for user in [self.leader, self.member1, self.member2]:
            Swipe.objects.create(
                event=event, user=user, venue=self.venue1, direction="right"
            )
        # First call computes the match
        self.client.login(email="leader@nyu.edu", password="pass123")
        self.client.get(f"/api/groups/{self.group.id}/events/{event.id}/results/")
        # Second call should return cached result
        response = self.client.get(
            f"/api/groups/{self.group.id}/events/{event.id}/results/"
        )
        data = response.json()
        self.assertTrue(data["match_found"])
        self.assertEqual(data["matched_venue"]["name"], "Pizza Place")

    def test_results_no_swipes(self):
        """Results with no swipes returns match_found=False; participants = group size."""
        event = SwipeEvent.objects.create(
            group=self.group, name="Empty Event", created_by=self.leader
        )
        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.get(
            f"/api/groups/{self.group.id}/events/{event.id}/results/"
        )
        data = response.json()
        self.assertFalse(data["match_found"])
        # total_participants is based on group member count, not swipe count
        self.assertEqual(data["total_participants"], 3)

    def test_results_non_member_forbidden(self):
        """Non-member cannot access results."""
        event = SwipeEvent.objects.create(
            group=self.group, name="Secret Event", created_by=self.leader
        )
        self.client.login(email="outsider@nyu.edu", password="pass123")
        response = self.client.get(
            f"/api/groups/{self.group.id}/events/{event.id}/results/"
        )
        self.assertEqual(response.status_code, 403)

    def test_results_method_not_allowed(self):
        event = SwipeEvent.objects.create(
            group=self.group, name="Event", created_by=self.leader
        )
        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/events/{event.id}/results/"
        )
        self.assertEqual(response.status_code, 405)

    def test_results_unauthenticated(self):
        event = SwipeEvent.objects.create(
            group=self.group, name="Event", created_by=self.leader
        )
        response = self.client.get(
            f"/api/groups/{self.group.id}/events/{event.id}/results/"
        )
        self.assertEqual(response.status_code, 401)

    def test_swipe_missing_venue_id(self):
        event = SwipeEvent.objects.create(
            group=self.group, name="Event", created_by=self.leader
        )
        self.client.login(email="member1@nyu.edu", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/events/{event.id}/swipes/",
            json.dumps({"direction": "right"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_swipe_invalid_direction(self):
        event = SwipeEvent.objects.create(
            group=self.group, name="Event", created_by=self.leader
        )
        self.client.login(email="member1@nyu.edu", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/events/{event.id}/swipes/",
            json.dumps({"venue_id": self.venue1.id, "direction": "up"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_swipe_venue_not_found(self):
        event = SwipeEvent.objects.create(
            group=self.group, name="Event", created_by=self.leader
        )
        self.client.login(email="member1@nyu.edu", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/events/{event.id}/swipes/",
            json.dumps({"venue_id": 99999, "direction": "right"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)

    def test_swipe_method_not_allowed(self):
        event = SwipeEvent.objects.create(
            group=self.group, name="Event", created_by=self.leader
        )
        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.get(
            f"/api/groups/{self.group.id}/events/{event.id}/swipes/"
        )
        self.assertEqual(response.status_code, 405)

    def test_swipe_unauthenticated(self):
        event = SwipeEvent.objects.create(
            group=self.group, name="Event", created_by=self.leader
        )
        response = self.client.post(
            f"/api/groups/{self.group.id}/events/{event.id}/swipes/",
            json.dumps({"venue_id": self.venue1.id, "direction": "right"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)

    def test_swipe_non_member_forbidden(self):
        event = SwipeEvent.objects.create(
            group=self.group, name="Event", created_by=self.leader
        )
        self.client.login(email="outsider@nyu.edu", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/events/{event.id}/swipes/",
            json.dumps({"venue_id": self.venue1.id, "direction": "right"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_swipe_event_not_found(self):
        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/events/99999/swipes/",
            json.dumps({"venue_id": self.venue1.id, "direction": "right"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)

    def test_swipe_group_not_found(self):
        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.post(
            "/api/groups/99999/events/1/swipes/",
            json.dumps({"venue_id": self.venue1.id, "direction": "right"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)

    def test_swipe_invalid_json(self):
        event = SwipeEvent.objects.create(
            group=self.group, name="Event", created_by=self.leader
        )
        self.client.login(email="member1@nyu.edu", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/events/{event.id}/swipes/",
            "not json",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_venues_method_not_allowed(self):
        event = SwipeEvent.objects.create(
            group=self.group, name="Event", created_by=self.leader
        )
        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/events/{event.id}/venues/"
        )
        self.assertEqual(response.status_code, 405)

    def test_venues_unauthenticated(self):
        event = SwipeEvent.objects.create(
            group=self.group, name="Event", created_by=self.leader
        )
        response = self.client.get(
            f"/api/groups/{self.group.id}/events/{event.id}/venues/"
        )
        self.assertEqual(response.status_code, 401)

    def test_venues_non_member_forbidden(self):
        event = SwipeEvent.objects.create(
            group=self.group, name="Event", created_by=self.leader
        )
        self.client.login(email="outsider@nyu.edu", password="pass123")
        response = self.client.get(
            f"/api/groups/{self.group.id}/events/{event.id}/venues/"
        )
        self.assertEqual(response.status_code, 403)

    def test_venues_event_not_found(self):
        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.get(f"/api/groups/{self.group.id}/events/99999/venues/")
        self.assertEqual(response.status_code, 404)

    def test_venues_group_not_found(self):
        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.get("/api/groups/99999/events/1/venues/")
        self.assertEqual(response.status_code, 404)

    def test_events_method_not_allowed(self):
        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.delete(f"/api/groups/{self.group.id}/events/")
        self.assertEqual(response.status_code, 405)

    def test_events_unauthenticated(self):
        response = self.client.get(f"/api/groups/{self.group.id}/events/")
        self.assertEqual(response.status_code, 401)

    def test_events_group_not_found(self):
        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.get("/api/groups/99999/events/")
        self.assertEqual(response.status_code, 404)

    def test_create_event_invalid_json(self):
        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/events/",
            "not json",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_create_event_empty_name(self):
        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/events/",
            json.dumps({"name": "  "}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_results_group_not_found(self):
        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.get("/api/groups/99999/events/1/results/")
        self.assertEqual(response.status_code, 404)

    def test_results_event_not_found(self):
        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.get(f"/api/groups/{self.group.id}/events/99999/results/")
        self.assertEqual(response.status_code, 404)

    def test_venues_filtered_by_borough(self):
        """Venues are filtered to match the event's borough."""
        # Set boroughs on venues
        self.venue1.borough = "Manhattan"
        self.venue1.save()
        self.venue2.borough = "Brooklyn"
        self.venue2.save()
        self.venue3.borough = "Manhattan"
        self.venue3.save()

        event = SwipeEvent.objects.create(
            group=self.group,
            name="Manhattan Dinner",
            created_by=self.leader,
            borough="Manhattan",
        )

        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.get(
            f"/api/groups/{self.group.id}/events/{event.id}/venues/"
        )
        data = response.json()
        venue_names = [v["name"] for v in data["venues"]]
        # Only Manhattan venues should appear
        self.assertIn("Pizza Place", venue_names)
        self.assertNotIn("Sushi Spot", venue_names)  # Brooklyn

    def test_venues_no_borough_filter_returns_all(self):
        """When event has no borough set, all venues are returned."""
        self.venue1.borough = "Manhattan"
        self.venue1.save()
        self.venue2.borough = "Brooklyn"
        self.venue2.save()

        event = SwipeEvent.objects.create(
            group=self.group,
            name="Any Location",
            created_by=self.leader,
            borough="",
        )

        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.get(
            f"/api/groups/{self.group.id}/events/{event.id}/venues/"
        )
        data = response.json()
        venue_names = [v["name"] for v in data["venues"]]
        self.assertIn("Pizza Place", venue_names)
        self.assertIn("Sushi Spot", venue_names)

    def test_create_event_with_borough(self):
        """Creating an event with borough/neighborhood stores them."""
        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/events/",
            json.dumps(
                {
                    "name": "Brooklyn Dinner",
                    "borough": "Brooklyn",
                    "neighborhood": "DUMBO",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["event"]["borough"], "Brooklyn")
        self.assertEqual(data["event"]["neighborhood"], "DUMBO")

    def test_venues_filtered_by_borough_case_insensitive(self):
        """Borough filtering is case-insensitive."""
        self.venue1.borough = "manhattan"
        self.venue1.save()
        self.venue2.borough = "Brooklyn"
        self.venue2.save()

        event = SwipeEvent.objects.create(
            group=self.group,
            name="Manhattan Dinner",
            created_by=self.leader,
            borough="Manhattan",
        )

        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.get(
            f"/api/groups/{self.group.id}/events/{event.id}/venues/"
        )
        data = response.json()
        venue_names = [v["name"] for v in data["venues"]]
        self.assertIn("Pizza Place", venue_names)
        self.assertNotIn("Sushi Spot", venue_names)

    def test_venues_without_place_id_and_photos_are_excluded(self):
        """Venues with no google_place_id and no photos must not appear in swipe results."""
        Venue.objects.create(
            name="Ghost Venue",
            sanitation_grade="A",
            is_active=True,
            # no google_place_id, no VenuePhoto
        )

        event = SwipeEvent.objects.create(
            group=self.group,
            name="Exclusion Test",
            created_by=self.leader,
        )

        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.get(
            f"/api/groups/{self.group.id}/events/{event.id}/venues/"
        )
        data = response.json()
        venue_names = [v["name"] for v in data["venues"]]
        self.assertNotIn("Ghost Venue", venue_names)

    @patch("groups.views.bulk_prefetch_photos")
    def test_venues_photos_appear_on_first_load(self, mock_bulk):
        """Photos created by bulk_prefetch_photos must be visible on the first response,
        not only after a second request (regression for stale prefetch cache bug)."""

        venue = Venue.objects.create(
            name="Photo Test Venue",
            sanitation_grade="A",
            is_active=True,
            google_place_id="test_place_photo_load",
        )

        def _create_photo(venues_list, **kwargs):
            for v in venues_list:
                if v.id == venue.id:
                    VenuePhoto.objects.get_or_create(
                        venue=v,
                        source="google_places",
                        is_primary=True,
                        defaults={
                            "image_url": "https://lh3.googleusercontent.com/test"
                        },
                    )

        mock_bulk.side_effect = _create_photo

        event = SwipeEvent.objects.create(
            group=self.group,
            name="Photo Load Test",
            created_by=self.leader,
        )

        self.client.login(email="leader@nyu.edu", password="pass123")
        response = self.client.get(
            f"/api/groups/{self.group.id}/events/{event.id}/venues/"
        )
        data = response.json()
        match = next(
            (v for v in data["venues"] if v["name"] == "Photo Test Venue"), None
        )
        self.assertIsNotNone(match)
        self.assertIn("https://lh3.googleusercontent.com/test", match["images"])


class GroupManagementAPITests(TestCase):
    """Tests for group CRUD, invite, remove, make leader, leave endpoints."""

    def setUp(self):
        self.client = Client()
        self.leader = User.objects.create_user(
            email="leader@example.com", password="pass123"
        )
        self.member = User.objects.create_user(
            email="member@example.com", password="pass123"
        )
        self.outsider = User.objects.create_user(
            email="outsider@example.com", password="pass123"
        )

        self.group = Group.objects.create(name="Test Group", created_by=self.leader)
        GroupMembership.objects.create(
            user=self.leader, group=self.group, role=GroupMembership.Role.LEADER
        )
        GroupMembership.objects.create(
            user=self.member, group=self.group, role=GroupMembership.Role.MEMBER
        )

    # --- api_list_users ---

    def test_list_users(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.get("/api/groups/users/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        # Leader should not see themselves
        emails = [u["email"] for u in data["users"]]
        self.assertNotIn("leader@example.com", emails)
        self.assertIn("member@example.com", emails)

    def test_list_users_with_search(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.get("/api/groups/users/?q=outsider")
        data = response.json()
        emails = [u["email"] for u in data["users"]]
        self.assertIn("outsider@example.com", emails)
        self.assertNotIn("member@example.com", emails)

    def test_list_users_unauthenticated(self):
        response = self.client.get("/api/groups/users/")
        self.assertEqual(response.status_code, 401)

    def test_list_users_method_not_allowed(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.post("/api/groups/users/")
        self.assertEqual(response.status_code, 405)

    # --- api_groups_list_create ---

    def test_list_groups(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.get("/api/groups/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(len(data["groups"]), 1)
        self.assertEqual(data["groups"][0]["name"], "Test Group")

    def test_list_groups_unauthenticated(self):
        response = self.client.get("/api/groups/")
        self.assertEqual(response.status_code, 401)

    def test_create_group_missing_name(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.post(
            "/api/groups/",
            json.dumps({"name": ""}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_create_group_invalid_json(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.post(
            "/api/groups/",
            "not json",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_groups_method_not_allowed(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.delete("/api/groups/")
        self.assertEqual(response.status_code, 405)

    # --- api_delete_group ---

    def test_delete_group_as_leader(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.delete(f"/api/groups/{self.group.id}/delete/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Group.objects.filter(id=self.group.id).exists())

    def test_delete_group_as_member_fails(self):
        self.client.login(email="member@example.com", password="pass123")
        response = self.client.delete(f"/api/groups/{self.group.id}/delete/")
        self.assertEqual(response.status_code, 403)

    def test_delete_group_not_found(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.delete("/api/groups/99999/delete/")
        self.assertEqual(response.status_code, 404)

    def test_delete_group_unauthenticated(self):
        response = self.client.delete(f"/api/groups/{self.group.id}/delete/")
        self.assertEqual(response.status_code, 401)

    def test_delete_group_method_not_allowed(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.get(f"/api/groups/{self.group.id}/delete/")
        self.assertEqual(response.status_code, 405)

    def test_delete_group_non_member(self):
        self.client.login(email="outsider@example.com", password="pass123")
        response = self.client.delete(f"/api/groups/{self.group.id}/delete/")
        self.assertEqual(response.status_code, 403)

    # --- api_edit_group ---

    def test_edit_group_not_found(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.patch(
            "/api/groups/99999/",
            json.dumps({"name": "New"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)

    def test_edit_group_invalid_json(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.patch(
            f"/api/groups/{self.group.id}/",
            "not json",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_edit_group_empty_name(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.patch(
            f"/api/groups/{self.group.id}/",
            json.dumps({"name": "  "}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_edit_group_description_and_fields(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.patch(
            f"/api/groups/{self.group.id}/",
            json.dumps(
                {
                    "description": "A fun group",
                    "group_type": "casual",
                    "default_location": "Manhattan",
                    "privacy": "public",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.group.refresh_from_db()
        self.assertEqual(self.group.description, "A fun group")
        self.assertEqual(self.group.default_location, "Manhattan")

    def test_edit_group_method_not_allowed(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/",
            json.dumps({"name": "New"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 405)

    def test_edit_group_unauthenticated(self):
        response = self.client.patch(
            f"/api/groups/{self.group.id}/",
            json.dumps({"name": "New"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)

    # --- api_invite_to_group ---

    def test_invite_by_username(self):
        self.outsider.username = "outsider_user"
        self.outsider.save()
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/invite/",
            json.dumps({"username": "outsider_user"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            GroupInvitation.objects.filter(
                invitee=self.outsider, group=self.group, status="pending"
            ).exists()
        )

    def test_invitation_list_and_action(self):
        # Create an invitation
        invitation = GroupInvitation.objects.create(
            group=self.group,
            inviter=self.leader,
            invitee=self.outsider,
            status="pending",
        )

        # Test listing invitations
        self.client.login(email="outsider@example.com", password="pass123")
        response = self.client.get("/api/groups/invitations/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json().get("invitations", [])), 1)
        self.assertEqual(response.json()["invitations"][0]["id"], invitation.id)

        # Test accepting invitation
        response = self.client.post(f"/api/groups/invitations/{invitation.id}/accept/")
        self.assertEqual(response.status_code, 200)

        invitation.refresh_from_db()
        self.assertEqual(invitation.status, "accepted")
        self.assertTrue(
            GroupMembership.objects.filter(
                user=self.outsider, group=self.group
            ).exists()
        )

    def test_invitation_decline(self):
        invitation = GroupInvitation.objects.create(
            group=self.group,
            inviter=self.leader,
            invitee=self.outsider,
            status="pending",
        )
        self.client.login(email="outsider@example.com", password="pass123")
        response = self.client.post(f"/api/groups/invitations/{invitation.id}/decline/")
        self.assertEqual(response.status_code, 200)

        invitation.refresh_from_db()
        self.assertEqual(invitation.status, "declined")
        self.assertFalse(
            GroupMembership.objects.filter(
                user=self.outsider, group=self.group
            ).exists()
        )

    def test_invite_already_member(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/invite/",
            json.dumps({"email": "member@example.com"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_invite_user_not_found(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/invite/",
            json.dumps({"email": "nobody@example.com"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)

    def test_invite_missing_identifier(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/invite/",
            json.dumps({}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_invite_as_member_fails(self):
        self.client.login(email="member@example.com", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/invite/",
            json.dumps({"email": "outsider@example.com"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_invite_group_not_found(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.post(
            "/api/groups/99999/invite/",
            json.dumps({"email": "outsider@example.com"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)

    def test_invite_unauthenticated(self):
        response = self.client.post(
            f"/api/groups/{self.group.id}/invite/",
            json.dumps({"email": "outsider@example.com"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)

    def test_invite_method_not_allowed(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.get(f"/api/groups/{self.group.id}/invite/")
        self.assertEqual(response.status_code, 405)

    def test_invite_invalid_json(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.post(
            f"/api/groups/{self.group.id}/invite/",
            "not json",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    # --- api_remove_from_group ---

    def test_remove_member_as_leader(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.delete(
            f"/api/groups/{self.group.id}/members/{self.member.id}/"
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(
            GroupMembership.objects.filter(user=self.member, group=self.group).exists()
        )

    def test_remove_self_fails(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.delete(
            f"/api/groups/{self.group.id}/members/{self.leader.id}/"
        )
        self.assertEqual(response.status_code, 400)

    def test_remove_as_member_fails(self):
        self.client.login(email="member@example.com", password="pass123")
        response = self.client.delete(
            f"/api/groups/{self.group.id}/members/{self.leader.id}/"
        )
        self.assertEqual(response.status_code, 403)

    def test_remove_nonexistent_member(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.delete(
            f"/api/groups/{self.group.id}/members/{self.outsider.id}/"
        )
        self.assertEqual(response.status_code, 404)

    def test_remove_group_not_found(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.delete(f"/api/groups/99999/members/{self.member.id}/")
        self.assertEqual(response.status_code, 404)

    def test_remove_unauthenticated(self):
        response = self.client.delete(
            f"/api/groups/{self.group.id}/members/{self.member.id}/"
        )
        self.assertEqual(response.status_code, 401)

    def test_remove_method_not_allowed(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.get(
            f"/api/groups/{self.group.id}/members/{self.member.id}/"
        )
        self.assertEqual(response.status_code, 405)

    # --- api_make_leader ---

    def test_make_leader(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.patch(
            f"/api/groups/{self.group.id}/members/{self.member.id}/role/"
        )
        self.assertEqual(response.status_code, 200)
        membership = GroupMembership.objects.get(user=self.member, group=self.group)
        self.assertEqual(membership.role, GroupMembership.Role.LEADER)

    def test_make_leader_already_leader(self):
        """Promoting someone who is already a leader is a no-op success."""
        GroupMembership.objects.filter(user=self.member, group=self.group).update(
            role=GroupMembership.Role.LEADER
        )
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.patch(
            f"/api/groups/{self.group.id}/members/{self.member.id}/role/"
        )
        self.assertEqual(response.status_code, 200)

    def test_make_leader_as_member_fails(self):
        self.client.login(email="member@example.com", password="pass123")
        response = self.client.patch(
            f"/api/groups/{self.group.id}/members/{self.leader.id}/role/"
        )
        self.assertEqual(response.status_code, 403)

    def test_make_leader_nonexistent_user(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.patch(
            f"/api/groups/{self.group.id}/members/{self.outsider.id}/role/"
        )
        self.assertEqual(response.status_code, 404)

    def test_make_leader_group_not_found(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.patch(
            f"/api/groups/99999/members/{self.member.id}/role/"
        )
        self.assertEqual(response.status_code, 404)

    def test_make_leader_unauthenticated(self):
        response = self.client.patch(
            f"/api/groups/{self.group.id}/members/{self.member.id}/role/"
        )
        self.assertEqual(response.status_code, 401)

    def test_make_leader_method_not_allowed(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.get(
            f"/api/groups/{self.group.id}/members/{self.member.id}/role/"
        )
        self.assertEqual(response.status_code, 405)

    # --- api_leave_group ---

    def test_leave_group_as_member(self):
        self.client.login(email="member@example.com", password="pass123")
        response = self.client.post(f"/api/groups/{self.group.id}/leave/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(
            GroupMembership.objects.filter(user=self.member, group=self.group).exists()
        )

    def test_leave_group_as_leader_with_another_leader(self):
        """Leader can leave if another leader exists."""
        GroupMembership.objects.filter(user=self.member, group=self.group).update(
            role=GroupMembership.Role.LEADER
        )
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.post(f"/api/groups/{self.group.id}/leave/")
        self.assertEqual(response.status_code, 200)

    def test_leave_group_not_member(self):
        self.client.login(email="outsider@example.com", password="pass123")
        response = self.client.post(f"/api/groups/{self.group.id}/leave/")
        self.assertEqual(response.status_code, 404)

    def test_leave_group_not_found(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.post("/api/groups/99999/leave/")
        self.assertEqual(response.status_code, 404)

    def test_leave_group_unauthenticated(self):
        response = self.client.post(f"/api/groups/{self.group.id}/leave/")
        self.assertEqual(response.status_code, 401)

    def test_leave_group_method_not_allowed(self):
        self.client.login(email="leader@example.com", password="pass123")
        response = self.client.get(f"/api/groups/{self.group.id}/leave/")
        self.assertEqual(response.status_code, 405)


# ---------------------------------------------------------------------------
# Additional coverage for new endpoints: public group listing, join-by-code,
# and regenerating the join code.
# ---------------------------------------------------------------------------


def _make_user(email):
    return User.objects.create_user(email=email, password="pass12345")


# ---------------------------------------------------------------------------
# api_public_groups_list
# ---------------------------------------------------------------------------


class PublicGroupsListTests(TestCase):
    url = reverse("api_public_groups_list")

    def setUp(self):
        self.user = _make_user("u@example.com")
        self.other = _make_user("o@example.com")

        self.public_open = Group.objects.create(
            name="Public Open",
            created_by=self.other,
            privacy=Group.PrivacyType.PUBLIC,
        )
        self.public_joined = Group.objects.create(
            name="Public Joined",
            created_by=self.other,
            privacy=Group.PrivacyType.PUBLIC,
        )
        GroupMembership.objects.create(
            user=self.user,
            group=self.public_joined,
            role=GroupMembership.Role.MEMBER,
        )
        self.private = Group.objects.create(
            name="Private",
            created_by=self.other,
            privacy=Group.PrivacyType.INVITE_ONLY,
        )

    def test_method_not_allowed(self):
        self.client.force_login(self.user)
        resp = self.client.post(self.url)
        self.assertEqual(resp.status_code, 405)

    def test_requires_auth(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 401)

    def test_excludes_private_and_joined_groups(self):
        self.client.force_login(self.user)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        names = [g["name"] for g in resp.json()["groups"]]
        self.assertIn("Public Open", names)
        self.assertNotIn("Public Joined", names)  # user is already a member
        self.assertNotIn("Private", names)

    def test_exception_returns_500(self):
        from unittest.mock import patch

        self.client.force_login(self.user)
        with patch("groups.views.Group.objects") as mock_objects:
            mock_objects.filter.side_effect = Exception("boom")
            resp = self.client.get(self.url)
            self.assertEqual(resp.status_code, 500)


# ---------------------------------------------------------------------------
# api_join_group_by_code
# ---------------------------------------------------------------------------


class JoinGroupByCodeTests(TestCase):
    def setUp(self):
        self.user = _make_user("u@example.com")
        self.creator = _make_user("c@example.com")
        self.public_group = Group.objects.create(
            name="Public Group",
            created_by=self.creator,
            privacy=Group.PrivacyType.PUBLIC,
        )
        self.private_group = Group.objects.create(
            name="Private Group",
            created_by=self.creator,
            privacy=Group.PrivacyType.INVITE_ONLY,
        )
        # Provision a chat on the public group so the join message path runs.
        self.chat = Chat.objects.create(
            type=Chat.ChatType.GROUP,
            name=self.public_group.name,
            created_by=self.creator,
            group=self.public_group,
        )
        ChatMember.objects.create(
            chat=self.chat, user=self.creator, role=ChatMember.Role.ADMIN
        )

    def _url(self, code):
        return reverse("api_join_group_by_code", args=[code])

    def test_method_not_allowed(self):
        self.client.force_login(self.user)
        resp = self.client.get(self._url(self.public_group.join_code))
        self.assertEqual(resp.status_code, 405)

    def test_requires_auth(self):
        resp = self.client.post(self._url(self.public_group.join_code))
        self.assertEqual(resp.status_code, 401)

    def test_invalid_code(self):
        self.client.force_login(self.user)
        resp = self.client.post(self._url("NOCODE"))
        self.assertEqual(resp.status_code, 404)

    def test_already_member(self):
        GroupMembership.objects.create(
            user=self.user,
            group=self.public_group,
            role=GroupMembership.Role.MEMBER,
        )
        self.client.force_login(self.user)
        resp = self.client.post(self._url(self.public_group.join_code))
        self.assertEqual(resp.status_code, 400)

    def test_private_group_forbidden(self):
        self.client.force_login(self.user)
        resp = self.client.post(self._url(self.private_group.join_code))
        self.assertEqual(resp.status_code, 403)

    def test_successful_join_creates_chat_member_and_system_message(self):
        self.client.force_login(self.user)
        resp = self.client.post(self._url(self.public_group.join_code))
        self.assertEqual(resp.status_code, 200)

        self.assertTrue(
            GroupMembership.objects.filter(
                group=self.public_group, user=self.user
            ).exists()
        )
        # A ChatMember should have been created (update_or_create).
        self.assertTrue(
            ChatMember.objects.filter(chat=self.chat, user=self.user).exists()
        )
        # A "joined via code" system message should exist.
        self.assertTrue(
            Message.objects.filter(
                chat=self.chat, message_type=Message.MessageType.SYSTEM
            ).exists()
        )

    def test_exception_returns_500(self):
        from unittest.mock import patch

        self.client.force_login(self.user)
        with patch("groups.views.Group.objects") as mock_objects:
            mock_objects.filter.side_effect = Exception("boom")
            resp = self.client.post(self._url(self.public_group.join_code))
            self.assertEqual(resp.status_code, 500)


# ---------------------------------------------------------------------------
# api_regenerate_join_code
# ---------------------------------------------------------------------------


class RegenerateJoinCodeTests(TestCase):
    def setUp(self):
        self.leader = _make_user("leader@example.com")
        self.member = _make_user("member@example.com")
        self.group = Group.objects.create(name="G", created_by=self.leader)
        GroupMembership.objects.create(
            user=self.leader, group=self.group, role=GroupMembership.Role.LEADER
        )
        GroupMembership.objects.create(
            user=self.member, group=self.group, role=GroupMembership.Role.MEMBER
        )

    def _url(self, group_id):
        return reverse("api_regenerate_join_code", args=[group_id])

    def test_method_not_allowed(self):
        self.client.force_login(self.leader)
        resp = self.client.get(self._url(self.group.id))
        self.assertEqual(resp.status_code, 405)

    def test_requires_auth(self):
        resp = self.client.post(self._url(self.group.id))
        self.assertEqual(resp.status_code, 401)

    def test_group_not_found(self):
        self.client.force_login(self.leader)
        resp = self.client.post(self._url(99999))
        self.assertEqual(resp.status_code, 404)

    def test_non_leader_forbidden(self):
        self.client.force_login(self.member)
        resp = self.client.post(self._url(self.group.id))
        self.assertEqual(resp.status_code, 403)

    def test_leader_regenerates_code(self):
        old_code = self.group.join_code
        self.client.force_login(self.leader)
        resp = self.client.post(self._url(self.group.id))
        self.assertEqual(resp.status_code, 200)
        new_code = resp.json()["join_code"]
        self.assertNotEqual(new_code, old_code)
        self.group.refresh_from_db()
        self.assertEqual(self.group.join_code, new_code)

    def test_exception_returns_500(self):
        from unittest.mock import patch

        self.client.force_login(self.leader)
        with patch("groups.views.Group.objects") as mock_objects:
            mock_objects.get.side_effect = Exception("boom")
            resp = self.client.post(self._url(self.group.id))
            self.assertEqual(resp.status_code, 500)
