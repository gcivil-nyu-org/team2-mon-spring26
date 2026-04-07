from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("venues", "0004_venuephoto_unique_primary_photo_per_source"),
    ]

    operations = [
        migrations.AlterField(
            model_name="venuephoto",
            name="image_url",
            field=models.URLField(max_length=2048),
        ),
    ]
