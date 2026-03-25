import json
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import get_user_model
from django.db import transaction, models
from django.core.exceptions import ValidationError
from django.core.validators import validate_email

from .models import Group, GroupMembership

logger = logging.getLogger(__name__)
User = get_user_model()


@csrf_exempt
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
        users_qs = User.objects.exclude(id=request.user.id)

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
            }
            for u in users_qs[:50]  # Limit to 50 for performance
        ]
        return JsonResponse({"success": True, "users": users_data})
    except Exception as e:
        logger.error(f"User list error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An expected error occurred"}, status=500)


def _group_to_json(group):
    """Serialize a Group instance and its memberships"""
    memberships = group.memberships.select_related("user").all()
    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "group_type": group.group_type,
        "default_location": group.default_location,
        "privacy": group.privacy,
        "created_by": group.created_by.id if group.created_by else None,
        "created_at": group.created_at.isoformat(),
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


@csrf_exempt
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

            return JsonResponse({"success": True, "group": _group_to_json(group)})

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        except Exception as e:
            logger.error(f"Group creation error: {str(e)}", exc_info=True)
            return JsonResponse({"error": "An expected error occurred"}, status=500)

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
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


@csrf_exempt
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


@csrf_exempt
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

        GroupMembership.objects.create(
            group=group, user=target_user, role=GroupMembership.Role.MEMBER
        )

        return JsonResponse({"success": True, "group": _group_to_json(group)})

    except Group.DoesNotExist:
        return JsonResponse({"error": "Group not found"}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        logger.error(f"Group invite error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An expected error occurred"}, status=500)


@csrf_exempt
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
        return JsonResponse({"success": True, "group": _group_to_json(group)})

    except Group.DoesNotExist:
        return JsonResponse({"error": "Group not found"}, status=404)
    except Exception as e:
        logger.error(f"Group remove error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An expected error occurred"}, status=500)


@csrf_exempt
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

        return JsonResponse({"success": True, "group": _group_to_json(group)})

    except Group.DoesNotExist:
        return JsonResponse({"error": "Group not found"}, status=404)
    except Exception as e:
        logger.error(f"Group make leader error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An expected error occurred"}, status=500)


@csrf_exempt
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

        return JsonResponse({"success": True, "message": "You have left the group"})

    except Group.DoesNotExist:
        return JsonResponse({"error": "Group not found"}, status=404)
    except Exception as e:
        logger.error(f"Group leave error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An expected error occurred"}, status=500)
