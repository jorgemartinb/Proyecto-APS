from django.db import models

class PropuestaPleno(models.Model):
    ESTADOS = [
        ('PENDIENTE', 'Pendiente'),
        ('RECHAZADA', 'Rechazada'),
        ('PRESENTADA', 'Presentada por Registro'),
        ('FINALIZADA', 'Finalizada'),
    ]
    vecino = models.ForeignKey('usuarios.Usuario', on_delete=models.CASCADE, related_name='propuestas')
    titulo = models.CharField(max_length=200)
    descripcion = models.TextField()
    estado = models.CharField(max_length=20, choices=ESTADOS, default='PENDIENTE')
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_registro = models.DateField(blank=True, null=True)
    numero_registro = models.CharField(max_length=100, blank=True, null=True)
    respuesta_admin = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.titulo} - {self.vecino.username}"