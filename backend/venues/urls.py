# api endpoints for venues - need for venue search
from django.urls import path
from . import views

urlpatterns = [
    path("search/", views.api_venue_search, name="api_venue_search"),
    path("claim/", views.api_venue_claim, name="api_venue_claim"),
    path("my-venues/", views.api_manager_venues, name="api_manager_venues"),
    path("<int:venue_id>/unclaim/", views.api_venue_unclaim, name="api_venue_unclaim"),
    path(
        "<int:venue_id>/discount/",
        views.api_venue_update_discount,
        name="api_venue_update_discount",
    ),
]
