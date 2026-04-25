import json
import logging
from django.http import JsonResponse
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from .models import Chat, ChatMember, Message
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)


def notify_chat_users(chat):
    channel_layer = get_channel_layer()
    if channel_layer:
        memberships = chat.members.filter(left_at__isnull=True)
        for member in memberships:
            group_name = f"user_notifications_{member.user.id}"
            async_to_sync(channel_layer.group_send)(group_name, {"type": "chat_update"})


User = get_user_model()


def _message_to_json(message, is_admin=False):
    msg_body = message.body
    if message.deleted_at:
        if is_admin:
            msg_body = f"{msg_body} (Deleted)"
        else:
            msg_body = "[This message has been deleted]"

    return {
        "id": f"msg-{message.id}",
        "type": (
            "system" if message.message_type == Message.MessageType.SYSTEM else "user"
        ),
        "userId": str(message.sender.id) if message.sender else None,
        "userName": (
            message.sender.name
            if message.sender
            and hasattr(message.sender, "name")
            and message.sender.name
            else (
                f"{message.sender.first_name} {message.sender.last_name}".strip()
                or message.sender.username
                if message.sender
                else None
            )
        ),
        "userPhotoUrl": (
            message.sender.photo_url
            if message.sender and getattr(message.sender, "photo_url", None)
            else None
        ),
        "message": msg_body,
        "timestamp": message.created_at.isoformat().replace("+00:00", "Z"),
        "message_type": message.message_type,
        "is_deleted": bool(message.deleted_at),
    }


def _chat_to_json(chat, request_user=None):
    memberships = chat.members.select_related("user").filter(left_at__isnull=True)
    participants = [str(m.user.id) for m in memberships]
    participant_names = [
        (
            m.user.name
            if hasattr(m.user, "name") and m.user.name
            else (f"{m.user.first_name} {m.user.last_name}".strip() or m.user.username)
        )
        for m in memberships
    ]

    # Load messages once, with sender preloaded, ordered by creation time
    messages_qs = chat.messages.select_related("sender").order_by("created_at")
    messages = list(messages_qs)

    last_msg = messages[-1] if messages else None
    last_message_time = (
        last_msg.created_at.isoformat().replace("+00:00", "Z") if last_msg else None
    )

    is_admin = False
    if request_user:
        for m in memberships:
            if m.user.id == request_user.id and m.role == ChatMember.Role.ADMIN:
                is_admin = True
                break

    return {
        "id": (
            str(chat.id)
            if chat.type == Chat.ChatType.DIRECT
            else (str(chat.group.id) if getattr(chat, "group", None) else str(chat.id))
        ),
        "type": chat.type,
        "name": chat.name,
        "created_by": str(chat.created_by.id) if chat.created_by else None,
        "created_at": chat.created_at.isoformat().replace("+00:00", "Z"),
        "participants": participants,
        "participantNames": participant_names,
        "mutedParticipants": [str(m.user.id) for m in memberships if m.is_muted],
        "lastMessageTime": last_message_time,
        "isGroup": chat.type == Chat.ChatType.GROUP,
        "messages": [_message_to_json(m, is_admin=is_admin) for m in messages],
    }


