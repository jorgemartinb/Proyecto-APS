from django.db import models
from django.conf import settings

# Create your models here.

class Reservation(models.Model):
    # ⏳ OPCIONES DE ESTADO: Para el flujo de aprobación
    ESTADOS_RESERVA = [
        ('PENDIENTE', 'Pendiente de aprobación'),
        ('ACEPTADA', 'Aceptada'),
        ('RECHAZADA', 'Rechazada'),
    ]
    PERIODICIDADES = [
        ('SEMANAL', 'Semanal'),
        ('MENSUAL', 'Mensual'),
        ('TRIMESTRAL', 'Trimestral'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reservations'
    )
    title = models.CharField(max_length=100)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    # 🛡️ NUEVO CAMPO: Toda reserva nace siendo 'PENDIENTE'
    estado = models.CharField(
        max_length=20,
        choices=ESTADOS_RESERVA,
        default='PENDIENTE'
    )
    is_recurring = models.BooleanField(default=False)
    recurrence_type = models.CharField(
        max_length=20,
        choices=PERIODICIDADES,
        blank=True,
        null=True
    )

    class Meta:
        ordering = ['-start_time']

    def __str__(self):
        return f"{self.title} - {self.user.username} ({self.get_estado_display()})"
