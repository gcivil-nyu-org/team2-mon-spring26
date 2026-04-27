from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("venues", "0006_contentreport"),
    ]

    operations = [
        migrations.AddField(
            model_name="review",
            name="additional_photos",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
