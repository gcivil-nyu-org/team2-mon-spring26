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
                # Reverse is a no-op: the column may have pre-existed on production
                # (added by the legacy 0006 migration). Dropping it on rollback
                # would cause data loss for databases we didn't create it on.
                migrations.RunPython(_add_fetched_at, migrations.RunPython.noop),
            ],
        ),
    ]
