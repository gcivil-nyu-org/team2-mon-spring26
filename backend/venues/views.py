import json
import logging

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction

from .models import Venue, StudentDiscount, VenueClaim
from accounts.models import VenueManagerProfile

logger = logging.getLogger(__name__)


def _require_venue_manager(request):
    """Returns (manager_profile, None) or (None, error_response)."""
    if not request.user.is_authenticated:
        return None, JsonResponse({"error": "Authentication required"}, status=401)
    if request.user.role != "venue_manager":
        return None, JsonResponse(
            {"error": "Venue manager access required"}, status=403
        )
    try:
        profile = request.user.venue_manager_profile
        return profile, None
    except VenueManagerProfile.DoesNotExist:
        return None, JsonResponse(
            {"error": "Venue manager profile not found"}, status=404
        )


def _venue_to_json(venue):
    """Serialize a Venue to the shape the frontend expects."""
    latest_inspection = venue.inspections.first()
    active_discounts = [
        _discount_to_json(d) for d in venue.discounts.filter(is_active=True)
    ]
    claim = (
        venue.claims.filter(manager=venue.managed_by).first()
        if venue.managed_by
        else None
    )

    return {
        "id": venue.id,
        "name": venue.name,
        "streetAddress": venue.street_address,
        "borough": venue.borough,
        "neighborhood": venue.neighborhood,
        "zipcode": venue.zipcode,
        "phone": venue.phone,
        "email": venue.email,
        "website": venue.website,
        "cuisineType": venue.cuisine_type.name if venue.cuisine_type else "",
        "priceRange": venue.price_range,
        "sanitationGrade": venue.sanitation_grade,
        "seatingCapacity": venue.seating_capacity,
        "hasGroupSeating": venue.has_group_seating,
        "hasTakeout": venue.has_takeout,
        "hasDelivery": venue.has_delivery,
        "hasDineIn": venue.has_dine_in,
        "isReservable": venue.is_reservable,
        "googleRating": float(venue.google_rating) if venue.google_rating else None,
        "googleReviewCount": venue.google_review_count,
        "googleMapsUrl": venue.google_maps_url,
        "isVerified": venue.is_verified,
        "isActive": venue.is_active,
        "dietaryTags": list(venue.dietary_tags.values_list("name", flat=True)),
        "lastInspectionDate": (
            latest_inspection.inspection_date.isoformat()
            if latest_inspection and latest_inspection.inspection_date
            else None
        ),
        "lastInspectionGrade": latest_inspection.grade if latest_inspection else "",
        "lastInspectionScore": latest_inspection.score if latest_inspection else None,
        "isClaimed": venue.managed_by is not None,
        "claimStatus": claim.status if claim else None,
        "activeDiscounts": active_discounts,
    }


def _discount_to_json(discount):
    return {
        "id": discount.id,
        "venueId": discount.venue_id,
        "discountType": discount.discount_type,
        "discountValue": discount.discount_value,
        "description": discount.description,
        "requiresNyuId": discount.requires_nyu_id,
        "isActive": discount.is_active,
        "validFrom": discount.valid_from.isoformat() if discount.valid_from else None,
        "validUntil": (
            discount.valid_until.isoformat() if discount.valid_until else None
        ),
        "createdAt": discount.created_at.isoformat(),
        "updatedAt": discount.updated_at.isoformat(),
    }


