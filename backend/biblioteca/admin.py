from django.contrib import admin

from .models import Libro, PrestamoLibro


@admin.register(Libro)
class LibroAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'autor', 'categoria', 'isbn', 'disponibilidad', 'activo')
    list_filter = ('activo', 'disponibilidad', 'categoria')
    search_fields = ('titulo', 'autor', 'isbn', 'editorial')


@admin.register(PrestamoLibro)
class PrestamoLibroAdmin(admin.ModelAdmin):
    list_display = ('libro', 'usuario', 'estado', 'fecha_solicitud', 'fecha_prevista_devolucion')
    list_filter = ('estado', 'fecha_solicitud')
    search_fields = ('libro__titulo', 'usuario__username', 'usuario__email')
