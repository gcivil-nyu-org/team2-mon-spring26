from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("groups", "0011_swipeevent_venue_limit"),
    ]

    operations = [
        migrations.AddField(
            model_name="swipeevent",
            name="scheduled_for",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
