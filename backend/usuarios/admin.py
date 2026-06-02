from django.contrib import admin

# Register your models here.
from .models import Usuario  # Asegúrate de que se llame así tu modelo

admin.site.register(Usuario)