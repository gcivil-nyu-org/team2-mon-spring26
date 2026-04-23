from django.urls import path
from . import views

urlpatterns = [
    path("register/", views.api_register, name="api_register"),
    path(
        "admin/users/",
        views.api_admin_users_list,
        name="api_admin_users_list",
    ),
    path(
        "admin/users/<int:user_id>/",
        views.api_admin_user_detail,
        name="api_admin_user_detail",
    ),
    path("venue-register/", views.api_venue_register, name="api_venue_register"),
    path("admin-register/", views.api_admin_register, name="api_admin_register"),
    path("login/", views.api_login, name="api_login"),
    path("admin-login/", views.api_admin_login, name="api_admin_login"),
    path("logout/", views.api_logout, name="api_logout"),
    path("me/", views.api_me, name="api_me"),
    path("profile/", views.api_update_profile, name="api_update_profile"),
    path("profile/photo/", views.api_upload_profile_photo, name="api_upload_profile_photo"),
    path("preferences/", views.api_preferences_update, name="api_preferences_update"),
    path(
        "request-password-reset/",
        views.api_request_password_reset,
        name="api_request_password_reset",
    ),
    path(
        "admin-request-password-reset/",
        views.api_request_admin_password_reset,
        name="api_request_admin_password_reset",
    ),
    path(
        "validate-password-reset-token/",
        views.api_validate_password_reset_token,
        name="api_validate_password_reset_token",
    ),
    path(
        "confirm-password-reset/",
        views.api_confirm_password_reset,
        name="api_confirm_password_reset",
    ),
]
