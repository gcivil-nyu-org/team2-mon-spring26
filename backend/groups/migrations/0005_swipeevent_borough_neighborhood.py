from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("groups", "0004_merge_20260330_0201"),
    ]

    operations = [
        migrations.AddField(
            model_name="swipeevent",
            name="borough",
            field=models.CharField(blank=True, max_length=50, default=""),
        ),
        migrations.AddField(
            model_name="swipeevent",
            name="neighborhood",
            field=models.CharField(blank=True, max_length=100, default=""),
        ),
    ]
