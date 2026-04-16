import json
import logging
import math
from django.http import JsonResponse
from django.contrib.auth import get_user_model
from django.db import transaction, models
from django.db.models import Count, prefetch_related_objects
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.utils import timezone

from .models import Group, GroupMembership, SwipeEvent, Swipe, GroupInvitation
from accounts.models import UserPreference
from venues.models import Venue, VenuePhoto
from venues.google_places import bulk_prefetch_photos
from venues.filters import (
    filter_venues_by_preferences,
    aggregate_member_preferences,
)
from chat.models import Chat, ChatMember as ChatRoomMember, Message

logger = logging.getLogger(__name__)
User = get_user_model()


def api_list_users(request):
    """
    GET /api/groups/users/
    Returns a list of all users available to be invited, optionally filtered by search.
    """
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        query = request.GET.get("q", "").strip()
        group_id = request.GET.get("group_id")
        users_qs = User.objects.exclude(id=request.user.id)

        invited_user_ids = set()
        if group_id:
            try:
                invited_user_ids = set(
                    GroupInvitation.objects.filter(
                        group_id=group_id, status=GroupInvitation.Status.PENDING
                    ).values_list("invitee_id", flat=True)
                )
            except Exception:
                logger.warning(
                    "Failed to fetch pending invitations for group %s",
                    group_id,
                    exc_info=True,
                )

        if query:
            users_qs = users_qs.filter(
                models.Q(email__icontains=query)
                | models.Q(username__icontains=query)
                | models.Q(first_name__icontains=query)
                | models.Q(last_name__icontains=query)
            )

        users_data = [
            {
                "id": u.id,
                "email": u.email,
                "name": f"{u.first_name} {u.last_name}".strip() or u.username,
                "is_invited": u.id in invited_user_ids,
            }
            for u in users_qs[:50]  # Limit to 50 for performance
        ]
        return JsonResponse({"success": True, "users": users_data})
    except Exception as e:
        logger.error(f"User list error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An expected error occurred"}, status=500)


def _group_to_json(group):
    """Serialize a Group instance and its memberships.

    Group constraints are derived from member ``UserPreference`` rows at read
    time so the displayed filters always reflect the current membership.
    """
    memberships = group.memberships.select_related("user").all()

    aggregated = aggregate_member_preferences(group)
    constraints_data = {
        "dietary": aggregated["dietary_names"],
        "cuisines": aggregated["cuisine_names"],
        "foodTypes": aggregated["food_type_names"],
        "minimumSanitationGrade": aggregated["min_grade"] or "",
        "priceRange": aggregated["price_range"] or "",
    }

    return {
        "id": group.id,
        "name": group.name,
        "chat_id": (
            getattr(group, "chat", None).id if getattr(group, "chat", None) else None
        ),
        "constraints": constraints_data,
        "description": group.description,
        "group_type": group.group_type,
        "default_location": group.default_location,
        "privacy": group.privacy,
        "created_by": group.created_by.id if group.created_by else None,
        "created_at": group.created_at.isoformat(),
        "join_code": group.join_code,
        "members": [
            {
                "id": m.user.id,
                "email": m.user.email,
                "name": f"{m.user.first_name} {m.user.last_name}".strip(),
                "role": m.role,
                "join_date": m.join_date.isoformat(),
            }
            for m in memberships
        ],
    }


