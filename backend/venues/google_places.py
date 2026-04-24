import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import requests
from django.conf import settings
from django.db import close_old_connections
from django.utils import timezone

logger = logging.getLogger(__name__)

# Key is sent via request header so it never appears in URLs (and therefore never
# leaks into exception messages, access logs, or referrer headers).
_PLACES_DETAIL_URL = "https://places.googleapis.com/v1/places/{place_id}?fields=photos"
_PLACES_MEDIA_URL = "https://places.googleapis.com/v1/{photo_name}/media?maxWidthPx=800"

# Google CDN URLs (lh3.googleusercontent.com) have an undocumented TTL that can
# be as short as a few hours. Re-fetch after this threshold to stay fresh.
_PHOTO_TTL = timedelta(hours=6)


def fetch_and_cache_primary_photo(venue):
    """
    Returns the primary photo URL for a venue, fetching from Google Places API if not cached
    or if the cached URL is older than _PHOTO_TTL.

    On first call or when stale: hits the API, resolves the CDN redirect URL (API key sent
    via header, never stored), updates VenuePhoto.fetched_at, and returns the URL.
    On subsequent calls within TTL: returns the cached URL from VenuePhoto with no API call.
    Returns None if the venue has no google_place_id, the key is missing, or the API call fails.
    """
    from venues.models import VenuePhoto  # local import to avoid circular dependency

    api_key = getattr(settings, "GOOGLE_PLACES_API_KEY", "")
    if not venue.google_place_id or not api_key:
        return None

    # Check DB cache — return early only if the URL is still fresh
    cached = VenuePhoto.objects.filter(
        venue=venue, source="google_places", is_primary=True
    ).first()
    if cached:
        is_fresh = cached.fetched_at and (timezone.now() - cached.fetched_at) < _PHOTO_TTL
        if is_fresh:
            return cached.image_url

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

        # update_or_create refreshes both the URL and fetched_at on every fetch,
        # safe against duplicate inserts via the DB-level UniqueConstraint on
        # (venue, source) for is_primary=True rows.
        photo, _ = VenuePhoto.objects.update_or_create(
            venue=venue,
            source="google_places",
            is_primary=True,
            defaults={"image_url": image_url, "fetched_at": timezone.now()},
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
    Ensures all venues in the list have a fresh primary Google Places photo.
    Fetches missing or stale photos in parallel so the serialization loop stays
    side-effect free. Expects venues to have already had their 'photos' relation
    prefetched. Each worker thread calls close_old_connections() on exit to
    prevent DB connection leaks.
    """
    staleness_cutoff = timezone.now() - _PHOTO_TTL

    def _needs_fetch(venue):
        if not venue.google_place_id:
            return False
        primary = next(
            (p for p in venue.photos.all() if p.is_primary and p.source == "google_places"),
            None,
        )
        if primary is None:
            return True
        return primary.fetched_at is None or primary.fetched_at < staleness_cutoff

    needs_fetch = [v for v in venues if _needs_fetch(v)]
    if not needs_fetch:
        return
    with ThreadPoolExecutor(max_workers=min(len(needs_fetch), max_workers)) as executor:
        executor.map(_fetch_with_connection_cleanup, needs_fetch)