def api_chat_list_create(request):
    """
    GET /api/chat/ - List all chats the user is a member of (Groups and DMs)
    POST /api/chat/ - Create a new DM Conversation
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    if request.method == "GET":
        try:
            from groups.models import Group, GroupMembership

            missing_chat_groups = Group.objects.filter(
                memberships__user=request.user, chat__isnull=True
            )
            for group in missing_chat_groups:
                with transaction.atomic():
                    chat = Chat.objects.create(
                        type=Chat.ChatType.GROUP,
                        name=group.name,
                        created_by=group.created_by or request.user,
                        group=group,
                    )
                    group_memberships = GroupMembership.objects.filter(group=group)
                    chat_members = []
                    for gm in group_memberships:
                        role = (
                            ChatMember.Role.ADMIN
                            if gm.role == "leader"
                            else ChatMember.Role.MEMBER
                        )
                        chat_members.append(
                            ChatMember(chat=chat, user=gm.user, role=role)
                        )
                    ChatMember.objects.bulk_create(chat_members)

            chats = (
                Chat.objects.filter(
                    members__user=request.user, members__left_at__isnull=True
                )
                .distinct()
                .prefetch_related("members__user", "messages", "group")
            )

            chat_data = [_chat_to_json(c, request.user) for c in chats]
            return JsonResponse({"success": True, "chats": chat_data})
        except Exception as e:
            logger.error(f"Chat fetch error: {str(e)}", exc_info=True)
            return JsonResponse({"error": "An expected error occurred"}, status=500)

    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            # DMs creation via POST {"participantId": ...}
            participant_id = data.get("participantId")
            if not participant_id:
                return JsonResponse({"error": "participantId required"}, status=400)

            try:
                other_user = User.objects.get(id=participant_id)
            except User.DoesNotExist:
                return JsonResponse({"error": "User not found"}, status=404)

            # Check if DM exists
            existing_dms = (
                Chat.objects.filter(
                    type=Chat.ChatType.DIRECT, members__user=request.user
                )
                .filter(members__user=other_user)
                .distinct()
            )

            if existing_dms.exists():
                return JsonResponse(
                    {
                        "success": True,
                        "chat": _chat_to_json(existing_dms.first(), request.user),
                    }
                )

            with transaction.atomic():
                chat = Chat.objects.create(
                    type=Chat.ChatType.DIRECT, created_by=request.user
                )
                ChatMember.objects.create(chat=chat, user=request.user)
                ChatMember.objects.create(chat=chat, user=other_user)

            chat_full = Chat.objects.prefetch_related("members__user", "messages").get(
                id=chat.id
            )
            notify_chat_users(chat_full)
            return JsonResponse(
                {"success": True, "chat": _chat_to_json(chat_full, request.user)},
                status=201,
            )

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        except Exception as e:
            logger.error(f"Chat creation error: {str(e)}", exc_info=True)
            return JsonResponse({"error": "An expected error occurred"}, status=500)

    return JsonResponse({"error": "Method not allowed"}, status=405)


def api_chat_messages(request, chat_id):
    """
    GET /api/chat/<id>/messages/
    POST /api/chat/<id>/messages/
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        chat = None
        if str(chat_id).startswith("dm-"):
            real_chat_id = str(chat_id)[3:]
            try:
                chat = Chat.objects.get(id=real_chat_id, type=Chat.ChatType.DIRECT)
            except Chat.DoesNotExist:
                return JsonResponse({"error": "Chat not found"}, status=404)
        else:
            # Treat chat_id as a potential group ID and resolve/create the group chat
            from groups.models import Group, GroupMembership

            try:
                group = Group.objects.get(id=chat_id)
            except (Group.DoesNotExist, ValueError):
                return JsonResponse({"error": "Chat not found"}, status=404)

            if not GroupMembership.objects.filter(
                group=group, user=request.user
            ).exists():
                return JsonResponse(
                    {"error": "You are not a member of this group"}, status=403
                )

            # Re-use existing chat for this group if it exists, otherwise lazily provision it
            chat = Chat.objects.filter(group=group).first()
            if not chat:
                with transaction.atomic():
                    chat = Chat.objects.create(
                        type=Chat.ChatType.GROUP,
                        name=group.name,
                        created_by=group.created_by or request.user,
                        group=group,
                    )
                    group_memberships = GroupMembership.objects.filter(group=group)
                    chat_members = []
                    for gm in group_memberships:
                        role = (
                            ChatMember.Role.ADMIN
                            if gm.role == "leader"
                            else ChatMember.Role.MEMBER
                        )
                        chat_members.append(
                            ChatMember(chat=chat, user=gm.user, role=role)
                        )
                    ChatMember.objects.bulk_create(chat_members)
        # Check membership
        membership = ChatMember.objects.filter(
            chat=chat, user=request.user, left_at__isnull=True
        ).first()
        if not membership:
            return JsonResponse(
                {"error": "You are not a member of this chat"}, status=403
            )

        if request.method == "GET":
            messages = (
                chat.messages.all().select_related("sender").order_by("created_at")
            )
            is_admin = membership.role == ChatMember.Role.ADMIN
            return JsonResponse(
                {
                    "success": True,
                    "messages": [
                        _message_to_json(m, is_admin=is_admin) for m in messages
                    ],
                }
            )

        elif request.method == "POST":
            if membership.is_muted:
                return JsonResponse(
                    {
                        "error": "You currently do not have permission to chat in this group."
                    },
                    status=403,
                )

            data = json.loads(request.body)
            body = data.get("message")
            if not body:
                return JsonResponse({"error": "Message body required"}, status=400)

            # For user-initiated posts, always create a regular text message.
            # System messages should only be created by trusted server-side flows.
            actual_type = Message.MessageType.TEXT
            sender = request.user

            message = Message.objects.create(
                chat=chat, sender=sender, message_type=actual_type, body=body
            )
            notify_chat_users(chat)

            is_admin = membership.role == ChatMember.Role.ADMIN
            return JsonResponse(
                {
                    "success": True,
                    "message": _message_to_json(message, is_admin=is_admin),
                },
                status=201,
            )

        return JsonResponse({"error": "Method not allowed"}, status=405)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        logger.error(f"Message list/create error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An expected error occurred"}, status=500)


