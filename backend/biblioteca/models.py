from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


class Libro(models.Model):
    DISPONIBILIDADES = [
        ('DISPONIBLE', 'Disponible'),
        ('NO_DISPONIBLE', 'No disponible'),
    ]

    titulo = models.CharField(max_length=255)
    autor = models.CharField(max_length=255, blank=True)
    editorial = models.CharField(max_length=255, blank=True)
    categoria = models.CharField(max_length=255, blank=True)
    isbn = models.CharField(max_length=120, blank=True, null=True)
    etiqueta = models.CharField(max_length=120, blank=True, null=True)
    disponibilidad = models.CharField(max_length=20, choices=DISPONIBILIDADES, default='DISPONIBLE')
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['titulo', 'autor']
        constraints = [
            models.UniqueConstraint(
                fields=['isbn'],
                condition=models.Q(isbn__isnull=False) & ~models.Q(isbn=''),
                name='libro_isbn_unico_si_existe',
            ),
            models.UniqueConstraint(
                fields=['titulo', 'autor'],
                condition=models.Q(isbn__isnull=True) | models.Q(isbn=''),
                name='libro_titulo_autor_unico_sin_isbn',
            ),
        ]

    def __str__(self):
        return self.titulo


class PrestamoLibro(models.Model):
    ESTADOS = [
        ('PENDIENTE', 'Pendiente'),
        ('APROBADA', 'Aprobada'),
        ('RECHAZADA', 'Rechazada'),
        ('PRESTADA', 'Prestada'),
        ('DEVUELTA', 'Devuelta'),
        ('CANCELADA', 'Cancelada'),
        ('VENCIDA', 'Vencida'),
    ]
    ESTADOS_BLOQUEAN_LIBRO = ['APROBADA', 'PRESTADA', 'VENCIDA']
    ESTADOS_ACTIVOS_USUARIO = ['PENDIENTE', 'APROBADA', 'PRESTADA', 'VENCIDA']

    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='prestamos_libros')
    libro = models.ForeignKey(Libro, on_delete=models.PROTECT, related_name='prestamos')
    fecha_solicitud = models.DateTimeField(default=timezone.now)
    estado = models.CharField(max_length=20, choices=ESTADOS, default='PENDIENTE')
    fecha_aprobacion = models.DateTimeField(blank=True, null=True)
    fecha_rechazo = models.DateTimeField(blank=True, null=True)
    administradora = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='prestamos_libros_gestionados',
        blank=True,
        null=True,
    )
    motivo_rechazo = models.TextField(blank=True, null=True)
    fecha_entrega = models.DateTimeField(blank=True, null=True)
    fecha_prevista_devolucion = models.DateField(blank=True, null=True)
    fecha_devolucion = models.DateTimeField(blank=True, null=True)
    observaciones = models.TextField(blank=True, null=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-fecha_solicitud']
        constraints = [
            models.UniqueConstraint(
                fields=['libro'],
                condition=models.Q(estado__in=['APROBADA', 'PRESTADA', 'VENCIDA']),
                name='prestamo_libro_unico_activo',
            ),
            models.UniqueConstraint(
                fields=['usuario', 'libro'],
                condition=models.Q(estado__in=['PENDIENTE', 'APROBADA', 'PRESTADA', 'VENCIDA']),
                name='prestamo_libro_unico_usuario_activo',
            ),
        ]

    def fecha_devolucion_15_dias(self, fecha_base=None):
        fecha_base = fecha_base or timezone.now()
        return (fecha_base + timedelta(days=15)).date()

    def __str__(self):
        return f'{self.libro} - {self.usuario} ({self.estado})'