def api_groups_list_create(request):
    """
    GET /api/groups/ - List all groups the user is a member of
    POST /api/groups/ - Create a new Group and assign the creator as the Leader.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    if request.method == "GET":
        try:
            memberships = GroupMembership.objects.filter(
                user=request.user
            ).select_related("group")
            groups = [m.group for m in memberships]
            return JsonResponse(
                {"success": True, "groups": [_group_to_json(g) for g in groups]}
            )
        except Exception as e:
            logger.error(f"Group fetch error: {str(e)}", exc_info=True)
            return JsonResponse({"error": "An expected error occurred"}, status=500)

    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            name = (data.get("name") or "").strip()
            if not name:
                return JsonResponse({"error": "Group name is required"}, status=400)

            with transaction.atomic():
                group = Group.objects.create(
                    name=name,
                    description=(data.get("description") or "").strip(),
                    group_type=data.get("group_type", Group.GroupType.CASUAL),
                    default_location=(data.get("default_location") or "").strip(),
                    privacy=data.get("privacy", Group.PrivacyType.PUBLIC),
                    created_by=request.user,
                )
                # Creator is automatically a leader
                GroupMembership.objects.create(
                    user=request.user, group=group, role=GroupMembership.Role.LEADER
                )

                # Auto-provision chat
                chat = Chat.objects.create(
                    type=Chat.ChatType.GROUP,
                    name=group.name,
                    created_by=request.user,
                    group=group,
                )
                ChatRoomMember.objects.create(
                    chat=chat, user=request.user, role=ChatRoomMember.Role.ADMIN
                )
                username_display = request.user.first_name or request.user.username
                Message.objects.create(
                    chat=chat,
                    message_type=Message.MessageType.SYSTEM,
                    body=f"{username_display} created the group",
                )

            return JsonResponse({"success": True, "group": _group_to_json(group)})

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        except Exception as e:
            logger.error(f"Group creation error: {str(e)}", exc_info=True)
            return JsonResponse({"error": "An expected error occurred"}, status=500)

    return JsonResponse({"error": "Method not allowed"}, status=405)


def api_edit_group(request, group_id):
    """
    PATCH|PUT /api/groups/<id>/
    Edits a group's details. Only a Leader can edit.
    """
    if request.method not in ("PATCH", "PUT"):
        return JsonResponse({"error": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        group = Group.objects.get(id=group_id)
        # Check permissions: user must be a leader of this group
        membership = GroupMembership.objects.filter(
            group=group, user=request.user
        ).first()
        if not membership or membership.role != GroupMembership.Role.LEADER:
            return JsonResponse(
                {"error": "Only group leaders can edit the group"}, status=403
            )

        data = json.loads(request.body)

        name = data.get("name")
        if name is not None:
            name = name.strip()
            if not name:
                return JsonResponse({"error": "Group name cannot be empty"}, status=400)
            group.name = name

        if "description" in data:
            group.description = data["description"].strip()
        if "group_type" in data:
            if data["group_type"] in dict(Group.GroupType.choices):
                group.group_type = data["group_type"]
        if "default_location" in data:
            group.default_location = data["default_location"].strip()
        if "privacy" in data:
            if data["privacy"] in dict(Group.PrivacyType.choices):
                group.privacy = data["privacy"]

        group.save()
        return JsonResponse({"success": True, "group": _group_to_json(group)})

    except Group.DoesNotExist:
        return JsonResponse({"error": "Group not found"}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        logger.error(f"Group edit error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An expected error occurred"}, status=500)


def api_delete_group(request, group_id):
    """
    DELETE /api/groups/<id>/
    Deletes the group entirely. Only a Leader can delete.
    """
    if request.method != "DELETE":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        group = Group.objects.get(id=group_id)
        membership = GroupMembership.objects.filter(
            group=group, user=request.user
        ).first()
        if not membership or membership.role != GroupMembership.Role.LEADER:
            return JsonResponse(
                {"error": "Only group leaders can delete the group"}, status=403
            )

        group.delete()
        return JsonResponse({"success": True, "message": "Group deleted successfully"})

    except Group.DoesNotExist:
        return JsonResponse({"error": "Group not found"}, status=404)
    except Exception as e:
        logger.error(f"Group deletion error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An expected error occurred"}, status=500)


def api_invite_to_group(request, group_id):
    """
    POST /api/groups/<id>/invite/
    Invites a user via email or username. Only a Leader can invite.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        group = Group.objects.get(id=group_id)
        membership = GroupMembership.objects.filter(
            group=group, user=request.user
        ).first()
        if not membership or membership.role != GroupMembership.Role.LEADER:
            return JsonResponse(
                {"error": "Only group leaders can invite members"}, status=403
            )

        data = json.loads(request.body)
        identifier = (data.get("email") or data.get("username") or "").strip()
        if not identifier:
            return JsonResponse({"error": "Email or username is required"}, status=400)

        # Try to find by email first (validate approach)
        target_user = None
        try:
            validate_email(identifier)
            target_user = User.objects.filter(email__iexact=identifier).first()
        except ValidationError:
            # If not a valid email, search by username
            target_user = User.objects.filter(username__iexact=identifier).first()

        if not target_user:
            return JsonResponse({"error": "User not found"}, status=404)

        if GroupMembership.objects.filter(group=group, user=target_user).exists():
            return JsonResponse(
                {"error": "User is already a member of this group"}, status=400
            )

        # Create invitation instead of direct membership
        invitation, created = GroupInvitation.objects.get_or_create(
            group=group,
            invitee=target_user,
            status=GroupInvitation.Status.PENDING,
            defaults={"inviter": request.user},
        )
        if not created:
            return JsonResponse({"error": "User has already been invited"}, status=400)

        return JsonResponse(
            {"success": True, "message": "Invitation sent successfully"}
        )

    except Group.DoesNotExist:
        return JsonResponse({"error": "Group not found"}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        logger.error(f"Group invite error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An expected error occurred"}, status=500)


