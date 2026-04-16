"""Merge the legacy ``Jewish/Kosher`` dietary tag into ``Kosher``.

Earlier versions of ``preference-options.json`` exposed ``Jewish/Kosher`` as
a dietary option, which could persist into ``DietaryTag`` rows and through
``UserPreference.dietary_tags`` M2M references. The UI catalog was rewritten
to use the DB-canonical ``Kosher`` label, so any lingering ``Jewish/Kosher``
tag would silently disappear from the user's saved preferences after the
catalog change.

This migration is idempotent: if only one of the two tags exists, it is
simply renamed; if both exist, all M2M references to the legacy tag are
rewired to the canonical one and the legacy row is deleted; if neither
exists (fresh DB), it is a no-op.
"""

from django.db import migrations


LEGACY_NAME = "Jewish/Kosher"
CANONICAL_NAME = "Kosher"


def merge_legacy_kosher(apps, schema_editor):
    DietaryTag = apps.get_model("accounts", "DietaryTag")
    UserPreference = apps.get_model("accounts", "UserPreference")

    legacy = DietaryTag.objects.filter(name=LEGACY_NAME).first()
    if legacy is None:
        return

    canonical = DietaryTag.objects.filter(name=CANONICAL_NAME).first()

    if canonical is None:
        # Simple rename — keeps all existing M2M references intact.
        legacy.name = CANONICAL_NAME
        legacy.slug = ""  # Let save() regenerate, but bypass custom save here:
        legacy.save()
        return

    # Both exist: rewire every preference that points at the legacy tag to the
    # canonical tag, then delete the legacy row.
    prefs_with_legacy = UserPreference.objects.filter(dietary_tags=legacy)
    for pref in prefs_with_legacy:
        pref.dietary_tags.add(canonical)
        pref.dietary_tags.remove(legacy)

    # Rewire venue references too (Venue.dietary_tags is defined in
    # ``venues.models`` and uses the same DietaryTag table).
    Venue = apps.get_model("venues", "Venue")
    venues_with_legacy = Venue.objects.filter(dietary_tags=legacy)
    for venue in venues_with_legacy:
        venue.dietary_tags.add(canonical)
        venue.dietary_tags.remove(legacy)

    legacy.delete()


def noop_reverse(apps, schema_editor):
    # Reversing this merge would require knowing which references originally
    # pointed at ``Jewish/Kosher`` vs ``Kosher``, which we don't preserve.
    # The forward direction is a one-way data cleanup, so reverse is a no-op.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0012_merge_20260416_0501"),
        ("venues", "0005_alter_venuephoto_image_url"),
    ]

    operations = [
        migrations.RunPython(merge_legacy_kosher, noop_reverse),
    ]
