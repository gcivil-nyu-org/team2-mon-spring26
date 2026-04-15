import json
import logging
from urllib.parse import urljoin
from django.shortcuts import render, redirect
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.views import View
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.conf import settings
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.core.cache import cache
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.encoding import force_bytes

from .forms import UserCreationForm
from .email_service import send_password_reset_email
from .models import (
    SANITATION_GRADE_CHOICES,
    UserPreference,
    VenueManagerProfile,
    DietaryTag,
    CuisineType,
    FoodTypeTag,
)
from django.utils.text import slugify

logger = logging.getLogger(__name__)

VALID_SANITATION_GRADES = {choice[0] for choice in SANITATION_GRADE_CHOICES}
User = get_user_model()


def _build_frontend_reset_link(
    uid: str, token: str, route_prefix: str = "reset-password"
) -> str:
    base_url = settings.FRONTEND_BASE_URL.rstrip("/") + "/"
    return urljoin(base_url, f"{route_prefix}/{uid}/{token}")


def _get_user_from_uid(uidb64: str):
    try:
        uid = urlsafe_base64_decode(uidb64).decode()
        return User.objects.filter(pk=uid).first()
    except Exception:
        return None


def _is_valid_password_reset_token(uidb64: str, token: str):
    user = _get_user_from_uid(uidb64)
    if not user:
        return None
    if not default_token_generator.check_token(user, token):
        return None
    return user


def _get_preferences_dict(user):
    """Return API-shaped preferences from UserPreference (M2M tag names). Creates preference if missing."""
    pref, _ = UserPreference.objects.get_or_create(
        user=user,
        defaults={"minimum_sanitation_grade": "A"},
    )
    return {
        "dietary": list(pref.dietary_tags.values_list("name", flat=True)),
        "cuisines": list(pref.cuisine_types.values_list("name", flat=True)),
        "foodTypes": list(pref.food_type_tags.values_list("name", flat=True)),
        "minimum_sanitation_grade": pref.minimum_sanitation_grade or "",
    }


def _set_preferences_from_payload(user, payload):
    """Create/update UserPreference from API payload (list of tag names + minimum_sanitation_grade)."""
    pref, _ = UserPreference.objects.get_or_create(
        user=user,
        defaults={"minimum_sanitation_grade": "A"},
    )
    if isinstance(payload.get("dietary"), list):
        tags = []
        for name in payload["dietary"]:
            if not isinstance(name, str):
                continue
            clean_name = name.strip()
            if not clean_name:
                continue
            tag, _ = DietaryTag.objects.get_or_create(
                name=clean_name,
                defaults={"slug": slugify(clean_name) or clean_name.lower()},
            )
            tags.append(tag)
        pref.dietary_tags.set(tags)
    if isinstance(payload.get("cuisines"), list):
        tags = []
        for name in payload["cuisines"]:
            if not isinstance(name, str):
                continue
            clean_name = name.strip()
            if not clean_name:
                continue
            tag, _ = CuisineType.objects.get_or_create(
                name=clean_name,
                defaults={"slug": slugify(clean_name) or clean_name.lower()},
            )
            tags.append(tag)
        pref.cuisine_types.set(tags)
    if isinstance(payload.get("foodTypes"), list):
        tags = []
        for name in payload["foodTypes"]:
            if not isinstance(name, str):
                continue
            clean_name = name.strip()
            if not clean_name:
                continue
            tag, _ = FoodTypeTag.objects.get_or_create(
                name=clean_name,
                defaults={"slug": slugify(clean_name) or clean_name.lower()},
            )
            tags.append(tag)
        pref.food_type_tags.set(tags)
    grade = payload.get("minimum_sanitation_grade")
    if grade is not None and grade in VALID_SANITATION_GRADES:
        pref.minimum_sanitation_grade = grade
        pref.save(update_fields=["minimum_sanitation_grade", "updated_at"])