def api_invitations_list(request):
    """
    GET /api/groups/invitations/
    Returns a list of pending invitations for the current user.
    """
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    invitations = GroupInvitation.objects.filter(
        invitee=request.user, status=GroupInvitation.Status.PENDING
    )

    invites_data = []
    for invite in invitations:
        inviter_name = (
            invite.inviter.first_name or invite.inviter.username or invite.inviter.email
        )
        invites_data.append(
            {
                "id": invite.id,
                "group_id": invite.group.id,
                "group_name": invite.group.name,
                "inviter_name": inviter_name,
                "created_at": invite.created_at.isoformat(),
            }
        )

    from .models import SwipeSessionNotification, SwipeEvent

    swipe_notifications = (
        SwipeSessionNotification.objects.filter(
            user=request.user, event__status=SwipeEvent.Status.ACTIVE
        )
        .exclude(event__created_by=request.user)
        .select_related("event", "event__group", "event__created_by")
    )

    swipe_data = []
    for sn in swipe_notifications:
        creator_name = (
            sn.event.created_by.first_name
            or sn.event.created_by.username
            or sn.event.created_by.email
            if sn.event.created_by
            else "Someone"
        )
        swipe_data.append(
            {
                "id": sn.id,
                "event_id": sn.event.id,
                "event_name": sn.event.name,
                "group_id": sn.event.group.id,
                "group_name": sn.event.group.name,
                "creator_name": creator_name,
                "created_at": sn.created_at.isoformat(),
                "is_read": sn.is_read,
            }
        )

    return JsonResponse(
        {"success": True, "invitations": invites_data, "swipe_sessions": swipe_data}
    )


def api_mark_swipe_notification_read(request, notification_id):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        from .models import SwipeSessionNotification

        notification = SwipeSessionNotification.objects.get(
            id=notification_id, user=request.user
        )
        notification.is_read = True
        notification.save(update_fields=["is_read"])
        return JsonResponse({"success": True})
    except SwipeSessionNotification.DoesNotExist:
        return JsonResponse({"error": "Notification not found"}, status=404)
    except Exception as e:
        logger.error(f"Mark read error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An expected error occurred"}, status=500)


