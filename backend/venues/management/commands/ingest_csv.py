import csv
from datetime import datetime
from decimal import Decimal, InvalidOperation

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import CuisineType
from venues.models import Inspection, Venue


def parse_date(val):
    if not val or val.strip() == "":
        return None
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(val.strip(), fmt).date()
        except ValueError:
            continue
    return None


def parse_decimal(val):
    if not val or val.strip() == "":
        return None
    try:
        return Decimal(val.strip())
    except InvalidOperation:
        return None


def parse_int(val):
    if not val or val.strip() == "":
        return None
    try:
        return int(float(val.strip()))
    except (ValueError, TypeError):
        return None


def parse_bool(val):
    if not val or val.strip() == "":
        return False
    return val.strip().lower() in ("true", "1", "yes")


def map_price_range(val):
    if not val or val.strip() == "":
        return ""
    val = val.strip()
    mapping = {
        "$0-$10": "$",
        "$10-$20": "$$",
        "$20-$30": "$$$",
        "$30-$40": "$$$$",
        "$40+": "$$$$",
    }
    if val in mapping:
        return mapping[val]
    if val.startswith("$$$$"):
        return "$$$$"
    if val.startswith("$$$"):
        return "$$$"
    if val.startswith("$$"):
        return "$$"
    if val.startswith("$"):
        return "$"
    return ""


def parse_hours(val):
    if not val or val.strip() == "":
        return {}
    days = {}
    for part in val.split("|"):
        part = part.strip()
        if ": " in part:
            day, hours = part.split(": ", 1)
            days[day.strip()] = hours.strip()
    return days


def parse_google_types(val):
    if not val or val.strip() == "":
        return []
    return [t.strip() for t in val.split(",") if t.strip()]


class Command(BaseCommand):
    help = "Ingest enriched DOHMH restaurant CSV into the database"

    def add_arguments(self, parser):
        parser.add_argument("csv_path", type=str, help="Path to the CSV file")
        parser.add_argument(
            "--batch-size",
            type=int,
            default=500,
            help="Number of rows per transaction batch (default: 500)",
        )

    def handle(self, *args, **options):
        csv_path = options["csv_path"]
        batch_size = options["batch_size"]

        self.stdout.write(f"Reading {csv_path} ...")

        cuisine_cache = {}
        counters = {"venues_created": 0, "venues_updated": 0, "inspections_created": 0, "errors": 0}

        with open(csv_path, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        self.stdout.write(f"Loaded {len(rows)} rows. Starting ingestion...")

        for i in range(0, len(rows), batch_size):
            batch = rows[i: i + batch_size]
            try:
                with transaction.atomic():
                    for row in batch:
                        try:
                            self._process_row(row, cuisine_cache, counters)
                        except Exception as e:
                            counters["errors"] += 1
                            if counters["errors"] <= 5:
                                self.stderr.write(f"Row error ({row.get('dohmh_camis', '?')}): {e}")
            except Exception as e:
                self.stderr.write(f"Batch {i}-{i + batch_size} failed: {e}")

            self.stdout.write(f"  Processed {min(i + batch_size, len(rows))}/{len(rows)} rows...", ending="\r")
            self.stdout.flush()

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Done. Venues created: {counters['venues_created']}, "
            f"updated: {counters['venues_updated']}, "
            f"inspections created: {counters['inspections_created']}, "
            f"errors: {counters['errors']}"
        ))

    def _process_row(self, row, cuisine_cache, counters):
        camis = row.get("dohmh_camis", "").strip() or None
        google_place_id = row.get("google_place_id", "").strip() or None

        if not camis and not google_place_id:
            return

        # Get or create CuisineType
        cuisine_name = row.get("cuisine", "").strip() or row.get("dohmh_cuisine_description", "").strip()
        cuisine_obj = None
        if cuisine_name:
            if cuisine_name not in cuisine_cache:
                slug = cuisine_name.lower().replace(" ", "-").replace("/", "-")
                obj, _ = CuisineType.objects.get_or_create(
                    slug=slug,
                    defaults={"name": cuisine_name},
                )
                cuisine_cache[cuisine_name] = obj
            cuisine_obj = cuisine_cache[cuisine_name]

        venue_defaults = {
            "name": row.get("name", "").strip() or row.get("dohmh_dba", "").strip(),
            "name_clean": row.get("name_clean", "").strip(),
            "street_address": row.get("address", "").strip() or (
                f"{row.get('dohmh_building', '').strip()} {row.get('dohmh_street', '').strip()}".strip()
            ),
            "borough": row.get("borough", "").strip() or row.get("dohmh_boro", "").strip(),
            "zipcode": (row.get("zipcode", "").strip() or row.get("dohmh_zipcode", "").strip()).split(".")[0],
            "phone": row.get("phone", "").strip() or row.get("dohmh_phone", "").strip(),
            "latitude": parse_decimal(row.get("latitude")),
            "longitude": parse_decimal(row.get("longitude")),
            "cuisine_type": cuisine_obj,
            "price_range": map_price_range(row.get("price_range", "")),
            "google_place_id": google_place_id,
            "google_rating": parse_decimal(row.get("google_rating")),
            "google_review_count": parse_int(row.get("google_reviews")) or 0,
            "google_maps_url": (row.get("google_maps_url", "").strip() or "")[:200],
            "google_types": parse_google_types(row.get("google_types", "")),
            "has_takeout": parse_bool(row.get("has_takeout")),
            "has_delivery": parse_bool(row.get("has_delivery")),
            "has_dine_in": parse_bool(row.get("has_dine_in")),
            "is_reservable": parse_bool(row.get("is_reservable")),
            "hours": parse_hours(row.get("hours", "")),
            "website": (row.get("website", "").strip() or "")[:200],
            "business_status": row.get("business_status", "").strip() or "",
            "match_status": row.get("match_status", "").strip() or "",
            "match_confidence": parse_decimal(row.get("match_confidence")),
            "sanitation_grade": (row.get("inspection_grade", "").strip() or "")[:2],
        }

        if camis:
            venue, created = Venue.objects.update_or_create(
                dohmh_camis=camis,
                defaults=venue_defaults,
            )
        else:
            venue, created = Venue.objects.update_or_create(
                google_place_id=google_place_id,
                defaults=venue_defaults,
            )

        if created:
            counters["venues_created"] += 1
        else:
            counters["venues_updated"] += 1

        # Create inspection record
        inspection_date = parse_date(row.get("dohmh_inspection_date") or row.get("inspection_date"))
        violation_code = row.get("dohmh_violation_code", "").strip()

        if inspection_date or violation_code:
            _, insp_created = Inspection.objects.get_or_create(
                venue=venue,
                inspection_date=inspection_date,
                violation_code=violation_code,
                defaults={
                    "inspection_type": row.get("dohmh_inspection_type", "").strip(),
                    "action": row.get("dohmh_action", "").strip(),
                    "score": parse_int(row.get("dohmh_score") or row.get("inspection_score")),
                    "grade": (row.get("dohmh_grade") or row.get("inspection_grade") or "").strip()[:2],
                    "grade_date": parse_date(row.get("dohmh_grade_date")),
                    "violation_description": row.get("dohmh_violation_description", "").strip(),
                    "critical_flag": row.get("dohmh_critical_flag", "").strip(),
                    "record_date": parse_date(row.get("dohmh_record_date")),
                },
            )
            if insp_created:
                counters["inspections_created"] += 1
