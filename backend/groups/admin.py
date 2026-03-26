from django.contrib import admin
from .models import Group, GroupMembership


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
