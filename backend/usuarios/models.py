from django.db import models
from django.contrib.auth.models import AbstractUser
# Create your models here.

class Usuario(AbstractUser):
    telefono = models.CharField(max_length=20, blank=True, null=True)
    dni_nif = models.CharField(max_length=20, blank=True, null=True, unique=True)
    numero_socio = models.CharField(max_length=30, blank=True, null=True, unique=True)
    
    es_socio = models.BooleanField(default=True) 

    def __str__(self):
        return f"{self.username} - {self.first_name} {self.last_name}"
