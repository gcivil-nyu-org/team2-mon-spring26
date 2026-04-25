import json
import logging
import math
from datetime import date

from django.http import JsonResponse
from django.db import transaction
from django.db.models import F, Prefetch, prefetch_related_objects
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings

from .models import (
    Venue,
    StudentDiscount,
    VenueClaim,
    Review,
    ReviewComment,
    ContentReport,
)
from .filters import filter_venues_by_preferences
from .google_places import bulk_prefetch_photos
from accounts.models import VenueManagerProfile, CuisineType, DietaryTag, FoodTypeTag

logger = logging.getLogger(__name__)


def _safe_display_name(user):
    full_name = f"{user.first_name} {user.last_name}".strip()
    return full_name or user.email


def _notify_content_removed(user, venue_name, content_type):
    """Best-effort email notification when admin removes reported content."""
    subject = "Your MealSwipe content was removed"
    message = (
        f"Your {content_type} for {venue_name} was removed by an administrator "
        "after moderation review."
    )
    try:
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=True,
        )
    except Exception:
        logger.warning(
            "Failed to send moderation email to %s", user.email, exc_info=True
        )


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


def _venue_review_summary(venue):
    return {
        "id": venue.id,
        "name": venue.name,
        "streetAddress": venue.street_address,
        "borough": venue.borough,
        "priceRange": venue.price_range,
        "cuisineType": venue.cuisine_type.name if venue.cuisine_type else "",
    }


def _review_comment_to_json(comment):
    author = comment.user
    return {
        "id": comment.id,
        "content": comment.content,
        "isManagerResponse": comment.is_manager_response,
        "isFlagged": comment.is_flagged,
        "isVisible": comment.is_visible,
        "createdAt": comment.created_at.isoformat(),
        "updatedAt": comment.updated_at.isoformat(),
        "author": {
            "id": author.id,
            "email": author.email,
            "name": _safe_display_name(author),
            "role": author.role,
        },
    }


def _review_to_json(review, include_hidden=False):
    comments = review.comments.all()
    if not include_hidden:
        comments = comments.filter(is_visible=True)
    comments = comments.order_by("created_at")

    return {
        "id": review.id,
        "venueId": review.venue_id,
        "rating": review.rating,
        "title": review.title,
        "content": review.content,
        "visitDate": review.visit_date.isoformat(),
        "additionalPhotos": list(review.additional_photos or []),
        "isFlagged": review.is_flagged,
        "isVisible": review.is_visible,
        "createdAt": review.created_at.isoformat(),
        "updatedAt": review.updated_at.isoformat(),
        "author": {
            "id": review.user.id,
            "email": review.user.email,
            "name": _safe_display_name(review.user),
            "role": review.user.role,
        },
        "comments": [_review_comment_to_json(comment) for comment in comments],
    }


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

    claims_qs = (
        VenueClaim.objects.filter(manager=manager)
        .select_related("venue")
        .order_by("-created_at")
    )
    claims_data = []
    for claim in claims_qs:
        claims_data.append(
            {
                "id": claim.id,
                "status": claim.status,
                "note": claim.note,
                "adminNote": claim.admin_note,
                "createdAt": claim.created_at.isoformat(),
                "reviewedAt": (
                    claim.reviewed_at.isoformat() if claim.reviewed_at else None
                ),
                "venue": {
                    "id": claim.venue.id,
                    "name": claim.venue.name,
                    "streetAddress": claim.venue.street_address,
                    "borough": claim.venue.borough,
                },
            }
        )

    return JsonResponse(
        {"venues": [_venue_to_json(v) for v in venues], "claims": claims_data}
    )


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