def api_invitation_action(request, invitation_id, action):
    """
    POST /api/groups/invitations/<invitation_id>/<action>/
    action can be 'accept' or 'decline'.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        invitation = GroupInvitation.objects.get(
            id=invitation_id,
            invitee=request.user,
            status=GroupInvitation.Status.PENDING,
        )

        if action == "accept":
            with transaction.atomic():
                invitation.status = GroupInvitation.Status.ACCEPTED
                invitation.save()

                # Create membership
                if not GroupMembership.objects.filter(
                    group=invitation.group, user=request.user
                ).exists():
                    GroupMembership.objects.create(
                        group=invitation.group,
                        user=request.user,
                        role=GroupMembership.Role.MEMBER,
                    )

                    # Add to chat
                    if hasattr(invitation.group, "chat"):
                        ChatRoomMember.objects.update_or_create(
                            chat=invitation.group.chat,
                            user=request.user,
                            defaults={
                                "role": ChatRoomMember.Role.MEMBER,
                                "left_at": None,
                            },
                        )
                        username_display = (
                            request.user.first_name or request.user.username
                        )
                        Message.objects.create(
                            chat=invitation.group.chat,
                            message_type=Message.MessageType.SYSTEM,
                            body=f"{username_display} joined the group",
                        )

            return JsonResponse({"success": True})

        elif action == "decline":
            invitation.status = GroupInvitation.Status.DECLINED
            invitation.save()
            return JsonResponse({"success": True})

        else:
            return JsonResponse({"error": "Invalid action"}, status=400)

    except GroupInvitation.DoesNotExist:
        return JsonResponse(
            {"error": "Invitation not found or already processed"}, status=404
        )
    except Exception as e:
        logger.error(f"Group invitation action error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An expected error occurred"}, status=500)


def api_remove_from_group(request, group_id, user_id):
    """
    DELETE /api/groups/<id>/members/<user_id>/
    Removes a member from the group. Only a Leader can remove.
    """
    if request.method != "DELETE":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        group = Group.objects.get(id=group_id)
        leader_membership = GroupMembership.objects.filter(
            group=group, user=request.user
        ).first()
        if (
            not leader_membership
            or leader_membership.role != GroupMembership.Role.LEADER
        ):
            return JsonResponse(
                {"error": "Only group leaders can remove members"}, status=403
            )

        if request.user.id == int(user_id):
            return JsonResponse(
                {
                    "error": "You cannot remove yourself. Use the leave endpoint instead."
                },
                status=400,
            )

        target_membership = GroupMembership.objects.filter(
            group=group, user_id=user_id
        ).first()
        if not target_membership:
            return JsonResponse(
                {"error": "User is not a member of this group"}, status=404
            )

        target_membership.delete()

        if hasattr(group, "chat"):
            ChatRoomMember.objects.filter(chat=group.chat, user_id=user_id).update(
                left_at=timezone.now()
            )
            user = User.objects.get(id=user_id)
            username_display = user.first_name or user.username
            Message.objects.create(
                chat=group.chat,
                message_type=Message.MessageType.SYSTEM,
                body=f"{username_display} was removed from the group",
            )

        return JsonResponse({"success": True, "group": _group_to_json(group)})

    except Group.DoesNotExist:
        return JsonResponse({"error": "Group not found"}, status=404)
    except Exception as e:
        logger.error(f"Group remove error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An expected error occurred"}, status=500)


def api_make_leader(request, group_id, user_id):
    """
    PATCH /api/groups/<id>/members/<user_id>/role/
    Promotes a member to a Leader. Only a Leader can promote.
    """
    if request.method != "PATCH":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        group = Group.objects.get(id=group_id)
        leader_membership = GroupMembership.objects.filter(
            group=group, user=request.user
        ).first()
        if (
            not leader_membership
            or leader_membership.role != GroupMembership.Role.LEADER
        ):
            return JsonResponse(
                {"error": "Only group leaders can promote members"}, status=403
            )

        # Using JSON to determine role update optionally, or assume it's always default logic
        # For simplicity based on AC, just making them a leader
        target_membership = GroupMembership.objects.filter(
            group=group, user_id=user_id
        ).first()
        if not target_membership:
            return JsonResponse(
                {"error": "User is not a member of this group"}, status=404
            )

        if target_membership.role != GroupMembership.Role.LEADER:
            target_membership.role = GroupMembership.Role.LEADER
            target_membership.save(update_fields=["role"])

            # Sync ChatMember role
            if hasattr(group, "chat"):
                chat_member = ChatRoomMember.objects.filter(
                    chat=group.chat,
                    user_id=user_id,
                    left_at__isnull=True,
                ).first()
                if chat_member and chat_member.role != ChatRoomMember.Role.ADMIN:
                    chat_member.role = ChatRoomMember.Role.ADMIN
                    chat_member.save(update_fields=["role"])

        return JsonResponse({"success": True, "group": _group_to_json(group)})

    except Group.DoesNotExist:
        return JsonResponse({"error": "Group not found"}, status=404)
    except Exception as e:
        logger.error(f"Group make leader error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An expected error occurred"}, status=500)


def api_leave_group(request, group_id):
    """
    POST /api/groups/<id>/leave/
    Leaves a group. If the user is the only leader, they are blocked from leaving.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        group = Group.objects.get(id=group_id)
        membership = GroupMembership.objects.filter(
            group=group, user=request.user
        ).first()
        if not membership:
            return JsonResponse(
                {"error": "You are not a member of this group"}, status=404
            )

        with transaction.atomic():
            if membership.role == GroupMembership.Role.LEADER:
                # Check if there are other leaders
                other_leaders_count = (
                    GroupMembership.objects.filter(
                        group=group, role=GroupMembership.Role.LEADER
                    )
                    .exclude(user=request.user)
                    .count()
                )

                if other_leaders_count == 0:
                    return JsonResponse(
                        {
                            "error": "You are the only leader of this group. You must either assign another leader or delete the group."
                        },
                        status=400,
                    )

            membership.delete()

            if hasattr(group, "chat"):
                ChatRoomMember.objects.filter(
                    chat=group.chat, user=request.user
                ).update(left_at=timezone.now())
                username_display = request.user.first_name or request.user.username
                Message.objects.create(
                    chat=group.chat,
                    message_type=Message.MessageType.SYSTEM,
                    body=f"{username_display} left the group",
                )

        return JsonResponse({"success": True, "message": "You have left the group"})

    except Group.DoesNotExist:
        return JsonResponse({"error": "Group not found"}, status=404)
    except Exception as e:
        logger.error(f"Group leave error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An expected error occurred"}, status=500)


# ---------------------------------------------------------------------------
# Swipe Event & Venue Matching API
# ---------------------------------------------------------------------------

# Grade ranking: lower number = stricter (better)
GRADE_RANK = {"A": 1, "B": 2, "C": 3, "Z": 4, "N": 5, "P": 6}


