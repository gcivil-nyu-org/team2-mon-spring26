from django.contrib import admin
from .models import (
    Venue,
    Inspection,
    StudentDiscount,
    VenuePhoto,
    VenueTidbit,
    Review,
    ReviewComment,
)


@admin.register(Venue)
class VenueAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "borough",
        "cuisine_type",
        "sanitation_grade",
        "is_verified",
        "is_active",
    )
    search_fields = ("name", "street_address", "borough")
    list_filter = (
        "is_verified",
        "is_active",
        "borough",
        "price_range",
        "sanitation_grade",
    )


@admin.register(Inspection)
class InspectionAdmin(admin.ModelAdmin):
    list_display = ("venue", "inspection_date", "grade", "score", "critical_flag")
    list_filter = ("grade", "critical_flag")
    search_fields = ("venue__name",)


@admin.register(StudentDiscount)
class StudentDiscountAdmin(admin.ModelAdmin):
    list_display = (
        "venue",
        "discount_type",
        "discount_value",
        "is_active",
        "valid_from",
        "valid_until",
    )
    list_filter = ("is_active", "requires_nyu_id")
    search_fields = ("venue__name",)


@admin.register(VenuePhoto)
class VenuePhotoAdmin(admin.ModelAdmin):
    list_display = ("venue", "source", "is_primary", "uploaded_by")
    list_filter = ("is_primary", "source")
    search_fields = ("venue__name",)


@admin.register(VenueTidbit)
class VenueTidbitAdmin(admin.ModelAdmin):
    list_display = ("venue", "added_by", "is_verified", "created_at")
    list_filter = ("is_verified",)
    search_fields = ("venue__name", "content")


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("venue", "user", "rating", "visit_date", "is_flagged", "is_visible")
    list_filter = ("rating", "is_flagged", "is_visible")
    search_fields = ("venue__name", "user__email")


@admin.register(ReviewComment)
class ReviewCommentAdmin(admin.ModelAdmin):
    list_display = ("review", "user", "is_manager_response", "is_flagged", "is_visible")
    list_filter = ("is_manager_response", "is_flagged", "is_visible")
    search_fields = ("user__email",)