def _user_to_json(user):
    """Build user payload with preferences for API responses."""
    payload = {
        "id": user.id,
        "email": user.email,
        "name": f"{user.first_name} {user.last_name}".strip(),
        "role": user.role,
        "photoUrl": user.photo_url,
        "preferences": _get_preferences_dict(user),
    }
    if user.role == "venue_manager":
        try:
            profile = user.venue_manager_profile
            payload["venueManager"] = {
                "businessName": profile.business_name,
                "businessEmail": profile.business_email,
                "businessPhone": profile.business_phone,
                "isVerified": profile.is_verified,
            }
        except VenueManagerProfile.DoesNotExist:
            payload["venueManager"] = None
    return payload


@csrf_exempt
def api_venue_register(request):
    """
    POST /api/auth/venue-register/
    Register a new venue manager account.
    Creates a User with role='venue_manager' and a linked VenueManagerProfile.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    try:
        data = json.loads(request.body)
        email = (data.get("email") or "").strip()
        password = (data.get("password") or "").strip()
        first_name = (data.get("firstName") or "").strip()
        last_name = (data.get("lastName") or "").strip()
        business_name = (data.get("businessName") or "").strip()
        business_email = (data.get("businessEmail") or email).strip()
        business_phone = (data.get("businessPhone") or "").strip()

        if not email or not password:
            return JsonResponse(
                {"success": False, "error": "Email and password are required"},
                status=400,
            )

        if User.objects.filter(email__iexact=email).exists():
            return JsonResponse(
                {"success": False, "error": "Email already registered"}, status=400
            )

        try:
            validate_password(password)
        except ValidationError as e:
            return JsonResponse(
                {"success": False, "error": " ".join(e.messages)}, status=400
            )

        from django.db import transaction as db_transaction

        with db_transaction.atomic():
            user = User.objects.create_user(
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role="venue_manager",
            )
            VenueManagerProfile.objects.create(
                user=user,
                business_name=business_name,
                business_email=business_email,
                business_phone=business_phone,
            )

        login(request, user)
        return JsonResponse({"success": True, "user": _user_to_json(user)}, status=201)

    except Exception as e:
        logger.error("Venue registration error: %s", str(e), exc_info=True)
        return JsonResponse(
            {"success": False, "error": "An unexpected error occurred"}, status=500
        )


@csrf_exempt
def api_admin_register(request):
    """
    POST /api/auth/admin-register/
    Register a new admin account. Requires an existing admin session.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)
    if request.user.role != "admin":
        return JsonResponse({"error": "Admin access required"}, status=403)

    try:
        data = json.loads(request.body)
        email = (data.get("email") or "").strip()
        password = (data.get("password") or "").strip()
        first_name = (data.get("firstName") or "").strip()
        last_name = (data.get("lastName") or "").strip()

        if not email or not password:
            return JsonResponse(
                {"success": False, "error": "Email and password are required"},
                status=400,
            )

        if User.objects.filter(email__iexact=email).exists():
            return JsonResponse(
                {"success": False, "error": "Email already registered"}, status=400
            )

        try:
            validate_password(password)
        except ValidationError as e:
            return JsonResponse(
                {"success": False, "error": " ".join(e.messages)}, status=400
            )

        user = User.objects.create_user(
            email=email,
            password=password,
            username=(first_name or "Admin"),
            first_name=first_name,
            last_name=last_name,
            role="admin",
            is_staff=True,
        )

        return JsonResponse({"success": True, "user": _user_to_json(user)}, status=201)

    except Exception as e:
        logger.error("Admin registration error: %s", str(e), exc_info=True)
        return JsonResponse(
            {"success": False, "error": "An unexpected error occurred"}, status=500
        )


class SignUpView(View):
    template_name = "registration/signup.html"

    def get(self, request):
        form = UserCreationForm()
        return render(request, self.template_name, {"form": form})

    def post(self, request):
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect("/")
        return render(request, self.template_name, {"form": form})


signup = SignUpView.as_view()

# --- JSON API Views for React Frontend ---


