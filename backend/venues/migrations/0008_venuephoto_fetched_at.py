from django.db import migrations, models


def _add_fetched_at(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor == "postgresql":
        # IF NOT EXISTS is atomic on PostgreSQL — no check-then-act race.
        schema_editor.execute(
            "ALTER TABLE venues_venuephoto ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ NULL"
        )
    else:
        # SQLite does not support IF NOT EXISTS for ADD COLUMN; check manually.
        with connection.cursor() as cursor:
            cursor.execute("PRAGMA table_info(venues_venuephoto)")
            exists = any(row[1] == "fetched_at" for row in cursor.fetchall())
        if not exists:
            schema_editor.execute(
                "ALTER TABLE venues_venuephoto ADD COLUMN fetched_at DATETIME NULL"
            )


def _remove_fetched_at(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor == "postgresql":
        schema_editor.execute(
            "ALTER TABLE venues_venuephoto DROP COLUMN IF EXISTS fetched_at"
        )
    else:
        schema_editor.execute("ALTER TABLE venues_venuephoto DROP COLUMN fetched_at")


class Migration(migrations.Migration):

    dependencies = [
        ("venues", "0007_review_additional_photos"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="venuephoto",
                    name="fetched_at",
                    field=models.DateTimeField(blank=True, null=True),
                ),
            ],
            database_operations=[
                migrations.RunPython(_add_fetched_at, _remove_fetched_at),
            ],
        ),
    ]