def api_chat_message_detail(request, chat_id, message_id):
    """
    DELETE /api/chat/<chat_id>/messages/<message_id>/
    Soft deletes a message. Requires user to be an ADMIN (Group Leader).
    """
    if request.method != "DELETE":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        chat = None
        if str(chat_id).startswith("dm-"):
            real_chat_id = str(chat_id)[3:]
            chat = Chat.objects.filter(
                id=real_chat_id, type=Chat.ChatType.DIRECT
            ).first()
        else:
            chat = Chat.objects.filter(group__id=chat_id).first()
        if not chat:
            return JsonResponse({"error": "Chat not found"}, status=404)

        membership = ChatMember.objects.filter(
            chat=chat, user=request.user, left_at__isnull=True
        ).first()
        if not membership:
            return JsonResponse(
                {"error": "You are not a member of this chat"}, status=403
            )

        if membership.role != ChatMember.Role.ADMIN:
            return JsonResponse(
                {"error": "Only group leaders can delete messages"}, status=403
            )

        # Remove "msg-" prefix if passed via frontend
        if str(message_id).startswith("msg-"):
            message_id = str(message_id)[4:]

        message = Message.objects.filter(chat=chat, id=message_id).first()
        if not message:
            return JsonResponse({"error": "Message not found"}, status=404)

        if message.deleted_at:
            return JsonResponse({"error": "Message is already deleted"}, status=400)

        message.deleted_at = timezone.now()
        message.save(update_fields=["deleted_at"])
        notify_chat_users(chat)

        return JsonResponse({"success": True, "message": "Message deleted gracefully"})

    except Exception as e:
        logger.error(f"Message delete error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "An expected error occurred"}, status=500)


def api_chat_member_mute(request, chat_id, user_id):
    """
    POST /api/chat/<chat_id>/members/<user_id>/mute/
    Toggles is_muted on a ChatMember. Requires user to be an ADMIN.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        chat = None
        if str(chat_id).startswith("dm-"):
            real_chat_id = str(chat_id)[3:]
            chat = Chat.objects.filter(
                id=real_chat_id, type=Chat.ChatType.DIRECT
            ).first()
        else:
            chat = Chat.objects.filter(group__id=chat_id).first()
        if not chat:
            return JsonResponse({"error": "Chat not found"}, status=404)

        membership = ChatMember.objects.filter(
            chat=chat, user=request.user, left_at__isnull=True
        ).first()
        if not membership or membership.role != ChatMember.Role.ADMIN:
            return JsonResponse({"error": "Only admins can mute members"}, status=403)

        target_membership = ChatMember.objects.filter(
            chat=chat, user_id=user_id, left_at__isnull=True
        ).first()
        if not target_membership:
            return JsonResponse(
                {"error": "Target user is not in this chat"}, status=404
            )

        target_membership.is_muted = not target_membership.is_muted
        target_membership.save(update_fields=["is_muted"])
        notify_chat_users(chat)

        return JsonResponse({"success": True, "is_muted": target_membership.is_muted})
    except Exception as e:
        logger.error(f"Mute member error: {str(e)}", exc_info=True)
        return JsonResponse({"error": "Internal server error"}, status=500)
