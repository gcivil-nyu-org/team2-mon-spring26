# Created to allow for venue managers to search for venues
# Kchen April 2024 - remove if search not needed
import json
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import get_user_model

from .models import Venue, StudentDiscount
from accounts.models import VenueManagerProfile

logger = logging.getLogger(__name__)
User = get_user_model()


def _venue_to_json(venue):
    """Serialize a venue to API-friendly dict."""
    # Get active student discount if any
    discount = venue.discounts.filter(is_active=True).first()
    return {
        "id": venue.id,
        "name": venue.name,
        "street_address": venue.street_address,
        "borough": venue.borough,
        "neighborhood": venue.neighborhood,
        "price_range": venue.price_range,
        "sanitation_grade": venue.sanitation_grade,
        "seating_capacity": venue.seating_capacity,
        "has_group_seating": venue.has_group_seating,
        "phone": venue.phone,
        "email": venue.email,
        "is_verified": venue.is_verified,
        "is_active": venue.is_active,
        "managed_by_id": venue.managed_by_id,
        "cuisine_type": venue.cuisine_type.name if venue.cuisine_type else "",
        "dietary_tags": list(venue.dietary_tags.values_list("name", flat=True)),
        "google_rating": str(venue.google_rating) if venue.google_rating else None,
        "mealswipe_rating": str(venue.mealswipe_rating),
        "has_student_discount": discount is not None,
        "discount_details": discount.description if discount else "",
    }


@csrf_exempt
def api_venue_search(request):
    """Search venues by name as the manager types."""
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    query = request.GET.get("q", "").strip()
    if len(query) < 2:
        return JsonResponse({"venues": []})

    venues = (
        Venue.objects.filter(
            name__icontains=query,
            is_active=True,
            managed_by__isnull=True,
        )
        .select_related("cuisine_type")
        .prefetch_related("dietary_tags")[:10]
    )

    return JsonResponse({"venues": [_venue_to_json(v) for v in venues]})


@csrf_exempt
def api_venue_claim(request):
    """Claim a venue by linking it to the venue manager's profile."""
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    if request.user.role != "venue_manager":
        return JsonResponse(
            {"error": "Only venue managers can claim venues"}, status=403
        )

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    venue_id = data.get("venue_id")
    discount_details = data.get("discount_details", "").strip()
    has_student_discount = data.get("has_student_discount", False)

    if not venue_id:
        return JsonResponse({"error": "venue_id is required"}, status=400)

    try:
        venue = Venue.objects.get(id=venue_id)
    except Venue.DoesNotExist:
        return JsonResponse({"error": "Venue not found"}, status=404)

    if venue.managed_by is not None:
        return JsonResponse(
            {"error": "This venue is already claimed by another manager"},
            status=409,
        )

    try:
        profile = request.user.venue_manager_profile
    except VenueManagerProfile.DoesNotExist:
        return JsonResponse({"error": "Venue manager profile not found"}, status=404)

    venue.managed_by = profile
    venue.save(update_fields=["managed_by", "updated_at"])

    if has_student_discount and discount_details:
        StudentDiscount.objects.create(
            venue=venue,
            discount_type="Student Discount",
            description=discount_details,
            requires_nyu_id=True,
            is_active=True,
        )

    return JsonResponse({"success": True, "venue": _venue_to_json(venue)})


@csrf_exempt
def api_manager_venues(request):
    """Get all venues claimed by the current venue manager."""
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    if request.user.role != "venue_manager":
        return JsonResponse(
            {"error": "Only venue managers can access this"}, status=403
        )

    try:
        profile = request.user.venue_manager_profile
    except VenueManagerProfile.DoesNotExist:
        return JsonResponse({"venues": []})

    venues = (
        Venue.objects.filter(managed_by=profile, is_active=True)
        .select_related("cuisine_type")
        .prefetch_related("dietary_tags", "discounts")
    )

    return JsonResponse(
        {"success": True, "venues": [_venue_to_json(v) for v in venues]}
    )


@csrf_exempt
def api_venue_unclaim(request, venue_id):
    """Remove a venue from the manager's profile."""
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        profile = request.user.venue_manager_profile
    except VenueManagerProfile.DoesNotExist:
        return JsonResponse({"error": "Profile not found"}, status=404)

    try:
        venue = Venue.objects.get(id=venue_id, managed_by=profile)
    except Venue.DoesNotExist:
        return JsonResponse(
            {"error": "Venue not found or not owned by you"}, status=404
        )

    venue.managed_by = None
    venue.save(update_fields=["managed_by", "updated_at"])

    return JsonResponse({"success": True})


@csrf_exempt
def api_venue_update_discount(request, venue_id):
    """Update or remove the student discount for a claimed venue."""
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        profile = request.user.venue_manager_profile
    except VenueManagerProfile.DoesNotExist:
        return JsonResponse({"error": "Profile not found"}, status=404)

    try:
        venue = Venue.objects.get(id=venue_id, managed_by=profile)
    except Venue.DoesNotExist:
        return JsonResponse(
            {"error": "Venue not found or not owned by you"}, status=404
        )

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    has_student_discount = data.get("has_student_discount", False)
    discount_details = data.get("discount_details", "").strip()

    # Deactivate all existing discounts for this venue
    StudentDiscount.objects.filter(venue=venue).update(is_active=False)

    # Create new active discount if requested
    if has_student_discount and discount_details:
        StudentDiscount.objects.create(
            venue=venue,
            discount_type="Student Discount",
            description=discount_details,
            requires_nyu_id=True,
            is_active=True,
        )

    return JsonResponse({"success": True, "venue": _venue_to_json(venue)})