def api_venue_reviews(request, venue_id):
    """
    GET  /api/venues/<id>/reviews/  — list visible reviews, or all reviews for the
                                       venue manager who owns the venue
    POST /api/venues/<id>/reviews/  — create a new review
    """
    try:
        venue = (
            Venue.objects.select_related(
                "cuisine_type", "managed_by", "managed_by__user"
            )
            .prefetch_related(
                Prefetch(
                    "reviews",
                    queryset=Review.objects.select_related("user").prefetch_related(
                        Prefetch(
                            "comments",
                            queryset=ReviewComment.objects.select_related(
                                "user"
                            ).order_by("created_at"),
                        )
                    ),
                )
            )
            .get(pk=venue_id, is_active=True)
        )
    except Venue.DoesNotExist:
        return JsonResponse({"error": "Venue not found"}, status=404)

    is_owner_manager = (
        request.user.is_authenticated
        and request.user.role == "venue_manager"
        and venue.managed_by is not None
        and venue.managed_by.user_id == request.user.id
    )

    if request.method == "GET":
        reviews = venue.reviews.all().order_by("-created_at")
        if not is_owner_manager:
            reviews = reviews.filter(is_visible=True)
        return JsonResponse(
            {
                "success": True,
                "venue": _venue_review_summary(venue),
                "canReply": is_owner_manager,
                "reviews": [
                    _review_to_json(review, include_hidden=is_owner_manager)
                    for review in reviews
                ],
            }
        )

    if request.method == "POST":
        if not request.user.is_authenticated:
            return JsonResponse({"error": "Authentication required"}, status=401)
        if request.user.role != "student":
            return JsonResponse({"error": "Student access required"}, status=403)

        try:
            data = json.loads(request.body or "{}")
        except (json.JSONDecodeError, TypeError):
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        try:
            rating = int(data.get("rating"))
        except (TypeError, ValueError):
            return JsonResponse({"error": "Rating is required"}, status=400)
        if rating < 1 or rating > 5:
            return JsonResponse({"error": "Rating must be between 1 and 5"}, status=400)

        visit_date_raw = (data.get("visitDate") or "").strip()
        try:
            visit_date = date.fromisoformat(visit_date_raw)
        except ValueError:
            return JsonResponse({"error": "Valid visitDate is required"}, status=400)

        additional_photos = data.get("additionalPhotos") or []
        if not isinstance(additional_photos, list):
            return JsonResponse(
                {"error": "additionalPhotos must be a list"}, status=400
            )
        clean_photos = [
            photo.strip()
            for photo in additional_photos
            if isinstance(photo, str) and photo.strip()
        ]
        if len(clean_photos) > 5:
            return JsonResponse(
                {"error": "At most 5 additional photos are allowed"}, status=400
            )

        review = Review.objects.create(
            venue=venue,
            user=request.user,
            rating=rating,
            title=(data.get("title") or "").strip(),
            content=(data.get("content") or "").strip(),
            visit_date=visit_date,
            additional_photos=clean_photos,
        )
        return JsonResponse(
            {
                "success": True,
                "review": _review_to_json(review, include_hidden=True),
            },
            status=201,
        )

    return JsonResponse({"error": "Method not allowed"}, status=405)


