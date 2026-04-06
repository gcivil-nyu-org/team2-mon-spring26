import logging
import os

import requests

logger = logging.getLogger(__name__)

_API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")

_PLACES_DETAIL_URL = "https://places.googleapis.com/v1/places/{place_id}?fields=photos&key={key}"
_PLACES_MEDIA_URL = "https://places.googleapis.com/v1/{photo_name}/media?maxWidthPx=800&key={key}"


def fetch_and_cache_primary_photo(venue):
    """
    Returns the primary photo URL for a venue, fetching from Google Places API if not yet cached.

    On first call: hits the API, saves the URL to VenuePhoto (source='google_places'), returns URL.
    On subsequent calls: returns the cached URL from VenuePhoto immediately.
    Returns None if the venue has no google_place_id, the key is missing, or the API call fails.
    """
    from venues.models import VenuePhoto  # local import to avoid circular dependency

    if not venue.google_place_id or not _API_KEY:
        return None

    # Check DB cache first
    cached = (
        VenuePhoto.objects.filter(venue=venue, source="google_places", is_primary=True)
        .values_list("image_url", flat=True)
        .first()
    )
    if cached:
        return cached

    try:
        # Step 1: get photo resource names for this place
        detail_resp = requests.get(
            _PLACES_DETAIL_URL.format(place_id=venue.google_place_id, key=_API_KEY),
            timeout=5,
        )
        detail_resp.raise_for_status()
        photos = detail_resp.json().get("photos", [])
        if not photos:
            return None

        photo_name = photos[0]["name"]  # e.g. "places/ChIJ.../photos/AUac..."

        # Step 2: resolve the media URL to its CDN redirect (avoids embedding API key in stored URL)
        media_resp = requests.get(
            _PLACES_MEDIA_URL.format(photo_name=photo_name, key=_API_KEY),
            timeout=5,
            allow_redirects=False,
        )

        if media_resp.status_code in (301, 302, 303, 307, 308):
            image_url = media_resp.headers.get("Location")
        elif media_resp.status_code == 200:
            # API returned the image directly — fall back to storing the media URL
            image_url = _PLACES_MEDIA_URL.format(photo_name=photo_name, key=_API_KEY)
        else:
            logger.warning(
                "Google Places media request returned %s for venue %s",
                media_resp.status_code,
                venue.id,
            )
            return None

        if not image_url:
            return None

        VenuePhoto.objects.create(
            venue=venue,
            image_url=image_url,
            source="google_places",
            is_primary=True,
        )
        return image_url

    except Exception:
        logger.exception("Failed to fetch Google Places photo for venue %s", venue.id)
        return None
