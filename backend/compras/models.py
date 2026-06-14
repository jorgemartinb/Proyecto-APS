from django.conf import settings
from django.db import models
from django.utils import timezone


class Compra(models.Model):
    ESTADOS = [
        ('SOLICITADO', 'Solicitado'),
        ('APROBADO', 'Aprobado'),
        ('RECHAZADO', 'Rechazado'),
        ('COMPRADO', 'Comprado'),
    ]

    nombre = models.CharField(max_length=160)
    precio_aproximado = models.DecimalField(max_digits=10, decimal_places=2)
    solicitante = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='compras_solicitadas',
    )
    fecha_solicitud = models.DateTimeField(default=timezone.now)
    estado = models.CharField(max_length=20, choices=ESTADOS, default='SOLICITADO')
    descripcion = models.TextField(blank=True, null=True)
    gestionada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='compras_gestionadas',
        blank=True,
        null=True,
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-fecha_solicitud', '-id']

    def __str__(self):
        return f'{self.nombre} ({self.estado})'