def _event_to_json(event):
    """Serialize a SwipeEvent instance."""
    return {
        "id": event.id,
        "group_id": event.group_id,
        "name": event.name,
        "status": event.status,
        "created_by": event.created_by_id,
        "matched_venue_id": event.matched_venue_id,
        "borough": event.borough,
        "neighborhood": event.neighborhood,
        "created_at": event.created_at.isoformat(),
    }


def _venue_to_swipe_json(venue):
    """Serialize a Venue for the swipe card UI.

    Uses prefetched related objects when available to avoid N+1 queries.
    """
    # Use prefetched cache via .all() instead of queryset ops that bypass it
    all_photos = sorted(venue.photos.all(), key=lambda p: not p.is_primary)
    photos = [p.image_url for p in all_photos[:3]]
    dietary_tags = [t.name for t in venue.dietary_tags.all()]
    food_type_tags = [t.name for t in venue.food_type_tags.all()]

    # Build badges list from tags and features
    badges = list(dietary_tags)
    if venue.has_group_seating:
        badges.append("Group Seating")

    # Get latest inspection from prefetched set (ordered by -inspection_date)
    all_inspections = list(venue.inspections.all())
    latest_inspection = all_inspections[0] if all_inspections else None
    health_inspection = None
    if latest_inspection:
        violations = [
            i.violation_description for i in all_inspections if i.violation_description
        ][:5]
        health_inspection = {
            "grade": latest_inspection.grade or venue.sanitation_grade,
            "score": latest_inspection.score or 0,
            "inspectionDate": (
                latest_inspection.inspection_date.isoformat()
                if latest_inspection.inspection_date
                else ""
            ),
            "violations": [
                {"type": "Violation", "description": v, "severity": "minor"}
                for v in violations
            ],
        }

    # Get active student discount from prefetched set
    all_discounts = venue.discounts.all()
    discount = next((d for d in all_discounts if d.is_active), None)

    return {
        "id": str(venue.id),
        "name": venue.name,
        "cuisine": [venue.cuisine_type.name] if venue.cuisine_type else [],
        "sanitationGrade": venue.sanitation_grade or "P",
        "images": photos if photos else [],
        "badges": badges,
        "address": (
            f"{venue.street_address}, {venue.borough}".strip(", ")
            if venue.street_address or venue.borough
            else ""
        ),
        "inspectionDate": (
            latest_inspection.inspection_date.isoformat()
            if latest_inspection and latest_inspection.inspection_date
            else ""
        ),
        "menuLink": venue.website or "",
        "notes": "",
        "latitude": float(venue.latitude) if venue.latitude else 0,
        "longitude": float(venue.longitude) if venue.longitude else 0,
        "distance": "",
        "cost": venue.price_range or "$$",
        "hasGroupSeating": venue.has_group_seating,
        "hasStudentDiscount": discount is not None,
        "studentDiscountAmount": discount.discount_value if discount else "",
        "rating": float(venue.google_rating) if venue.google_rating else 0,
        "reviewCount": venue.google_review_count,
        "healthInspection": health_inspection,
        "foodTypeTags": food_type_tags,
        "dietaryTags": dietary_tags,
        "neighborhood": venue.neighborhood or "",
        "seatingCapacity": venue.seating_capacity,
        "hasTakeout": venue.has_takeout,
        "hasDelivery": venue.has_delivery,
        "hasDineIn": venue.has_dine_in,
        "isReservable": venue.is_reservable,
        "googleMapsUrl": venue.google_maps_url or "",
        "hours": venue.hours or {},
    }


