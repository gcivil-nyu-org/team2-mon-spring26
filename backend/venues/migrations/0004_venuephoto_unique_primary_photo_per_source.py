from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("venues", "0003_add_venue_claim"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="venuephoto",
            constraint=models.UniqueConstraint(
                condition=models.Q(is_primary=True),
                fields=["venue", "source"],
                name="unique_primary_photo_per_source",
            ),
        ),
    ]