def api_venue_review_comment(request, venue_id, review_id):
    """
    POST /api/venues/<venue_id>/reviews/<review_id>/comments/
    Venue managers can add owner responses to reviews they own.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    manager, err = _require_venue_manager(request)
    if err:
        return err

    try:
        venue = Venue.objects.select_related("managed_by", "managed_by__user").get(
            pk=venue_id, is_active=True
        )
    except Venue.DoesNotExist:
        return JsonResponse({"error": "Venue not found"}, status=404)

    if venue.managed_by_id != manager.id:
        return JsonResponse({"error": "You do not manage this venue"}, status=403)

    try:
        review = Review.objects.select_related("venue", "user").get(
            pk=review_id, venue=venue
        )
    except Review.DoesNotExist:
        return JsonResponse({"error": "Review not found"}, status=404)

    try:
        data = json.loads(request.body or "{}")
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    content = (data.get("content") or "").strip()
    if not content:
        return JsonResponse({"error": "Comment content is required"}, status=400)

    comment = ReviewComment.objects.create(
        review=review,
        user=request.user,
        content=content,
        is_manager_response=True,
    )
    return JsonResponse(
        {
            "success": True,
            "comment": _review_comment_to_json(comment),
        },
        status=201,
    )


# ---------------------------------------------------------------------------
# Content Moderation API
# ---------------------------------------------------------------------------


def _content_report_to_json(report):
    if report.review_id:
        target = report.review
        content_type = "review"
        content_body = target.content
        venue_name = target.venue.name
        author = target.user
    else:
        target = report.comment
        content_type = "comment"
        content_body = target.content
        venue_name = target.review.venue.name
        author = target.user

    reviewer = report.reviewed_by
    return {
        "id": report.id,
        "status": report.status,
        "reason": report.reason,
        "createdAt": report.created_at.isoformat(),
        "reviewedAt": report.reviewed_at.isoformat() if report.reviewed_at else None,
        "contentType": content_type,
        "content": {
            "id": target.id,
            "title": getattr(target, "title", ""),
            "body": content_body,
            "venueName": venue_name,
            "authorEmail": author.email,
            "authorName": _safe_display_name(author),
        },
        "reporter": {
            "id": report.reporter_id,
            "email": report.reporter.email,
            "name": _safe_display_name(report.reporter),
        },
        "reviewer": (
            {
                "id": reviewer.id,
                "email": reviewer.email,
                "name": _safe_display_name(reviewer),
            }
            if reviewer
            else None
        ),
    }


def api_report_review(request, review_id):
    """POST /api/venues/reviews/<review_id>/report/"""
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)
    try:
        review = Review.objects.select_related("user", "venue").get(pk=review_id)
    except Review.DoesNotExist:
        return JsonResponse({"error": "Review not found"}, status=404)

    try:
        data = json.loads(request.body or "{}")
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    reason = (data.get("reason") or "").strip()
    if not reason:
        return JsonResponse({"error": "Report reason is required"}, status=400)

    report = ContentReport.objects.create(
        review=review,
        reporter=request.user,
        reason=reason,
    )
    if not review.is_flagged:
        review.is_flagged = True
        review.save(update_fields=["is_flagged", "updated_at"])
    return JsonResponse(
        {"success": True, "report": _content_report_to_json(report)}, status=201
    )


def api_report_review_comment(request, comment_id):
    """POST /api/venues/review-comments/<comment_id>/report/"""
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)
    try:
        comment = ReviewComment.objects.select_related("user", "review__venue").get(
            pk=comment_id
        )
    except ReviewComment.DoesNotExist:
        return JsonResponse({"error": "Comment not found"}, status=404)

    try:
        data = json.loads(request.body or "{}")
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    reason = (data.get("reason") or "").strip()
    if not reason:
        return JsonResponse({"error": "Report reason is required"}, status=400)

    report = ContentReport.objects.create(
        comment=comment,
        reporter=request.user,
        reason=reason,
    )
    if not comment.is_flagged:
        comment.is_flagged = True
        comment.save(update_fields=["is_flagged", "updated_at"])
    return JsonResponse(
        {"success": True, "report": _content_report_to_json(report)}, status=201
    )


def api_admin_moderation_queue(request):
    """GET /api/venues/admin/moderation/?status=pending&page=1"""
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    err = _require_admin(request)
    if err:
        return err

    status_filter = (request.GET.get("status") or "pending").strip()
    page = int(request.GET.get("page", 1))
    per_page = 20

    reports_qs = ContentReport.objects.select_related(
        "reporter",
        "reviewed_by",
        "review__user",
        "review__venue",
        "comment__user",
        "comment__review__venue",
    ).order_by("-created_at")

    if status_filter in dict(ContentReport.Status.choices):
        reports_qs = reports_qs.filter(status=status_filter)

    total = reports_qs.count()
    total_pages = max(1, math.ceil(total / per_page))
    page = min(page, total_pages)
    offset = (page - 1) * per_page
    reports_page = reports_qs[offset : offset + per_page]

    return JsonResponse(
        {
            "success": True,
            "reports": [_content_report_to_json(report) for report in reports_page],
            "page": page,
            "totalPages": total_pages,
            "totalCount": total,
        }
    )


def api_admin_moderation_action(request, report_id):
    """POST /api/venues/admin/moderation/<id>/ with action=confirm|reject."""
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    err = _require_admin(request)
    if err:
        return err

    try:
        report = ContentReport.objects.select_related(
            "review__user",
            "review__venue",
            "comment__user",
            "comment__review__venue",
            "reporter",
        ).get(pk=report_id)
    except ContentReport.DoesNotExist:
        return JsonResponse({"error": "Report not found"}, status=404)

    try:
        data = json.loads(request.body or "{}")
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    action = (data.get("action") or "").strip().lower()
    if action not in ("confirm", "reject"):
        return JsonResponse(
            {"error": "action must be 'confirm' or 'reject'"}, status=400
        )

    with transaction.atomic():
        report.reviewed_by = request.user
        report.reviewed_at = timezone.now()
        if action == "confirm":
            report.status = ContentReport.Status.CONFIRMED
            if report.review_id:
                report.review.is_visible = False
                report.review.is_flagged = True
                report.review.save(
                    update_fields=["is_visible", "is_flagged", "updated_at"]
                )
                _notify_content_removed(
                    report.review.user, report.review.venue.name, "review"
                )
            else:
                report.comment.is_visible = False
                report.comment.is_flagged = True
                report.comment.save(
                    update_fields=["is_visible", "is_flagged", "updated_at"]
                )
                _notify_content_removed(
                    report.comment.user, report.comment.review.venue.name, "comment"
                )
        else:
            report.status = ContentReport.Status.REJECTED
            if report.review_id:
                report.review.is_visible = True
                report.review.is_flagged = False
                report.review.save(
                    update_fields=["is_visible", "is_flagged", "updated_at"]
                )
            else:
                report.comment.is_visible = True
                report.comment.is_flagged = False
                report.comment.save(
                    update_fields=["is_visible", "is_flagged", "updated_at"]
                )

        report.save(
            update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"]
        )

    return JsonResponse({"success": True, "report": _content_report_to_json(report)})


# ---------------------------------------------------------------------------
# Admin Venue Verification API
# ---------------------------------------------------------------------------


def _require_admin(request):
    """Returns None or an error JsonResponse."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)
    if request.user.role != "admin":
        return JsonResponse({"error": "Admin access required"}, status=403)
    return None