def api_swipe_events(request, group_id):
    """
    GET  /api/groups/<id>/events/ - List swipe events for a group
    POST /api/groups/<id>/events/ - Create a new swipe event (leader only)
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        group = Group.objects.get(id=group_id)
        membership = GroupMembership.objects.filter(
            group=group, user=request.user
        ).first()
        if not membership:
            return JsonResponse(
                {"error": "You are not a member of this group"}, status=403
            )

        if request.method == "GET":
            events = group.swipe_events.order_by("-created_at")
            return JsonResponse(
                {
                    "success": True,
                    "events": [_event_to_json(e) for e in events],
                }
            )

        elif request.method == "POST":
            if membership.role != GroupMembership.Role.LEADER:
                return JsonResponse(
                    {"error": "Only group leaders can create events"},
                    status=403,
                )
            data = json.loads(request.body)
            name = (data.get("name") or "").strip()
            if not name:
                return JsonResponse({"error": "Event name is required"}, status=400)

            event = SwipeEvent.objects.create(
                group=group,
                name=name,
                created_by=request.user,
                borough=(data.get("borough") or "").strip(),
                neighborhood=(data.get("neighborhood") or "").strip(),
            )

            from .models import SwipeSessionNotification

            members = GroupMembership.objects.filter(group=group)
            notifications = []
            for member in members:
                # Do not notify the creator of the event
                if member.user.id == request.user.id:
                    continue
                notifications.append(
                    SwipeSessionNotification(
                        event=event, user=member.user, is_read=False
                    )
                )
            SwipeSessionNotification.objects.bulk_create(notifications)

            return JsonResponse(
                {"success": True, "event": _event_to_json(event)}, status=201
            )

        return JsonResponse({"error": "Method not allowed"}, status=405)

    except Group.DoesNotExist:
        return JsonResponse({"error": "Group not found"}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        logger.error(f"Swipe event error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An unexpected error occurred"}, status=500)


def api_swipe_event_venues(request, group_id, event_id):
    """
    GET /api/groups/<id>/events/<event_id>/venues/
    Returns venues filtered by the combined preferences of group members,
    excluding venues the requesting user has already swiped on.
    """
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        group = Group.objects.get(id=group_id)
        membership = GroupMembership.objects.filter(
            group=group, user=request.user
        ).first()
        if not membership:
            return JsonResponse(
                {"error": "You are not a member of this group"}, status=403
            )

        event = SwipeEvent.objects.get(id=event_id, group=group)

        aggregated = aggregate_member_preferences(group)

        venues_qs = filter_venues_by_preferences(
            cuisine_ids=aggregated["cuisine_ids"],
            min_grade=aggregated["min_grade"],
            price_range=aggregated["price_range"],
            borough=event.borough or None,
            neighborhood=event.neighborhood or None,
            dietary_tag_names=aggregated["dietary_names"],
            food_type_tag_names=aggregated["food_type_names"],
            require_photos=True,
        )

        # Exclude venues already swiped on by this user for this event
        swiped_venue_ids = Swipe.objects.filter(
            event=event, user=request.user
        ).values_list("venue_id", flat=True)
        venues_qs = venues_qs.exclude(id__in=swiped_venue_ids)

        # Order by rating (best first), limit to 20
        venues_qs = (
            venues_qs.select_related("cuisine_type")
            .prefetch_related(
                "photos", "dietary_tags", "food_type_tags", "inspections", "discounts"
            )
            .order_by(models.F("google_rating").desc(nulls_last=True))[:20]
        )

        # Fetch missing Google Places photos in parallel (bulk_prefetch_photos) before
        # serializing, then refresh the prefetch cache so _venue_to_swipe_json only reads
        # already-loaded data and never performs API calls or DB writes itself.
        venues_list = list(venues_qs)
        bulk_prefetch_photos(venues_list)
        # Clear the stale photos cache from the original prefetch so
        # prefetch_related_objects actually re-fetches (Django skips re-fetching
        # if the key already exists in _prefetched_objects_cache).
        for _v in venues_list:
            getattr(_v, "_prefetched_objects_cache", {}).pop("photos", None)
        prefetch_related_objects(venues_list, "photos")

        venues_data = [_venue_to_swipe_json(v) for v in venues_list]
        return JsonResponse({"success": True, "venues": venues_data})

    except Group.DoesNotExist:
        return JsonResponse({"error": "Group not found"}, status=404)
    except SwipeEvent.DoesNotExist:
        return JsonResponse({"error": "Event not found"}, status=404)
    except Exception as e:
        logger.error(f"Venue fetch error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An unexpected error occurred"}, status=500)


def _require_group_membership(request, group_id):
    """Returns (group, None) or (None, error_response)."""
    if not request.user.is_authenticated:
        return None, JsonResponse({"error": "Authentication required"}, status=401)
    try:
        group = Group.objects.get(id=group_id)
    except Group.DoesNotExist:
        return None, JsonResponse({"error": "Group not found"}, status=404)
    if not GroupMembership.objects.filter(group=group, user=request.user).exists():
        return None, JsonResponse(
            {"error": "You are not a member of this group"}, status=403
        )
    return group, None


def api_group_effective_constraints(request, group_id):
    """
    GET /api/groups/<id>/effective-constraints/

    Returns the group's matching filters as derived from every member's
    ``UserPreference``. Group constraints are view-only and computed at read
    time so members always see an up-to-date intersection.
    """
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    group, err = _require_group_membership(request, group_id)
    if err:
        return err

    aggregated = aggregate_member_preferences(group)
    return JsonResponse(
        {
            "success": True,
            "constraints": {
                "dietary": aggregated["dietary_names"],
                "cuisines": aggregated["cuisine_names"],
                "foodTypes": aggregated["food_type_names"],
                "minimumSanitationGrade": aggregated["min_grade"] or "",
                "priceRange": aggregated["price_range"] or "",
            },
        }
    )


def api_group_preview_venues(request, group_id):
    """
    GET /api/groups/<id>/preview-venues/?countOnly=1&limit=20&offset=0

    Returns venues matching the group's aggregated member preferences, in
    the same shape used by the swipe session. Used by the group preference
    preview sheet so leaders/members can see the restaurants their group
    will actually swipe on.
    """
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    group, err = _require_group_membership(request, group_id)
    if err:
        return err

    aggregated = aggregate_member_preferences(group)

    qs = filter_venues_by_preferences(
        cuisine_ids=aggregated["cuisine_ids"],
        min_grade=aggregated["min_grade"],
        price_range=aggregated["price_range"] or None,
        dietary_tag_names=aggregated["dietary_names"],
        food_type_tag_names=aggregated["food_type_names"],
        require_photos=False,
    )
    count = qs.count()

    if request.GET.get("countOnly"):
        return JsonResponse({"success": True, "count": count, "venues": []})

    try:
        limit = int(request.GET.get("limit", 20))
    except ValueError:
        limit = 20
    try:
        offset = int(request.GET.get("offset", 0))
    except ValueError:
        offset = 0
    limit = max(1, min(limit, 50))
    offset = max(0, offset)

    venues_qs = (
        qs.select_related("cuisine_type")
        .prefetch_related(
            "photos", "dietary_tags", "food_type_tags", "inspections", "discounts"
        )
        .order_by(models.F("google_rating").desc(nulls_last=True))[
            offset : offset + limit
        ]
    )
    venues_data = [_venue_to_swipe_json(v) for v in venues_qs]
    return JsonResponse(
        {"success": True, "count": count, "venues": venues_data}
    )


def api_submit_swipe(request, group_id, event_id):
    """
    POST /api/groups/<id>/events/<event_id>/swipes/
    Records a swipe (left/right) on a venue. Idempotent via update_or_create.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        group = Group.objects.get(id=group_id)
        membership = GroupMembership.objects.filter(
            group=group, user=request.user
        ).first()
        if not membership:
            return JsonResponse(
                {"error": "You are not a member of this group"}, status=403
            )

        event = SwipeEvent.objects.get(id=event_id, group=group)
        if event.status != SwipeEvent.Status.ACTIVE:
            return JsonResponse({"error": "This event is no longer active"}, status=400)

        data = json.loads(request.body)
        venue_id = data.get("venue_id")
        direction = data.get("direction")

        if not venue_id:
            return JsonResponse({"error": "venue_id is required"}, status=400)
        if direction not in ("left", "right"):
            return JsonResponse(
                {"error": "direction must be 'left' or 'right'"}, status=400
            )

        venue = Venue.objects.get(id=venue_id)

        if not venue.is_active:
            return JsonResponse({"error": "Venue is not active"}, status=400)

        Swipe.objects.update_or_create(
            event=event,
            user=request.user,
            venue=venue,
            defaults={"direction": direction},
        )

        return JsonResponse(
            {
                "success": True,
                "swipe": {"venue_id": venue.id, "direction": direction},
            }
        )

    except Group.DoesNotExist:
        return JsonResponse({"error": "Group not found"}, status=404)
    except SwipeEvent.DoesNotExist:
        return JsonResponse({"error": "Event not found"}, status=404)
    except Venue.DoesNotExist:
        return JsonResponse({"error": "Venue not found"}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        logger.error(f"Swipe submit error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An unexpected error occurred"}, status=500)


