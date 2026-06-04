from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone

class Usuario(AbstractUser):
    # --- Datos Básicos Existentes ---
    telefono = models.CharField(max_length=20, blank=True, null=True)
    dni_nif = models.CharField(max_length=20, blank=True, null=True, unique=True)
    
    # 🆕 Modificado a Integer o string controlado. Usaremos Integer para poder calcular el siguiente correlativo automáticamente.
    numero_socio = models.PositiveIntegerField(blank=True, null=True, unique=True)
    
    # ⏳ OPCIONES DE ESTADO DE SOCIO (Similar a Reservas)
    ESTADOS_SOCIO = [
        ('NO_SOCIO', 'No Socio'),
        ('PENDIENTE', 'Solicitud Pendiente'),
        ('ACEPTADA', 'Socio Activo'),
        ('RECHAZADA', 'Solicitud Rechazada'),
        ('BAJA_SOLICITADA', 'Baja Solicitada'),
    ]
    estado_socio = models.CharField(max_length=20, choices=ESTADOS_SOCIO, default='NO_SOCIO')

    # 🌟 Tu Estrategia: Por defecto se registra como usuario normal (False), cambia a True al rellenar la ficha
    es_socio = models.BooleanField(default=False) 

    # --- 🆕 Nuevos Campos de Gestión Administrativa (Peticiones) ---
    is_alta = models.BooleanField(default=True, verbose_name="¿Está de Alta?")
    recibo_anual_pagado = models.BooleanField(default=False, verbose_name="Recibo Anual Pagado")
    fecha_pago_recibo = models.DateField(blank=True, null=True, verbose_name="Fecha de Pago del Recibo")
    fecha_alta = models.DateField(default=timezone.now, verbose_name="Fecha de Alta")
    fecha_baja = models.DateField(blank=True, null=True, verbose_name="Fecha de Baja")

    # --- 🆕 Nuevos Datos Personales y de Contacto (Extraídos del Excel) ---
    domicilio = models.CharField(max_length=255, blank=True, null=True)
    numero_casa = models.CharField(max_length=10, blank=True, null=True, verbose_name="Número")
    piso = models.CharField(max_length=10, blank=True, null=True)
    letra = models.CharField(max_length=10, blank=True, null=True)
    localidad = models.CharField(max_length=100, default="Tres Cantos", blank=True, null=True)
    codigo_postal = models.CharField(max_length=10, default="28760", blank=True, null=True)
    email_secundario = models.EmailField(blank=True, null=True, verbose_name="Email 2")
    telefono_movil_2 = models.CharField(max_length=20, blank=True, null=True, verbose_name="Teléfono Móvil 2")

    # --- 🆕 Nuevos Datos Bancarios (Extraídos del Excel) ---
    titular_cuenta = models.CharField(max_length=255, blank=True, null=True)
    nif_titular = models.CharField(max_length=20, blank=True, null=True)
    iban = models.CharField(max_length=34, blank=True, null=True)
    entidad_bancaria = models.CharField(max_length=150, blank=True, null=True)

    # --- 🆕 Autorizaciones ---
    autoriza_imagenes = models.BooleanField(default=False, verbose_name="Autoriza publicación de imágenes")

    def save(self, *args, **kwargs):
        # Sincronizamos automáticamente los flags booleanos según el estado de la solicitud
        if self.estado_socio == 'ACEPTADA':
            self.es_socio = True
            self.is_alta = True
        elif self.estado_socio in ['NO_SOCIO', 'RECHAZADA']:
            self.es_socio = False
            self.is_alta = False
        # BAJA_SOLICITADA mantiene es_socio=True hasta que el admin la tramite a NO_SOCIO

        # ⚡ LÓGICA DEL NÚMERO DE SOCIO AUTOMÁTICO Y CORRELATIVO
        # Si el usuario ahora es socio, está de alta y todavía no tiene un número asignado:
        if self.es_socio and self.is_alta and not self.numero_socio:
            # Buscamos el número de socio más alto que exista en la base de datos
            ultimo_usuario = Usuario.objects.filter(numero_socio__isnull=False).order_by('numero_socio').last()
            if ultimo_usuario and ultimo_usuario.numero_socio:
                self.numero_socio = ultimo_usuario.numero_socio + 1
            else:
                self.numero_socio = 1  # Si es el primer socio registrado en el sistema
        
        # Guardamos la fecha de baja si pasa a estar inactivo (Baja)
        if not self.is_alta and not self.fecha_baja:
            self.fecha_baja = timezone.now().date()
        elif self.is_alta:
            self.fecha_baja = None # Si se vuelve a dar de alta, limpiamos la baja

        super().save(*args, **kwargs)

    def __str__(self):
        txt = f"Nº {self.numero_socio} - " if self.numero_socio else "[No Socio] - "
        return f"{txt}{self.username} ({self.first_name} {self.last_name})"