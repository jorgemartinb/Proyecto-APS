#!/usr/bin/env bash
# Salir inmediatamente si un comando falla
set -o errexit

# Instalar las dependencias del requirements.txt
pip install -r requirements.txt

# Recopilar los archivos estáticos para que Swagger y el Admin tengan diseño
python manage.py collectstatic --no-input

# Aplicar automáticamente las migraciones en la base de datos de la nube
python manage.py migrate

# Cargar/actualizar el inventario inicial de biblioteca de forma idempotente
python manage.py importar_libros --usar-listado-validacion
