from django.urls import path
from . import views

urlpatterns = [
    path("search/",                                      views.api_venue_search,          name="venue_search"),
    path("my-venues/",                                   views.api_my_venues,             name="venue_my_venues"),
    path("<int:venue_id>/",                              views.api_venue_detail,          name="venue_detail"),
    path("<int:venue_id>/claim/",                        views.api_venue_claim,           name="venue_claim"),
    path("<int:venue_id>/discounts/",                    views.api_venue_discounts,       name="venue_discounts"),
    path("<int:venue_id>/discounts/<int:discount_id>/",  views.api_venue_discount_detail, name="venue_discount_detail"),
]