def api_swipe_event_results(request, group_id, event_id):
    """
    GET /api/groups/<id>/events/<event_id>/results/
    Computes match results using 2/3 majority algorithm.
    """
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        group = Group.objects.get(id=group_id)
        membership = GroupMembership.objects.filter(
            group=group, user=request.user
        ).first()
        if not membership:
            return JsonResponse(
                {"error": "You are not a member of this group"}, status=403
            )

        event = SwipeEvent.objects.get(id=event_id, group=group)

        # If already computed, return cached result
        if event.matched_venue:
            cached_participants = event.swipes.values("user_id").distinct().count()
            return JsonResponse(
                {
                    "success": True,
                    "match_found": True,
                    "matched_venue": _venue_to_swipe_json(event.matched_venue),
                    "total_participants": cached_participants,
                    "threshold": math.ceil(cached_participants * 2 / 3),
                    "likes_count": event.swipes.filter(
                        venue=event.matched_venue, direction=Swipe.Direction.RIGHT
                    ).count(),
                }
            )

        # Use group member count for threshold so matches require a true
        # 2/3 majority of the group, not just of those who have swiped so far.
        all_swipes = event.swipes.all()
        total_participants = group.memberships.count()

        if total_participants == 0:
            return JsonResponse(
                {
                    "success": True,
                    "match_found": False,
                    "matched_venue": None,
                    "total_participants": 0,
                    "threshold": 0,
                    "likes_count": 0,
                }
            )

        # 2/3 majority threshold based on group size
        threshold = math.ceil(total_participants * 2 / 3)

        # Count right swipes per venue (distinct users)
        venue_likes = (
            all_swipes.filter(direction=Swipe.Direction.RIGHT)
            .values("venue_id")
            .annotate(like_count=Count("user_id", distinct=True))
            .order_by("-like_count")
        )

        # Find venues meeting the threshold
        matched_venue = None
        likes_count = 0
        for entry in venue_likes:
            if entry["like_count"] >= threshold:
                matched_venue = Venue.objects.get(id=entry["venue_id"])
                likes_count = entry["like_count"]
                break

        if matched_venue:
            event.matched_venue = matched_venue
            event.status = SwipeEvent.Status.COMPLETED
            event.save(update_fields=["matched_venue", "status", "updated_at"])

        return JsonResponse(
            {
                "success": True,
                "match_found": matched_venue is not None,
                "matched_venue": (
                    _venue_to_swipe_json(matched_venue) if matched_venue else None
                ),
                "total_participants": total_participants,
                "threshold": threshold,
                "likes_count": likes_count,
            }
        )

    except Group.DoesNotExist:
        return JsonResponse({"error": "Group not found"}, status=404)
    except SwipeEvent.DoesNotExist:
        return JsonResponse({"error": "Event not found"}, status=404)
    except Exception as e:
        logger.error(f"Match results error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An unexpected error occurred"}, status=500)


