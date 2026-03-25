from django.core.management.base import BaseCommand

from accounts.models import DietaryTag, FoodTypeTag
from venues.models import Venue

# google_type → FoodTypeTag name
FOOD_TYPE_MAP = {
    "fast_food_restaurant": "Fast Food",
    "fine_dining_restaurant": "Fine Dining",
    "cafe": "Cafe",
    "coffee_shop": "Coffee Shop",
    "bakery": "Bakery",
    "bagel_shop": "Bagel Shop",
    "bar": "Bar",
    "bar_and_grill": "Bar & Grill",
    "wine_bar": "Wine Bar",
    "pub": "Pub",
    "night_club": "Night Club",
    "buffet_restaurant": "Buffet",
    "diner": "Diner",
    "brunch_restaurant": "Brunch",
    "breakfast_restaurant": "Breakfast",
    "dessert_restaurant": "Dessert",
    "dessert_shop": "Dessert",
    "ice_cream_shop": "Ice Cream",
    "donut_shop": "Donut Shop",
    "candy_store": "Candy Store",
    "chocolate_shop": "Chocolate Shop",
    "juice_shop": "Juice Bar",
    "tea_house": "Tea House",
    "pizza_restaurant": "Pizza",
    "sandwich_shop": "Sandwich Shop",
    "deli": "Deli",
    "steak_house": "Steakhouse",
    "seafood_restaurant": "Seafood",
    "sushi_restaurant": "Sushi",
    "ramen_restaurant": "Ramen",
    "food_court": "Food Court",
    "catering_service": "Catering",
    "internet_cafe": "Internet Cafe",
    "cat_cafe": "Cat Cafe",
    "dog_cafe": "Dog Cafe",
    "bbq_restaurant": "BBQ",
    "barbecue_restaurant": "BBQ",
    "acai_shop": "Acai Shop",
}

# google_type or cuisine keyword → DietaryTag name
DIETARY_TYPE_MAP = {
    "vegan_restaurant": "Vegan",
    "vegetarian_restaurant": "Vegetarian",
}

# Cuisine name keywords → DietaryTag
CUISINE_DIETARY_MAP = {
    "vegan": "Vegan",
    "vegetarian": "Vegetarian",
    "halal": "Halal",
    "kosher": "Kosher",
    "gluten": "Gluten-Free",
}


class Command(BaseCommand):
    help = (
        "Populate DietaryTag and FoodTypeTag from venue google_types and cuisine data"
    )

    def handle(self, *args, **options):
        self.stdout.write("Creating tags...")

        # Create all FoodTypeTags
        food_tags = {}
        for name in set(FOOD_TYPE_MAP.values()):
            obj, _ = FoodTypeTag.objects.get_or_create(name=name)
            food_tags[name] = obj
        self.stdout.write(f"  FoodTypeTags: {len(food_tags)} tags ready")

        # Create all DietaryTags
        dietary_tags = {}
        for name in set(
            list(DIETARY_TYPE_MAP.values()) + list(CUISINE_DIETARY_MAP.values())
        ):
            obj, _ = DietaryTag.objects.get_or_create(name=name)
            dietary_tags[name] = obj
        self.stdout.write(f"  DietaryTags: {len(dietary_tags)} tags ready")

        self.stdout.write("Linking tags to venues...")

        venues_qs = Venue.objects.select_related("cuisine_type")
        total = venues_qs.count()
        linked_food = 0
        linked_dietary = 0

        for i, venue in enumerate(venues_qs.iterator(), 1):
            google_types = venue.google_types or []
            cuisine_name = (
                venue.cuisine_type.name if venue.cuisine_type else ""
            ).lower()

            # FoodTypeTags from google_types
            food_to_add = []
            for gtype in google_types:
                tag_name = FOOD_TYPE_MAP.get(gtype)
                if tag_name and tag_name in food_tags:
                    food_to_add.append(food_tags[tag_name])
            if food_to_add:
                venue.food_type_tags.add(*food_to_add)
                linked_food += 1

            # DietaryTags from google_types
            dietary_to_add = []
            for gtype in google_types:
                tag_name = DIETARY_TYPE_MAP.get(gtype)
                if tag_name and tag_name in dietary_tags:
                    dietary_to_add.append(dietary_tags[tag_name])

            # DietaryTags from cuisine name keywords
            for keyword, tag_name in CUISINE_DIETARY_MAP.items():
                if keyword in cuisine_name and tag_name in dietary_tags:
                    dietary_to_add.append(dietary_tags[tag_name])

            if dietary_to_add:
                venue.dietary_tags.add(*dietary_to_add)
                linked_dietary += 1

            if i % 1000 == 0:
                self.stdout.write(f"  Processed {i}/{total}...", ending="\r")
                self.stdout.flush()

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Venues processed with food type tags: {linked_food}, dietary tags: {linked_dietary}"
            )
        )
