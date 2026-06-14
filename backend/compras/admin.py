from django.contrib import admin

from .models import Compra


@admin.register(Compra)
class CompraAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'estado', 'precio_aproximado', 'solicitante', 'fecha_solicitud')
    list_filter = ('estado', 'fecha_solicitud')
    search_fields = ('nombre', 'descripcion', 'solicitante__username', 'solicitante__first_name', 'solicitante__last_name')
