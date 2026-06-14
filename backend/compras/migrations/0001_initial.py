from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Compra',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=160)),
                ('precio_aproximado', models.DecimalField(decimal_places=2, max_digits=10)),
                ('fecha_solicitud', models.DateTimeField(default=django.utils.timezone.now)),
                ('estado', models.CharField(choices=[('SOLICITADO', 'Solicitado'), ('APROBADO', 'Aprobado'), ('RECHAZADO', 'Rechazado'), ('COMPRADO', 'Comprado')], default='SOLICITADO', max_length=20)),
                ('descripcion', models.TextField(blank=True, null=True)),
                ('fecha_creacion', models.DateTimeField(auto_now_add=True)),
                ('fecha_actualizacion', models.DateTimeField(auto_now=True)),
                ('gestionada_por', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='compras_gestionadas', to=settings.AUTH_USER_MODEL)),
                ('solicitante', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='compras_solicitadas', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-fecha_solicitud', '-id'],
            },
        ),
    ]
