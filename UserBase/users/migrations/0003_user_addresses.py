from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('users', '0002_alter_user_house_number')]
    operations = [migrations.AddField(model_name='user', name='addresses',
                  field=models.JSONField(null=True, blank=True, default=None))]
