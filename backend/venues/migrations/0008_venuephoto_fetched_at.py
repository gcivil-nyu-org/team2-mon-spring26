from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("venues", "0007_review_additional_photos"),
    ]

    operations = [
        migrations.AddField(
            model_name="venuephoto",
            name="fetched_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