@csrf_exempt
def api_venue_search(request):
    """
    GET /api/venues/search/?q=&borough=
    Returns venues available to be claimed, plus claimed ones (flagged).
    """
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)
    if request.user.role != "venue_manager":
        return JsonResponse({"error": "Venue manager access required"}, status=403)

    q = request.GET.get("q", "").strip()
    borough = request.GET.get("borough", "").strip()

    venues_qs = (
        Venue.objects.filter(is_active=True)
        .select_related("cuisine_type", "managed_by", "managed_by__user")
        .prefetch_related("dietary_tags", "inspections", "discounts")
    )

    if q:
        venues_qs = venues_qs.filter(name__icontains=q)
    if borough:
        venues_qs = venues_qs.filter(borough=borough)

    venues_qs = venues_qs.order_by("name")[:50]

    results = []
    for v in venues_qs:
        latest = v.inspections.first()  # ordered by -inspection_date
        active_discounts = [d for d in v.discounts.all() if d.is_active]
        results.append(
            {
                "id": v.id,
                "name": v.name,
                "streetAddress": v.street_address,
                "borough": v.borough,
                "neighborhood": v.neighborhood,
                "zipcode": v.zipcode,
                "phone": v.phone,
                "website": v.website,
                "cuisineType": v.cuisine_type.name if v.cuisine_type else "",
                "priceRange": v.price_range,
                "sanitationGrade": v.sanitation_grade,
                "seatingCapacity": v.seating_capacity,
                "hasGroupSeating": v.has_group_seating,
                "hasTakeout": v.has_takeout,
                "hasDelivery": v.has_delivery,
                "hasDineIn": v.has_dine_in,
                "isReservable": v.is_reservable,
                "googleRating": float(v.google_rating) if v.google_rating else None,
                "googleReviewCount": v.google_review_count,
                "googleMapsUrl": v.google_maps_url,
                "dietaryTags": list(v.dietary_tags.values_list("name", flat=True)),
                "lastInspectionDate": (
                    latest.inspection_date.isoformat()
                    if latest and latest.inspection_date
                    else None
                ),
                "lastInspectionGrade": latest.grade if latest else "",
                "lastInspectionScore": latest.score if latest else None,
                "hasStudentDiscount": len(active_discounts) > 0,
                "isClaimed": v.managed_by is not None,
                "claimedBy": (
                    v.managed_by.business_name or v.managed_by.user.email
                    if v.managed_by
                    else None
                ),
            }
        )

    return JsonResponse({"results": results})


