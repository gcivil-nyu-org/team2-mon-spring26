import logging
from concurrent.futures import ThreadPoolExecutor

import requests
from django.conf import settings
from django.db import close_old_connections

logger = logging.getLogger(__name__)

# Key is sent via request header so it never appears in URLs (and therefore never
# leaks into exception messages, access logs, or referrer headers).
_PLACES_DETAIL_URL = "https://places.googleapis.com/v1/places/{place_id}?fields=photos"
_PLACES_MEDIA_URL = "https://places.googleapis.com/v1/{photo_name}/media?maxWidthPx=800"


def fetch_and_cache_primary_photo(venue):
    """
    Returns the primary photo URL for a venue, fetching from Google Places API if not yet cached.

    On first call: hits the API, resolves the CDN redirect URL (API key sent via header,
    never stored), saves to VenuePhoto, and returns the URL.
    On subsequent calls: returns the cached URL from VenuePhoto with no API call.
    Returns None if the venue has no google_place_id, the key is missing, or the API call fails.
    """
    from venues.models import VenuePhoto  # local import to avoid circular dependency

    api_key = getattr(settings, "GOOGLE_PLACES_API_KEY", "")
    if not venue.google_place_id or not api_key:
        return None

    # Check DB cache first
    cached = (
        VenuePhoto.objects.filter(venue=venue, source="google_places", is_primary=True)
        .values_list("image_url", flat=True)
        .first()
    )
    if cached:
        return cached

    headers = {"X-Goog-Api-Key": api_key}

    try:
        # Step 1: get photo resource names for this place
        detail_resp = requests.get(
            _PLACES_DETAIL_URL.format(place_id=venue.google_place_id),
            headers=headers,
            timeout=5,
        )
        detail_resp.raise_for_status()
        photos = detail_resp.json().get("photos", [])
        if not photos:
            return None

        photo_name = photos[0]["name"]  # e.g. "places/ChIJ.../photos/AUac..."

        # Step 2: follow the redirect to get the stable CDN URL (lh3.googleusercontent.com)
        # so that the API key is never stored in the database or returned to clients.
        media_resp = requests.get(
            _PLACES_MEDIA_URL.format(photo_name=photo_name),
            headers=headers,
            timeout=5,
            allow_redirects=False,
        )

        if media_resp.status_code in (301, 302, 303, 307, 308):
            image_url = media_resp.headers.get("Location")
        else:
            # Google Places normally redirects; if it doesn't, skip caching to
            # avoid storing a URL that contains the API key.
            logger.warning(
                "Google Places media request returned unexpected status %s for venue %s — skipping",
                media_resp.status_code,
                venue.id,
            )
            return None

        if not image_url:
            return None

        # get_or_create is safe against duplicate inserts because VenuePhoto has a
        # DB-level UniqueConstraint on (venue, source) for is_primary=True rows.
        photo, _ = VenuePhoto.objects.get_or_create(
            venue=venue,
            source="google_places",
            is_primary=True,
            defaults={"image_url": image_url},
        )
        return photo.image_url

    except Exception:
        logger.exception("Failed to fetch Google Places photo for venue %s", venue.id)
        return None


def _fetch_with_connection_cleanup(venue):
    """Wrapper used by bulk_prefetch_photos to ensure each thread releases its DB connection."""
    try:
        return fetch_and_cache_primary_photo(venue)
    finally:
        close_old_connections()


def bulk_prefetch_photos(venues, max_workers=5):
    """
    Ensures all venues in the list have a cached primary Google Places photo.
    Fetches missing photos in parallel so the serialization loop stays side-effect free.
    Expects venues to have already had their 'photos' relation prefetched.
    Each worker thread calls close_old_connections() on exit to prevent DB connection leaks.
    """
    needs_fetch = [v for v in venues if v.google_place_id and not list(v.photos.all())]
    if not needs_fetch:
        return
    with ThreadPoolExecutor(max_workers=min(len(needs_fetch), max_workers)) as executor:
        executor.map(_fetch_with_connection_cleanup, needs_fetch)
