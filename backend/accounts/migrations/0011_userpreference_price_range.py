from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0010_seed_default_admin_user"),
    ]

    operations = [
        migrations.AddField(
            model_name="userpreference",
            name="price_range",
            field=models.CharField(
                blank=True,
                choices=[
                    ("$", "$"),
                    ("$$", "$$"),
                    ("$$$", "$$$"),
                    ("$$$$", "$$$$"),
                ],
                max_length=4,
            ),
        ),
    ]
