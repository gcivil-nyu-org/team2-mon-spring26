from django.urls import path
from . import views

urlpatterns = [
    path("register/", views.api_register, name="api_register"),
    path("login/", views.api_login, name="api_login"),
    path("logout/", views.api_logout, name="api_logout"),
    path("me/", views.api_me, name="api_me"),
    path("preferences/", views.api_preferences_update, name="api_preferences_update"),
    path(
        "request-password-reset/",
        views.api_request_password_reset,
        name="api_request_password_reset",
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