def api_admin_venue_claims(request):
    """
    GET /api/venues/admin/claims/?status=pending&page=1
    Returns paginated venue claims for admin review.
    """
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    err = _require_admin(request)
    if err:
        return err

    status_filter = request.GET.get("status", "").strip()
    page = int(request.GET.get("page", 1))
    per_page = 20

    claims_qs = VenueClaim.objects.select_related(
        "venue",
        "venue__cuisine_type",
        "manager",
        "manager__user",
    ).order_by("-created_at")

    if status_filter and status_filter in dict(VenueClaim.Status.choices):
        claims_qs = claims_qs.filter(status=status_filter)

    total = claims_qs.count()
    total_pages = max(1, math.ceil(total / per_page))
    page = min(page, total_pages)
    offset = (page - 1) * per_page
    claims_page = claims_qs[offset : offset + per_page]

    results = []
    for claim in claims_page:
        venue = claim.venue
        manager = claim.manager
        user = manager.user if manager else None
        results.append(
            {
                "id": claim.id,
                "status": claim.status,
                "note": claim.note,
                "adminNote": claim.admin_note,
                "createdAt": claim.created_at.isoformat(),
                "reviewedAt": (
                    claim.reviewed_at.isoformat() if claim.reviewed_at else None
                ),
                "venue": {
                    "id": venue.id,
                    "name": venue.name,
                    "streetAddress": venue.street_address,
                    "borough": venue.borough,
                    "neighborhood": venue.neighborhood,
                    "cuisineType": (
                        venue.cuisine_type.name if venue.cuisine_type else ""
                    ),
                },
                "manager": {
                    "id": manager.id if manager else None,
                    "businessName": manager.business_name if manager else "",
                    "businessEmail": manager.business_email if manager else "",
                    "userName": (
                        f"{user.first_name} {user.last_name}".strip() if user else ""
                    ),
                    "userEmail": user.email if user else "",
                },
            }
        )

    return JsonResponse(
        {
            "success": True,
            "claims": results,
            "page": page,
            "totalPages": total_pages,
            "totalCount": total,
        }
    )


