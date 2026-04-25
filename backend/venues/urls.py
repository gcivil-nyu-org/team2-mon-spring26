from django.urls import path
from . import views

urlpatterns = [
    path("search/", views.api_venue_search, name="venue_search"),
    path("my-venues/", views.api_my_venues, name="venue_my_venues"),
    path("preview/", views.api_venue_preview, name="venue_preview"),
    path(
        "<int:venue_id>/preview-detail/",
        views.api_venue_preview_detail,
        name="venue_preview_detail",
    ),
    path("<int:venue_id>/", views.api_venue_detail, name="venue_detail"),
    path("<int:venue_id>/claim/", views.api_venue_claim, name="venue_claim"),
    path(
        "<int:venue_id>/discounts/", views.api_venue_discounts, name="venue_discounts"
    ),
    path(
        "<int:venue_id>/discounts/<int:discount_id>/",
        views.api_venue_discount_detail,
        name="venue_discount_detail",
    ),
    path("reviews/<int:review_id>/report/", views.api_report_review, name="report_review"),
    path(
        "review-comments/<int:comment_id>/report/",
        views.api_report_review_comment,
        name="report_review_comment",
    ),
    # Admin venue verification
    path(
        "admin/moderation/",
        views.api_admin_moderation_queue,
        name="admin_moderation_queue",
    ),
    path(
        "admin/moderation/<int:report_id>/",
        views.api_admin_moderation_action,
        name="admin_moderation_action",
    ),
    path("admin/claims/", views.api_admin_venue_claims, name="admin_venue_claims"),
    path(
        "admin/claims/<int:claim_id>/",
        views.api_admin_venue_claim_action,
        name="admin_venue_claim_action",
    ),
    # Admin venue management
    path("admin/options/", views.api_admin_venue_options, name="admin_venue_options"),
    path("admin/venues/", views.api_admin_venues, name="admin_venues"),
    path(
        "admin/venues/<int:venue_id>/",
        views.api_admin_venue_detail,
        name="admin_venue_detail",
    ),
]
