import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('usuarios', '0005_usuario_banco_cuenta_usuario_banco_dc_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='usuario',
            name='fecha_alta',
            field=models.DateField(default=django.utils.timezone.localdate, verbose_name='Fecha de Alta'),
        ),
    ]
