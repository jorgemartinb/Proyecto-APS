# Proyecto-APS

## Biblioteca

Migraciones e importacion del inventario inicial:

```bash
cd backend
source /home/javimendozagr/DEEP_LEARNING/.venv/bin/activate
python manage.py migrate
python manage.py importar_libros --usar-listado-validacion
```

Si tienes el Excel real, usa:

```bash
python manage.py importar_libros "/ruta/INVENTARIO DE LIBROS - BIBILOTECA FEMINISTA.xlsx"
```

El importador lee la hoja `Hoja 1`, espera 44 libros, no usa la hoja `PRESTAMOS`, conserva el ISBN como texto y es idempotente.

## Enlace web
https://proyecto-aps-ten.vercel.app/