@csrf_exempt
def api_venue_claim(request, venue_id):
    """
    POST /api/venues/<id>/claim/
    Claim a venue. Creates a VenueClaim in PENDING state and immediately
    sets Venue.managed_by so the manager can start adding discounts.
    Returns 409 if the venue already has a different manager.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    manager, err = _require_venue_manager(request)
    if err:
        return err

    try:
        venue = Venue.objects.get(pk=venue_id, is_active=True)
    except Venue.DoesNotExist:
        return JsonResponse({"error": "Venue not found"}, status=404)

    if venue.managed_by is not None and venue.managed_by != manager:
        return JsonResponse(
            {"error": "This venue is already claimed by another manager"}, status=409
        )

    if venue.managed_by == manager:
        return JsonResponse(
            {"error": "You have already claimed this venue"}, status=409
        )

    try:
        data = json.loads(request.body) if request.body else {}
    except (json.JSONDecodeError, TypeError):
        data = {}

    note = (data.get("note") or "").strip()

    with transaction.atomic():
        venue.managed_by = manager
        venue.save(update_fields=["managed_by", "updated_at"])

        VenueClaim.objects.get_or_create(
            venue=venue,
            manager=manager,
            defaults={"note": note, "status": VenueClaim.Status.PENDING},
        )

    return JsonResponse({"success": True, "venue": _venue_to_json(venue)}, status=201)


@csrf_exempt
def api_my_venues(request):
    """
    GET /api/venues/my-venues/
    List all venues managed by the current venue manager.
    """
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    manager, err = _require_venue_manager(request)
    if err:
        return err

    venues = (
        Venue.objects.filter(managed_by=manager, is_active=True)
        .select_related("cuisine_type", "managed_by")
        .prefetch_related("inspections", "discounts", "dietary_tags", "claims")
        .order_by("name")
    )

    return JsonResponse({"venues": [_venue_to_json(v) for v in venues]})


@csrf_exempt
def api_venue_detail(request, venue_id):
    """
    GET /api/venues/<id>/
    Full read-only venue detail for the claiming manager.
    """
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    manager, err = _require_venue_manager(request)
    if err:
        return err

    try:
        venue = (
            Venue.objects.select_related("cuisine_type", "managed_by")
            .prefetch_related("inspections", "discounts", "dietary_tags", "claims")
            .get(pk=venue_id, managed_by=manager, is_active=True)
        )
    except Venue.DoesNotExist:
        return JsonResponse({"error": "Venue not found"}, status=404)

    return JsonResponse({"venue": _venue_to_json(venue)})


@csrf_exempt
def api_venue_discounts(request, venue_id):
    """
    GET  /api/venues/<id>/discounts/  — list discounts
    POST /api/venues/<id>/discounts/  — create discount
    """
    manager, err = _require_venue_manager(request)
    if err:
        return err

    try:
        venue = Venue.objects.get(pk=venue_id, managed_by=manager, is_active=True)
    except Venue.DoesNotExist:
        return JsonResponse({"error": "Venue not found"}, status=404)

    if request.method == "GET":
        discounts = venue.discounts.all().order_by("-created_at")
        return JsonResponse({"discounts": [_discount_to_json(d) for d in discounts]})

    if request.method == "POST":
        try:
            data = json.loads(request.body)
        except (json.JSONDecodeError, TypeError):
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        try:
            discount = StudentDiscount.objects.create(
                venue=venue,
                discount_type=(data.get("discountType") or "").strip(),
                discount_value=(data.get("discountValue") or "").strip(),
                description=(data.get("description") or "").strip(),
                requires_nyu_id=bool(data.get("requiresNyuId", True)),
                is_active=bool(data.get("isActive", True)),
                valid_from=data.get("validFrom") or None,
                valid_until=data.get("validUntil") or None,
            )
            discount.refresh_from_db()
        except Exception as e:
            logger.error("Failed to create discount: %s", str(e), exc_info=True)
            return JsonResponse(
                {"error": f"Failed to create discount: {str(e)}"}, status=400
            )

        return JsonResponse({"discount": _discount_to_json(discount)}, status=201)

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def api_venue_discount_detail(request, venue_id, discount_id):
    """
    PATCH  /api/venues/<venue_id>/discounts/<discount_id>/  — update
    DELETE /api/venues/<venue_id>/discounts/<discount_id>/  — delete
    """
    manager, err = _require_venue_manager(request)
    if err:
        return err

    try:
        venue = Venue.objects.get(pk=venue_id, managed_by=manager, is_active=True)
    except Venue.DoesNotExist:
        return JsonResponse({"error": "Venue not found"}, status=404)

    try:
        discount = StudentDiscount.objects.get(pk=discount_id, venue=venue)
    except StudentDiscount.DoesNotExist:
        return JsonResponse({"error": "Discount not found"}, status=404)

    if request.method == "PATCH":
        try:
            data = json.loads(request.body)
        except (json.JSONDecodeError, TypeError):
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        fields_updated = []
        if "discountType" in data:
            discount.discount_type = (data["discountType"] or "").strip()
            fields_updated.append("discount_type")
        if "discountValue" in data:
            discount.discount_value = (data["discountValue"] or "").strip()
            fields_updated.append("discount_value")
        if "description" in data:
            discount.description = (data["description"] or "").strip()
            fields_updated.append("description")
        if "requiresNyuId" in data:
            discount.requires_nyu_id = bool(data["requiresNyuId"])
            fields_updated.append("requires_nyu_id")
        if "isActive" in data:
            discount.is_active = bool(data["isActive"])
            fields_updated.append("is_active")
        if "validFrom" in data:
            discount.valid_from = data["validFrom"] or None
            fields_updated.append("valid_from")
        if "validUntil" in data:
            discount.valid_until = data["validUntil"] or None
            fields_updated.append("valid_until")

        if fields_updated:
            fields_updated.append("updated_at")
            try:
                discount.save(update_fields=fields_updated)
                discount.refresh_from_db()
            except Exception as e:
                logger.error("Failed to update discount: %s", str(e), exc_info=True)
                return JsonResponse(
                    {"error": f"Failed to update discount: {str(e)}"}, status=400
                )

        return JsonResponse({"discount": _discount_to_json(discount)})

    if request.method == "DELETE":
        discount.delete()
        return JsonResponse({"success": True})

    return JsonResponse({"error": "Method not allowed"}, status=405)
