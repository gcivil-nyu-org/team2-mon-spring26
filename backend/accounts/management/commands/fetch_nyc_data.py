import requests
import logging
from decimal import Decimal, InvalidOperation
from django.core.management.base import BaseCommand
from django.db import transaction
from accounts.models import CuisineType
from venues.models import Venue

logger = logging.getLogger(__name__)


def parse_decimal(val):
    if not val:
        return None
    try:
        return Decimal(str(val).strip())
    except InvalidOperation:
        return None


def parse_int(val):
    if not val:
        return None
    try:
        return int(float(str(val).strip()))
    except (ValueError, TypeError):
        return None


def map_grade(val):
    if not val:
        return ""
    val = val.strip().upper()
    valid = {"A", "B", "C", "P", "N", "Z"}
    return val if val in valid else ""


def map_borough(val):
    if not val:
        return ""
    mapping = {
        "MANHATTAN": "Manhattan",
        "BROOKLYN": "Brooklyn",
        "QUEENS": "Queens",
        "BRONX": "Bronx",
        "STATEN ISLAND": "Staten Island",
    }
    return mapping.get(val.strip().upper(), val.strip().title())


class Command(BaseCommand):
    help = (
        "Fetch NYC restaurant inspection data from Open Data API and load into database"
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=500,
            help="Number of records to fetch (default: 500)",
        )
        parser.add_argument(
            "--offset",
            type=int,
            default=0,
            help="Offset to start from (default: 0)",
        )
        parser.add_argument(
            "--borough",
            type=str,
            default="",
            help="Filter by borough e.g. MANHATTAN",
        )

    def handle(self, *args, **options):
        limit = options["limit"]
        offset = options["offset"]
        borough_filter = options["borough"].strip().upper()

        # NYC Open Data - DOHMH Restaurant Inspections
        url = "https://data.cityofnewyork.us/resource/43nn-pn8j.json"

        params = {
            "$limit": limit,
            "$offset": offset,
            "$order": "camis",
            "$where": "grade IS NOT NULL",  # only fetch graded restaurants
        }

        if borough_filter:
            params["$where"] += f" AND boro='{borough_filter}'"

        self.stdout.write(f"Fetching {limit} records from NYC Open Data...")

        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            records = response.json()
        except Exception as e:
            self.stderr.write(f"Failed to fetch data: {e}")
            return

        self.stdout.write(f"Fetched {len(records)} records. Importing...")

        cuisine_cache = {}
        created_count = 0
        updated_count = 0
        error_count = 0

        # Group records by camis to avoid duplicates
        venues_by_camis = {}
        for record in records:
            camis = record.get("camis", "").strip()
            if camis:
                venues_by_camis[camis] = record

        self.stdout.write(f"Unique venues: {len(venues_by_camis)}")

        with transaction.atomic():
            for camis, record in venues_by_camis.items():
                try:
                    # Get or create cuisine type
                    cuisine_name = record.get("cuisine_description", "").strip()
                    cuisine_obj = None
                    if cuisine_name:
                        if cuisine_name not in cuisine_cache:
                            obj, _ = CuisineType.objects.get_or_create(
                                name=cuisine_name
                            )
                            cuisine_cache[cuisine_name] = obj
                        cuisine_obj = cuisine_cache[cuisine_name]

                    # Build street address
                    building = record.get("building", "").strip()
                    street = record.get("street", "").strip()
                    street_address = f"{building} {street}".strip()

                    # Map grade
                    grade = map_grade(record.get("grade", ""))

                    venue_defaults = {
                        "name": record.get("dba", "").strip(),
                        "street_address": street_address,
                        "borough": map_borough(record.get("boro", "")),
                        "zipcode": record.get("zipcode", "").strip().split(".")[0],
                        "phone": record.get("phone", "").strip(),
                        "latitude": parse_decimal(record.get("latitude")),
                        "longitude": parse_decimal(record.get("longitude")),
                        "cuisine_type": cuisine_obj,
                        "sanitation_grade": grade,
                        "is_active": True,
                        "is_verified": False,
                    }

                    venue, created = Venue.objects.update_or_create(
                        dohmh_camis=camis,
                        defaults=venue_defaults,
                    )

                    if created:
                        created_count += 1
                    else:
                        updated_count += 1

                except Exception as e:
                    error_count += 1
                    if error_count <= 5:
                        self.stderr.write(f"Error on camis {camis}: {e}")

        self.stdout.write(
            self.style.SUCCESS(
                f"Done! Created: {created_count}, "
                f"Updated: {updated_count}, "
                f"Errors: {error_count}"
            )
        )
