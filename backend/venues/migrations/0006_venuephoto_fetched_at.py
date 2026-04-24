from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("venues", "0005_alter_venuephoto_image_url"),
    ]

    operations = [
        migrations.AddField(
            model_name="venuephoto",
            name="fetched_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
