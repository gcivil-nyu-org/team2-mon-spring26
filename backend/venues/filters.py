"""Shared venue-filtering helpers used by the swipe-session and preference-preview endpoints.

Keeping the filter chain in one place guarantees that "preview" results match
what the user will actually see during a swipe session.
"""

from django.conf import settings
from django.db import models

from .models import PRICE_RANGE_CHOICES, Venue, VenuePhoto

# Grade ranking: lower number = stricter (better)
GRADE_RANK = {"A": 1, "B": 2, "C": 3, "Z": 4, "N": 5, "P": 6}

_VALID_PRICE_RANGES = [c[0] for c in PRICE_RANGE_CHOICES]


def filter_venues_by_preferences(
    *,
    cuisine_ids=None,
    min_grade=None,
    price_range=None,
    borough=None,
    neighborhood=None,
    dietary_tag_names=None,
    food_type_tag_names=None,
    require_photos=True,
):
    """Apply the swipe-session filter chain to the Venue queryset.

    Matches ``api_swipe_event_venues`` so preview counts stay truthful.
    ``require_photos=False`` is used by the preview endpoint because the UI
    lazy-loads photos only for the selected venue.

    ``dietary_tag_names`` and ``food_type_tag_names`` are applied only when
    ``settings.STRICT_PREFERENCE_FILTERS`` is True. Both are inclusive-OR:
    a venue passes if it matches any one of the selected tags.
    """
    qs = Venue.objects.filter(is_active=True)

    if borough:
        qs = qs.filter(borough__iexact=borough)
    if neighborhood:
        qs = qs.filter(neighborhood__iexact=neighborhood)

    if min_grade:
        rank = GRADE_RANK.get(min_grade, 6)
        allowed_grades = [g for g, r in GRADE_RANK.items() if r <= rank]
        if "P" in allowed_grades:
            qs = qs.filter(
                models.Q(sanitation_grade__in=allowed_grades)
                | models.Q(sanitation_grade__exact="")
            )
        else:
            qs = qs.filter(sanitation_grade__in=allowed_grades)

    if cuisine_ids:
        qs = qs.filter(cuisine_type_id__in=list(cuisine_ids))

    if price_range:
        max_len = len(price_range)
        allowed_prices = [p for p in _VALID_PRICE_RANGES if len(p) <= max_len]
        qs = qs.filter(
            models.Q(price_range__in=allowed_prices) | models.Q(price_range__exact="")
        )

    if getattr(settings, "STRICT_PREFERENCE_FILTERS", False):
        if dietary_tag_names:
            qs = qs.filter(dietary_tags__name__in=list(dietary_tag_names)).distinct()
        if food_type_tag_names:
            qs = qs.filter(
                food_type_tags__name__in=list(food_type_tag_names)
            ).distinct()

    if require_photos:
        has_place_id = models.Q(google_place_id__isnull=False) & ~models.Q(
            google_place_id=""
        )
        has_photos = models.Exists(
            VenuePhoto.objects.filter(venue=models.OuterRef("pk"))
        )
        qs = qs.filter(has_place_id | has_photos)

    return qs


def _strictest_grade(grades):
    """Return the strictest (lowest GRADE_RANK) grade code, or None."""
    best = None
    best_rank = None
    for g in grades:
        rank = GRADE_RANK.get(g or "P", 6)
        if best_rank is None or rank < best_rank:
            best = g or "P"
            best_rank = rank
    return best


def _aggregate_from_preferences(preferences):
    """Core aggregation logic given already-loaded ``UserPreference`` rows.

    Extracted so callers can fan-out over many groups in a constant number of
    queries (see :func:`aggregate_member_preferences_bulk`).
    """
    grades = [p.minimum_sanitation_grade or "P" for p in preferences]
    min_grade = _strictest_grade(grades) if grades else None

    cuisine_ids = set()
    cuisine_names = set()
    dietary_names = set()
    food_type_names = set()
    price_ranges = []

    for p in preferences:
        for c in p.cuisine_types.all():
            cuisine_ids.add(c.id)
            cuisine_names.add(c.name)
        for d in p.dietary_tags.all():
            dietary_names.add(d.name)
        for f in p.food_type_tags.all():
            food_type_names.add(f.name)
        if p.price_range:
            price_ranges.append(p.price_range)

    # Tightest budget = shortest dollar string the group can all afford.
    price_range = min(price_ranges, key=len) if price_ranges else ""

    return {
        "min_grade": min_grade,
        "cuisine_ids": cuisine_ids,
        "price_range": price_range,
        "dietary_names": sorted(dietary_names),
        "cuisine_names": sorted(cuisine_names),
        "food_type_names": sorted(food_type_names),
    }


def aggregate_member_preferences(group):
    """Compute effective filters for a group from its members' UserPreference rows.

    Cuisine/dietary/food-type are returned as the union across members so
    callers can display the aggregated chips. Price range is the *tightest*
    budget (shortest non-empty dollar string). Minimum sanitation grade is
    the *strictest* grade across members.

    For serializing many groups at once, prefer
    :func:`aggregate_member_preferences_bulk` to avoid N+1 queries.
    """
    from accounts.models import UserPreference

    member_user_ids = list(group.memberships.values_list("user_id", flat=True))
    preferences = UserPreference.objects.filter(
        user_id__in=member_user_ids
    ).prefetch_related("dietary_tags", "cuisine_types", "food_type_tags")
    return _aggregate_from_preferences(preferences)


def aggregate_member_preferences_bulk(groups):
    """Compute :func:`aggregate_member_preferences` for many groups in constant queries.

    Returns ``{group_id: aggregated_dict}`` using a fixed number of queries
    regardless of how many groups are passed in (one for memberships, one for
    preferences, plus the usual m2m prefetches). Groups with no members map to
    the empty-aggregation result, matching the single-group helper's behavior.
    """
    from accounts.models import UserPreference
    from groups.models import GroupMembership

    groups = list(groups)
    if not groups:
        return {}

    group_ids = [g.id for g in groups]

    memberships = list(
        GroupMembership.objects.filter(group_id__in=group_ids).values_list(
            "group_id", "user_id"
        )
    )
    user_ids_by_group: dict = {}
    all_user_ids = set()
    for gid, uid in memberships:
        user_ids_by_group.setdefault(gid, []).append(uid)
        all_user_ids.add(uid)

    prefs_by_user = {
        p.user_id: p
        for p in UserPreference.objects.filter(
            user_id__in=list(all_user_ids)
        ).prefetch_related("dietary_tags", "cuisine_types", "food_type_tags")
    }

    result = {}
    for group in groups:
        prefs = [
            prefs_by_user[uid]
            for uid in user_ids_by_group.get(group.id, [])
            if uid in prefs_by_user
        ]
        result[group.id] = _aggregate_from_preferences(prefs)
    return result