def api_public_groups_list(request):
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        public_groups = (
            Group.objects.filter(privacy=Group.PrivacyType.PUBLIC)
            .exclude(memberships__user=request.user)
            .order_by("-created_at")[:50]
        )
        return JsonResponse(
            {"success": True, "groups": [_group_to_json(g) for g in public_groups]}
        )
    except Exception as e:
        logger.error(f"Public group fetch error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An expected error occurred"}, status=500)


def api_join_group_by_code(request, join_code):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        group = Group.objects.filter(join_code=join_code).first()
        if not group:
            return JsonResponse({"error": "Invalid join code"}, status=404)

        if GroupMembership.objects.filter(group=group, user=request.user).exists():
            return JsonResponse(
                {"error": "You are already a member of this group"}, status=400
            )

        if group.privacy != Group.PrivacyType.PUBLIC:
            return JsonResponse(
                {"error": "This group is private and cannot be joined via code"},
                status=403,
            )

        with transaction.atomic():
            GroupMembership.objects.create(
                group=group, user=request.user, role=GroupMembership.Role.MEMBER
            )

            if hasattr(group, "chat"):
                from chat.models import ChatMember, Message

                ChatMember.objects.update_or_create(
                    chat=group.chat,
                    user=request.user,
                    defaults={"role": ChatMember.Role.MEMBER, "left_at": None},
                )
                username_display = (
                    request.user.first_name or request.user.email.split("@")[0]
                )
                Message.objects.create(
                    chat=group.chat,
                    message_type=Message.MessageType.SYSTEM,
                    body=f"{username_display} joined the group via directly entering code {join_code}",
                )

        return JsonResponse({"success": True, "group": _group_to_json(group)})
    except Exception as e:
        logger.error(f"Join group error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An expected error occurred"}, status=500)


def api_regenerate_join_code(request, group_id):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        group = Group.objects.get(id=group_id)
        # Verify the user is the leader
        membership = GroupMembership.objects.filter(
            group=group, user=request.user, role=GroupMembership.Role.LEADER
        ).first()
        if not membership:
            return JsonResponse(
                {"error": "Only group leaders can regenerate the join code"}, status=403
            )

        # Reset the join code and save to auto-generate a new one
        group.join_code = None
        group.save()

        return JsonResponse({"success": True, "join_code": group.join_code})
    except Group.DoesNotExist:
        return JsonResponse({"error": "Group not found"}, status=404)
    except Exception as e:
        logger.error(f"Regenerate code error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An expected error occurred"}, status=500)