@csrf_exempt
def api_register(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            # Create a mutable dict to pass to the form
            post_data = {
                "email": data.get("email"),
                "first_name": data.get("first_name", ""),
                "last_name": data.get("last_name", ""),
                "password1": data.get("password"),
                "password2": data.get("password"),  # Auto-confirm for simple API
            }
            form = UserCreationForm(post_data)
            if form.is_valid():
                user = form.save()
                prefs = data.get("preferences")
                if prefs is not None:
                    _set_preferences_from_payload(user, prefs)
                login(request, user)
                return JsonResponse({"success": True, "user": _user_to_json(user)})
            else:
                return JsonResponse(
                    {"success": False, "errors": form.errors}, status=400
                )
        except Exception as e:
            logger.error(f"Registration error: {str(e)}", exc_info=True)
            return JsonResponse(
                {
                    "success": False,
                    "error": "An unexpected error occurred during registration. Please try again.",
                },
                status=500,
            )
    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def api_login(request):
    if request.method == "POST":
        # basic brute force mitigation: limit by IP and email
        ip = request.META.get("REMOTE_ADDR")
        cache_key = f"login_attempts_{ip}"
        attempts = cache.get(cache_key, 0)

        if attempts >= 10:
            return JsonResponse(
                {
                    "success": False,
                    "error": "Too many failed attempts. Please try again in 5 minutes.",
                },
                status=429,
            )

        try:
            data = json.loads(request.body)
            email = data.get("email")
            password = data.get("password")
            user = authenticate(request, username=email, password=password)
            if user is not None:
                cache.delete(cache_key)  # reset attempts on success
                login(request, user)
                return JsonResponse({"success": True, "user": _user_to_json(user)})
            else:
                cache.set(cache_key, attempts + 1, timeout=300)  # 5 min lockout
                return JsonResponse(
                    {"success": False, "error": "Invalid credentials"}, status=401
                )
        except Exception as e:
            logger.error(f"Login error: {str(e)}", exc_info=True)
            return JsonResponse(
                {
                    "success": False,
                    "error": "An unexpected error occurred during login. Please try again.",
                },
                status=500,
            )
    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def api_admin_login(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body)
        email = data.get("email")
        password = data.get("password")
        user = authenticate(request, username=email, password=password)
        if user is None:
            return JsonResponse(
                {"success": False, "error": "Invalid credentials"}, status=401
            )

        if user.role != "admin":
            return JsonResponse(
                {"success": False, "error": "This account is not an admin account"},
                status=403,
            )

        login(request, user)
        return JsonResponse({"success": True, "user": _user_to_json(user)})
    except Exception as e:
        logger.error(f"Admin login error: {str(e)}", exc_info=True)
        return JsonResponse(
            {
                "success": False,
                "error": "An unexpected error occurred during login. Please try again.",
            },
            status=500,
        )


@csrf_exempt
def api_logout(request):
    if request.method == "POST":
        logout(request)
        return JsonResponse({"success": True})
    return JsonResponse({"error": "Method not allowed"}, status=405)


@ensure_csrf_cookie
def api_me(request):
    if request.user.is_authenticated:
        return JsonResponse(
            {
                "authenticated": True,
                "user": _user_to_json(request.user),
            }
        )
    return JsonResponse({"authenticated": False}, status=401)


@csrf_exempt
def api_preferences_update(request):
    if request.method not in ("PATCH", "PUT"):
        return JsonResponse({"error": "Method not allowed"}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)
    try:
        data = json.loads(request.body)
        user = request.user
        _set_preferences_from_payload(user, data)
        return JsonResponse({"user": _user_to_json(user)})
    except (json.JSONDecodeError, TypeError):
        return JsonResponse(
            {"error": "Invalid JSON body"},
            status=400,
        )


@csrf_exempt
def api_request_password_reset(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            email = (data.get("email", "") or "").strip()

            if not email:
                return JsonResponse(
                    {"success": False, "error": "Email is required"}, status=400
                )

            # Server-side email validation
            validate_email(email)

            user = User.objects.filter(email__iexact=email).first()
            if user and user.is_active:
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                token = default_token_generator.make_token(user)
                reset_link = _build_frontend_reset_link(uid, token)

                # In development, always print the link so it can be used
                # even when email delivery is restricted (e.g. no verified domain).
                if settings.DEBUG:
                    logger.info(
                        "\n"
                        "=" * 60 + "\n"
                        "PASSWORD RESET LINK (dev – no email required):\n"
                        "%s\n"
                        "=" * 60,
                        reset_link,
                    )

                try:
                    send_password_reset_email(user.email, reset_link)
                except Exception as send_error:
                    logger.error(
                        "Failed to send password reset email for user_id=%s: %s",
                        user.id,
                        send_error,
                        exc_info=True,
                    )

            # Return a neutral response to prevent user enumeration.
            return JsonResponse(
                {
                    "success": True,
                    "message": "If an account with this email exists, a password reset link has been sent.",
                }
            )

        except ValidationError:
            return JsonResponse(
                {"success": False, "error": "Invalid email format"}, status=400
            )
        except Exception as e:
            logger.error(f"Password reset error: {str(e)}", exc_info=True)
            return JsonResponse(
                {
                    "success": False,
                    "error": "An unexpected error occurred. Please try again.",
                },
                status=500,
            )

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def api_request_admin_password_reset(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body)
        email = (data.get("email", "") or "").strip()

        if not email:
            return JsonResponse(
                {"success": False, "error": "Email is required"}, status=400
            )

        validate_email(email)

        user = User.objects.filter(email__iexact=email, role="admin").first()
        if user and user.is_active:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_link = _build_frontend_reset_link(uid, token, "admin/reset-password")

            if settings.DEBUG:
                logger.info(
                    "\n"
                    "=" * 60 + "\n"
                    "ADMIN PASSWORD RESET LINK (dev):\n"
                    "%s\n"
                    "=" * 60,
                    reset_link,
                )

            try:
                send_password_reset_email(user.email, reset_link)
            except Exception as send_error:
                logger.error(
                    "Failed to send admin password reset email for user_id=%s: %s",
                    user.id,
                    send_error,
                    exc_info=True,
                )

        return JsonResponse(
            {
                "success": True,
                "message": "If an admin account with this email exists, a password reset link has been sent.",
            }
        )
    except ValidationError:
        return JsonResponse(
            {"success": False, "error": "Invalid email format"}, status=400
        )
    except Exception as e:
        logger.error(f"Admin password reset error: {str(e)}", exc_info=True)
        return JsonResponse(
            {
                "success": False,
                "error": "An unexpected error occurred. Please try again.",
            },
            status=500,
        )


@csrf_exempt
def api_validate_password_reset_token(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse(
            {"success": False, "error": "Invalid JSON body"}, status=400
        )

    uid = (data.get("uid", "") or "").strip()
    token = (data.get("token", "") or "").strip()
    if not uid or not token:
        return JsonResponse(
            {
                "success": False,
                "valid": False,
                "error": "Invalid or expired reset link",
            },
            status=400,
        )

    user = _is_valid_password_reset_token(uid, token)
    if not user:
        return JsonResponse(
            {
                "success": False,
                "valid": False,
                "error": "Invalid or expired reset link",
            },
            status=400,
        )

    return JsonResponse({"success": True, "valid": True})


@csrf_exempt
def api_confirm_password_reset(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse(
            {"success": False, "error": "Invalid JSON body"}, status=400
        )

    uid = (data.get("uid", "") or "").strip()
    token = (data.get("token", "") or "").strip()
    new_password = data.get("new_password")

    if not uid or not token or not new_password:
        return JsonResponse(
            {"success": False, "error": "uid, token, and new_password are required"},
            status=400,
        )

    user = _is_valid_password_reset_token(uid, token)
    if not user:
        return JsonResponse(
            {"success": False, "error": "Invalid or expired reset link"},
            status=400,
        )

    try:
        validate_password(new_password, user=user)
    except ValidationError as validation_error:
        return JsonResponse(
            {"success": False, "error": " ".join(validation_error.messages)},
            status=400,
        )

    user.set_password(new_password)
    user.save(update_fields=["password"])

    return JsonResponse(
        {
            "success": True,
            "message": "Your password has been reset successfully.",
        }
    )


# --- Admin user management endpoints ---
# Issue #153 — admins can search, view, edit, delete user profiles.
# Issue #84 — deleting a user cleans up group/chat memberships while
# preserving the groups, swipe events and group chats themselves.

ADMIN_USERS_PAGE_SIZE = 20
VALID_ADMIN_ROLES = {"student", "venue_manager", "admin"}


def _require_admin(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)
    if request.user.role != "admin":
        return JsonResponse({"error": "Admin access required"}, status=403)
    return None


def _admin_user_row(user):
    return {
        "id": user.id,
        "email": user.email,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "name": f"{user.first_name} {user.last_name}".strip(),
        "role": user.role,
        "phone": user.phone,
        "photoUrl": user.photo_url,
        "isActive": user.is_active,
        "createdAt": user.created_at.isoformat() if user.created_at else None,
    }


def _admin_user_detail(user):
    row = _admin_user_row(user)

    preferences = None
    try:
        pref = user.preference
        preferences = {
            "dietary": list(pref.dietary_tags.values_list("name", flat=True)),
            "cuisines": list(pref.cuisine_types.values_list("name", flat=True)),
            "foodTypes": list(pref.food_type_tags.values_list("name", flat=True)),
            "minimumSanitationGrade": pref.minimum_sanitation_grade or "",
        }
    except Exception:
        preferences = None

    venue_manager = None
    try:
        vm = user.venue_manager_profile
        venue_manager = {
            "businessName": vm.business_name,
            "businessEmail": vm.business_email,
            "businessPhone": vm.business_phone,
            "isVerified": vm.is_verified,
        }
    except VenueManagerProfile.DoesNotExist:
        venue_manager = None

    memberships = [
        {
            "groupId": m.group_id,
            "groupName": m.group.name,
            "role": m.role,
            "joinDate": m.join_date.isoformat() if m.join_date else None,
        }
        for m in user.memberships.select_related("group").all()
    ]

    chats = [
        {
            "chatId": cm.chat_id,
            "chatType": cm.chat.type,
            "chatName": cm.chat.name or "",
            "role": cm.role,
        }
        for cm in user.chat_memberships.select_related("chat").filter(
            left_at__isnull=True
        )
    ]

    row["preferences"] = preferences
    row["venueManager"] = venue_manager
    row["memberships"] = memberships
    row["chats"] = chats
    return row


@csrf_exempt
def api_admin_users_list(request):
    """GET /api/auth/admin/users/?q=&role=&status=&page="""
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    guard = _require_admin(request)
    if guard:
        return guard

    q = (request.GET.get("q") or "").strip()
    role = (request.GET.get("role") or "").strip()
    status = (request.GET.get("status") or "").strip()
    try:
        page = max(1, int(request.GET.get("page") or 1))
    except (TypeError, ValueError):
        page = 1

    qs = User.objects.all().order_by("-created_at")

    if q:
        qs = qs.filter(
            Q(email__icontains=q)
            | Q(first_name__icontains=q)
            | Q(last_name__icontains=q)
        )
    if role in VALID_ADMIN_ROLES:
        qs = qs.filter(role=role)
    if status == "active":
        qs = qs.filter(is_active=True)
    elif status == "inactive":
        qs = qs.filter(is_active=False)

    paginator = Paginator(qs, ADMIN_USERS_PAGE_SIZE)
    page_obj = paginator.get_page(page)

    return JsonResponse(
        {
            "users": [_admin_user_row(u) for u in page_obj.object_list],
            "page": page_obj.number,
            "totalPages": paginator.num_pages,
            "totalCount": paginator.count,
        }
    )


@csrf_exempt
def api_admin_user_detail(request, user_id):
    """GET/PATCH/DELETE /api/auth/admin/users/<id>/"""
    guard = _require_admin(request)
    if guard:
        return guard

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found"}, status=404)

    if request.method == "GET":
        return JsonResponse({"user": _admin_user_detail(user)})

    if request.method == "PATCH":
        return _admin_update_user(request, user)

    if request.method == "DELETE":
        return _admin_delete_user(request, user)

    return JsonResponse({"error": "Method not allowed"}, status=405)


def _admin_update_user(request, user):
    try:
        data = json.loads(request.body or "{}")
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    fields_changed = []

    if "firstName" in data:
        user.first_name = (data.get("firstName") or "").strip()
        fields_changed.append("first_name")
    if "lastName" in data:
        user.last_name = (data.get("lastName") or "").strip()
        fields_changed.append("last_name")
    if "phone" in data:
        user.phone = (data.get("phone") or "").strip()
        fields_changed.append("phone")
    if "photoUrl" in data:
        user.photo_url = (data.get("photoUrl") or "").strip()
        fields_changed.append("photo_url")
    if "email" in data:
        new_email = (data.get("email") or "").strip()
        if new_email and new_email.lower() != user.email.lower():
            if (
                User.objects.filter(email__iexact=new_email)
                .exclude(pk=user.pk)
                .exists()
            ):
                return JsonResponse({"error": "Email already in use"}, status=400)
            user.email = new_email
            fields_changed.append("email")
    if "role" in data:
        new_role = data.get("role")
        if new_role in VALID_ADMIN_ROLES:
            if user.id == request.user.id and new_role != "admin":
                return JsonResponse(
                    {"error": "You cannot change your own role"}, status=400
                )
            user.role = new_role
            fields_changed.append("role")
    if "isActive" in data:
        new_active = bool(data.get("isActive"))
        if user.id == request.user.id and not new_active:
            return JsonResponse(
                {"error": "You cannot deactivate your own account"}, status=400
            )
        user.is_active = new_active
        fields_changed.append("is_active")

    if fields_changed:
        user.save(update_fields=list(set(fields_changed + ["updated_at"])))

    return JsonResponse({"user": _admin_user_detail(user)})


def safely_delete_user(user, fallback_creator=None):
    """Delete a user while preserving groups, swipe events and group chats.

    Issue #84 — When a profile is deleted, the user is removed from every
    group and chat they belong to, but the groups themselves, their swipe
    events, and their chats all stay intact.

    Steps:
      1. For each Chat the user created, hand it off to another active
         member (admin role first, then earliest member). If no other
         member exists, fall back to ``fallback_creator`` (typically the
         admin performing the delete); otherwise delete the empty chat.
      2. Null out Message.sender on the user's messages so chat history
         survives (the field is already nullable).
      3. user.delete() cascades GroupMembership / ChatMember / Swipe /
         invitations / UserPreference. Group.created_by and
         SwipeEvent.created_by are SET_NULL, so groups and events remain.
    """
    try:
        from chat.models import Chat, ChatMember, Message
    except ImportError:
        Chat = ChatMember = Message = None

    with transaction.atomic():
        if Chat is not None and ChatMember is not None:
            for chat in Chat.objects.filter(created_by=user):
                replacement = (
                    ChatMember.objects.filter(chat=chat, left_at__isnull=True)
                    .exclude(user=user)
                    .select_related("user")
                    .order_by("role", "joined_at")
                    .first()
                )
                if replacement:
                    chat.created_by = replacement.user
                    chat.save(update_fields=["created_by", "updated_at"])
                elif fallback_creator is not None and fallback_creator.pk != user.pk:
                    chat.created_by = fallback_creator
                    chat.save(update_fields=["created_by", "updated_at"])
                else:
                    chat.delete()

        if Message is not None:
            Message.objects.filter(sender=user).update(sender=None)

        user.delete()


def _admin_delete_user(request, user):
    if user.id == request.user.id:
        return JsonResponse({"error": "You cannot delete your own account"}, status=400)
    try:
        safely_delete_user(user, fallback_creator=request.user)
    except Exception as exc:
        logger.error("Failed to delete user %s: %s", user.id, exc, exc_info=True)
        return JsonResponse({"error": "Failed to delete user"}, status=500)

    return JsonResponse({"success": True})
