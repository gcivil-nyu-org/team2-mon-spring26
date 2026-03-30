from django.urls import path
from . import views

urlpatterns = [
    path("", views.api_groups_list_create, name="api_groups_list_create"),
    path("<int:group_id>/", views.api_edit_group, name="api_edit_group"),
    # Delete requires its own distinct view although we could combine them
    path("<int:group_id>/delete/", views.api_delete_group, name="api_delete_group"),
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
    # Constraints
    path(
        "<int:group_id>/constraints/",
        views.api_update_group_constraints,
        name="api_update_group_constraints",
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
]
