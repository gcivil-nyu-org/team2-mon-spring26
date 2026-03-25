# Remove legacy preference fields from User; preferences live in UserPreference (TABLE 10)

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_data_migrate_to_userpreference"),
    ]

    operations = [
        migrations.RemoveField(model_name="user", name="dietary_preferences"),
        migrations.RemoveField(model_name="user", name="cuisine_preferences"),
        migrations.RemoveField(model_name="user", name="food_type_preferences"),
        migrations.RemoveField(model_name="user", name="minimum_sanitation_grade"),
    ]
