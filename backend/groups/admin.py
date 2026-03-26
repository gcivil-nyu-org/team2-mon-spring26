from django.contrib import admin
from .models import Group, GroupMembership, SwipeEvent, Swipe


class GroupMembershipInline(admin.TabularInline):
    model = GroupMembership
    extra = 1
    autocomplete_fields = ["user"]


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("name", "group_type", "privacy", "created_by", "created_at")
    list_filter = ("group_type", "privacy")
    search_fields = ("name", "description")
    inlines = [GroupMembershipInline]
    autocomplete_fields = ["created_by"]


@admin.register(GroupMembership)
class GroupMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "group", "role", "join_date")
    list_filter = ("role",)
    search_fields = ("user__email", "group__name")
    autocomplete_fields = ["user", "group"]


class SwipeInline(admin.TabularInline):
    model = Swipe
    extra = 0
    autocomplete_fields = ["user", "venue"]


@admin.register(SwipeEvent)
class SwipeEventAdmin(admin.ModelAdmin):
    list_display = ("name", "group", "status", "created_by", "created_at")
    list_filter = ("status",)
    search_fields = ("name", "group__name")
    inlines = [SwipeInline]
    autocomplete_fields = ["group", "created_by", "matched_venue"]


@admin.register(Swipe)
class SwipeAdmin(admin.ModelAdmin):
    list_display = ("user", "event", "venue", "direction", "created_at")
    list_filter = ("direction",)
    search_fields = ("user__email", "venue__name")