def api_admin_venue_claim_action(request, claim_id):
    """
    POST /api/venues/admin/claims/<claim_id>/
    Body: { "action": "approve" | "reject", "adminNote": "..." }
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    err = _require_admin(request)
    if err:
        return err

    try:
        claim = VenueClaim.objects.select_related("venue", "manager").get(pk=claim_id)
    except VenueClaim.DoesNotExist:
        return JsonResponse({"error": "Claim not found"}, status=404)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    action = (data.get("action") or "").strip().lower()
    admin_note = (data.get("adminNote") or "").strip()

    if action not in ("approve", "reject"):
        return JsonResponse(
            {"error": "action must be 'approve' or 'reject'"}, status=400
        )

    with transaction.atomic():
        if action == "approve":
            claim.status = VenueClaim.Status.APPROVED
            claim.admin_note = admin_note
            claim.reviewed_at = timezone.now()
            claim.save(update_fields=["status", "admin_note", "reviewed_at"])
            # Mark venue as verified
            claim.venue.is_verified = True
            claim.venue.save(update_fields=["is_verified", "updated_at"])
        else:
            claim.status = VenueClaim.Status.REJECTED
            claim.admin_note = admin_note
            claim.reviewed_at = timezone.now()
            claim.save(update_fields=["status", "admin_note", "reviewed_at"])
            # Remove manager from venue on rejection
            claim.venue.managed_by = None
            claim.venue.is_verified = False
            claim.venue.save(update_fields=["managed_by", "is_verified", "updated_at"])

    return JsonResponse(
        {
            "success": True,
            "claim": {
                "id": claim.id,
                "status": claim.status,
                "reviewedAt": claim.reviewed_at.isoformat(),
            },
        }
    )


# ---------------------------------------------------------------------------
# Admin Venue Management API
# ---------------------------------------------------------------------------


def _admin_venue_to_json(venue):
    """Full venue serialization for admin editing."""
    latest_inspection = venue.inspections.first()
    manager = venue.managed_by
    manager_user = manager.user if manager else None
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
        "cuisineTypeId": venue.cuisine_type_id,
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
        "foodTypeTags": list(venue.food_type_tags.values_list("name", flat=True)),
        "lastInspectionDate": (
            latest_inspection.inspection_date.isoformat()
            if latest_inspection and latest_inspection.inspection_date
            else None
        ),
        "lastInspectionGrade": latest_inspection.grade if latest_inspection else "",
        "lastInspectionScore": latest_inspection.score if latest_inspection else None,
        "isClaimed": venue.managed_by is not None,
        "manager": (
            {
                "id": manager.id if manager else None,
                "businessName": manager.business_name if manager else "",
                "userName": (
                    f"{manager_user.first_name} {manager_user.last_name}".strip()
                    if manager_user
                    else ""
                ),
                "userEmail": manager_user.email if manager_user else "",
            }
            if manager
            else None
        ),
    }


def api_admin_venue_options(request):
    """
    GET /api/venues/admin/options/
    Returns all available cuisine types, dietary tags, and food type tags.
    """
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    err = _require_admin(request)
    if err:
        return err

    return JsonResponse(
        {
            "cuisineTypes": list(
                CuisineType.objects.order_by("name").values("id", "name")
            ),
            "dietaryTags": list(
                DietaryTag.objects.order_by("name").values_list("name", flat=True)
            ),
            "foodTypeTags": list(
                FoodTypeTag.objects.order_by("name").values_list("name", flat=True)
            ),
        }
    )


def api_admin_venues(request):
    """
    GET /api/venues/admin/venues/?q=&borough=&page=1
    Returns paginated venues for admin management.
    """
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    err = _require_admin(request)
    if err:
        return err

    q = request.GET.get("q", "").strip()
    borough = request.GET.get("borough", "").strip()
    page = int(request.GET.get("page", 1))
    per_page = 20

    venues_qs = Venue.objects.select_related(
        "cuisine_type", "managed_by", "managed_by__user"
    ).order_by("name")

    if q:
        venues_qs = venues_qs.filter(name__icontains=q)
    if borough:
        venues_qs = venues_qs.filter(borough=borough)

    total = venues_qs.count()
    total_pages = max(1, math.ceil(total / per_page))
    page = min(page, total_pages)
    offset = (page - 1) * per_page
    venues_page = venues_qs[offset : offset + per_page]

    results = []
    for v in venues_page:
        results.append(
            {
                "id": v.id,
                "name": v.name,
                "streetAddress": v.street_address,
                "borough": v.borough,
                "neighborhood": v.neighborhood,
                "cuisineType": v.cuisine_type.name if v.cuisine_type else "",
                "priceRange": v.price_range,
                "sanitationGrade": v.sanitation_grade,
                "isVerified": v.is_verified,
                "isActive": v.is_active,
                "isClaimed": v.managed_by is not None,
            }
        )

    return JsonResponse(
        {
            "success": True,
            "venues": results,
            "page": page,
            "totalPages": total_pages,
            "totalCount": total,
        }
    )


def api_admin_venue_detail(request, venue_id):
    """
    GET   /api/venues/admin/venues/<id>/  — full venue detail
    PATCH /api/venues/admin/venues/<id>/  — update venue fields
    """
    err = _require_admin(request)
    if err:
        return err

    try:
        venue = (
            Venue.objects.select_related(
                "cuisine_type", "managed_by", "managed_by__user"
            )
            .prefetch_related("dietary_tags", "food_type_tags", "inspections")
            .get(pk=venue_id)
        )
    except Venue.DoesNotExist:
        return JsonResponse({"error": "Venue not found"}, status=404)

    if request.method == "GET":
        return JsonResponse({"venue": _admin_venue_to_json(venue)})

    if request.method == "PATCH":
        try:
            data = json.loads(request.body)
        except (json.JSONDecodeError, TypeError):
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        fields_updated = []

        # Text / scalar fields
        field_map = {
            "name": "name",
            "streetAddress": "street_address",
            "borough": "borough",
            "neighborhood": "neighborhood",
            "zipcode": "zipcode",
            "phone": "phone",
            "email": "email",
            "website": "website",
            "priceRange": "price_range",
            "sanitationGrade": "sanitation_grade",
        }
        for js_key, db_key in field_map.items():
            if js_key in data:
                setattr(venue, db_key, (data[js_key] or "").strip())
                fields_updated.append(db_key)

        # Integer fields
        if "seatingCapacity" in data:
            val = data["seatingCapacity"]
            venue.seating_capacity = int(val) if val else None
            fields_updated.append("seating_capacity")

        # Boolean fields
        bool_map = {
            "hasGroupSeating": "has_group_seating",
            "hasTakeout": "has_takeout",
            "hasDelivery": "has_delivery",
            "hasDineIn": "has_dine_in",
            "isReservable": "is_reservable",
            "isVerified": "is_verified",
            "isActive": "is_active",
        }
        for js_key, db_key in bool_map.items():
            if js_key in data:
                val = data[js_key]
                if not isinstance(val, bool):
                    return JsonResponse(
                        {"error": f"'{js_key}' must be a boolean"}, status=400
                    )
                setattr(venue, db_key, val)
                fields_updated.append(db_key)

        # Cuisine type (FK by name)
        if "cuisineType" in data:
            ct_name = (data["cuisineType"] or "").strip()
            if ct_name:
                ct, _ = CuisineType.objects.get_or_create(name=ct_name)
                venue.cuisine_type = ct
            else:
                venue.cuisine_type = None
            fields_updated.append("cuisine_type_id")

        # Remove venue manager
        if data.get("removeManager"):
            venue.managed_by = None
            venue.is_verified = False
            if "managed_by_id" not in fields_updated:
                fields_updated.append("managed_by_id")
            if "is_verified" not in fields_updated:
                fields_updated.append("is_verified")
            # Also reject any pending claims for this venue
            VenueClaim.objects.filter(
                venue=venue, status=VenueClaim.Status.PENDING
            ).update(
                status=VenueClaim.Status.REJECTED,
                admin_note="Manager removed by admin",
                reviewed_at=timezone.now(),
            )
            # Mark approved claims as rejected too
            VenueClaim.objects.filter(
                venue=venue, status=VenueClaim.Status.APPROVED
            ).update(
                status=VenueClaim.Status.REJECTED,
                admin_note="Manager removed by admin",
                reviewed_at=timezone.now(),
            )

        if fields_updated:
            fields_updated.append("updated_at")
            venue.save(update_fields=fields_updated)

        # M2M: dietary tags
        if "dietaryTags" in data:
            tag_names = data["dietaryTags"] or []
            tags = []
            for name in tag_names:
                if not isinstance(name, str) or not name.strip():
                    continue
                tag, _ = DietaryTag.objects.get_or_create(name=name.strip())
                tags.append(tag)
            venue.dietary_tags.set(tags)

        # M2M: food type tags
        if "foodTypeTags" in data:
            tag_names = data["foodTypeTags"] or []
            tags = []
            for name in tag_names:
                if not isinstance(name, str) or not name.strip():
                    continue
                tag, _ = FoodTypeTag.objects.get_or_create(name=name.strip())
                tags.append(tag)
            venue.food_type_tags.set(tags)

        venue.refresh_from_db()
        return JsonResponse({"success": True, "venue": _admin_venue_to_json(venue)})

    return JsonResponse({"error": "Method not allowed"}, status=405)


# ---------------------------------------------------------------------------
# Preference preview API
# ---------------------------------------------------------------------------


def _resolve_cuisine_ids(names):
    if not names:
        return set()
    clean = [n.strip() for n in names if isinstance(n, str) and n.strip()]
    if not clean:
        return set()
    return set(CuisineType.objects.filter(name__in=clean).values_list("id", flat=True))


def api_venue_preview(request):
    """
    POST /api/venues/preview/

    Returns the count and (optionally) a page of venues matching the supplied
    filters. Used by the preference-preview UI in registration and the
    individual preferences page so users can see how many restaurants their
    current selection will yield in a swipe session.

    Body:
        cuisines: list[str]
        minimumSanitationGrade: str  ("A"|"B"|...)
        priceRange: str              ("$"|"$$"|...)
        borough, neighborhood: str   (optional)
        limit: int = 20
        offset: int = 0
        countOnly: bool              (skip list, return count only)
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        data = json.loads(request.body or "{}")
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    cuisine_ids = _resolve_cuisine_ids(data.get("cuisines") or [])
    # If user picked cuisines none of which exist in the DB, there are zero
    # matches — short-circuit to avoid returning everything.
    cuisines_input = [
        c for c in (data.get("cuisines") or []) if isinstance(c, str) and c.strip()
    ]
    if cuisines_input and not cuisine_ids:
        return JsonResponse({"success": True, "count": 0, "venues": []})

    min_grade = data.get("minimumSanitationGrade") or None
    price_range = data.get("priceRange") or ""
    borough = (data.get("borough") or "").strip() or None
    neighborhood = (data.get("neighborhood") or "").strip() or None
    dietary_tag_names = [
        d for d in (data.get("dietary") or []) if isinstance(d, str) and d.strip()
    ]
    food_type_tag_names = [
        f for f in (data.get("foodTypes") or []) if isinstance(f, str) and f.strip()
    ]

    qs = filter_venues_by_preferences(
        cuisine_ids=cuisine_ids,
        min_grade=min_grade,
        price_range=price_range or None,
        borough=borough,
        neighborhood=neighborhood,
        dietary_tag_names=dietary_tag_names or None,
        food_type_tag_names=food_type_tag_names or None,
        require_photos=False,
    )

    count = qs.count()

    if data.get("countOnly"):
        return JsonResponse({"success": True, "count": count, "venues": []})

    try:
        limit = int(data.get("limit", 20))
    except (TypeError, ValueError):
        limit = 20
    try:
        offset = int(data.get("offset", 0))
    except (TypeError, ValueError):
        offset = 0
    limit = max(1, min(limit, 50))
    offset = max(0, offset)

    from groups.views import (
        _venue_to_swipe_json,
    )  # avoid circular import at module load

    venues_qs = (
        qs.select_related("cuisine_type")
        .prefetch_related(
            "photos", "dietary_tags", "food_type_tags", "inspections", "discounts"
        )
        .order_by(F("google_rating").desc(nulls_last=True))[offset : offset + limit]
    )

    venues_list = list(venues_qs)
    venues_data = [_venue_to_swipe_json(v) for v in venues_list]
    return JsonResponse({"success": True, "count": count, "venues": venues_data})


def api_venue_preview_detail(request, venue_id):
    """
    GET /api/venues/<id>/preview-detail/

    Returns a single venue serialized in the swipe-card shape, lazily
    fetching its Google Places photo if not yet cached. Called when the user
    selects a restaurant from the preview list.
    """
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        venue = (
            Venue.objects.select_related("cuisine_type")
            .prefetch_related(
                "photos",
                "dietary_tags",
                "food_type_tags",
                "inspections",
                "discounts",
            )
            .get(pk=venue_id, is_active=True)
        )
    except Venue.DoesNotExist:
        return JsonResponse({"error": "Venue not found"}, status=404)

    bulk_prefetch_photos([venue])
    getattr(venue, "_prefetched_objects_cache", {}).pop("photos", None)
    prefetch_related_objects([venue], "photos")

    from groups.views import _venue_to_swipe_json

    return JsonResponse({"success": True, "venue": _venue_to_swipe_json(venue)})
