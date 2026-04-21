from django.urls import path
from . import views

urlpatterns = [
    path("", views.api_groups_list_create, name="api_groups_list_create"),
    path("public/", views.api_public_groups_list, name="api_public_groups_list"),
    path(
        "join/<str:join_code>/",
        views.api_join_group_by_code,
        name="api_join_group_by_code",
    ),
    path(
        "<int:group_id>/regenerate-code/",
        views.api_regenerate_join_code,
        name="api_regenerate_join_code",
    ),
    path("<int:group_id>/", views.api_edit_group, name="api_edit_group"),
    # Delete requires its own distinct view although we could combine them
    path("<int:group_id>/delete/", views.api_delete_group, name="api_delete_group"),
    # Invitations
    path("invitations/", views.api_invitations_list, name="api_invitations_list"),
    path(
        "invitations/<int:invitation_id>/<str:action>/",
        views.api_invitation_action,
        name="api_invitation_action",
    ),
    path(
        "swipe-notifications/<int:notification_id>/read/",
        views.api_mark_swipe_notification_read,
        name="api_mark_swipe_notification_read",
    ),
    # Users
    path("users/", views.api_list_users, name="api_list_users"),
    # Members
    path(
        "<int:group_id>/invite/", views.api_invite_to_group, name="api_invite_to_group"
    ),
    path(
        "<int:group_id>/members/<int:user_id>/",
        views.api_remove_from_group,
        name="api_remove_from_group",
    ),
    # Roles
    path(
        "<int:group_id>/members/<int:user_id>/role/",
        views.api_make_leader,
        name="api_make_leader",
    ),
    # Constraints — derived view-only from member preferences
    path(
        "<int:group_id>/effective-constraints/",
        views.api_group_effective_constraints,
        name="api_group_effective_constraints",
    ),
    path(
        "<int:group_id>/preview-venues/",
        views.api_group_preview_venues,
        name="api_group_preview_venues",
    ),
    path("<int:group_id>/leave/", views.api_leave_group, name="api_leave_group"),
    # Swipe Events
    path(
        "<int:group_id>/events/",
        views.api_swipe_events,
        name="api_swipe_events",
    ),
    path(
        "<int:group_id>/events/<int:event_id>/venues/",
        views.api_swipe_event_venues,
        name="api_swipe_event_venues",
    ),
    path(
        "<int:group_id>/events/<int:event_id>/swipes/",
        views.api_submit_swipe,
        name="api_submit_swipe",
    ),
    path(
        "<int:group_id>/events/<int:event_id>/results/",
        views.api_swipe_event_results,
        name="api_swipe_event_results",
    ),
    path(
        "<int:group_id>/events/<int:event_id>/finish/",
        views.api_finish_swiping,
        name="api_finish_swiping",
    ),
    path(
        "<int:group_id>/events/<int:event_id>/my-swipes/",
        views.api_my_swipes,
        name="api_my_swipes",
    ),
    path(
        "<int:group_id>/events/<int:event_id>/reswipe/",
        views.api_reswipe,
        name="api_reswipe",
    ),
]
