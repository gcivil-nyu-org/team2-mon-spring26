from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("venues", "0007_review_additional_photos"),
    ]

    operations = [
        # Use IF NOT EXISTS so this is safe to run on databases that already
        # had the column added by the old 0006_venuephoto_fetched_at migration.
        migrations.RunSQL(
            sql="ALTER TABLE venues_venuephoto ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ NULL;",
            reverse_sql="ALTER TABLE venues_venuephoto DROP COLUMN IF EXISTS fetched_at;",
            state_operations=[
                migrations.AddField(
                    model_name="venuephoto",
                    name="fetched_at",
                    field=models.DateTimeField(blank=True, null=True),
                ),
            ],
        ),
    ]
