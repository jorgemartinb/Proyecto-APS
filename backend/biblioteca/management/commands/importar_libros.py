from django.core.management.base import BaseCommand, CommandError

from biblioteca.importacion import filas_excel, filas_validacion, importar_filas
from biblioteca.models import Libro


class Command(BaseCommand):
    help = 'Importa el inventario inicial de libros desde la hoja "Hoja 1" del Excel.'

    def add_arguments(self, parser):
        parser.add_argument('excel', nargs='?', help='Ruta al Excel del inventario.')
        parser.add_argument('--sheet', default='Hoja 1')
        parser.add_argument('--usar-listado-validacion', action='store_true')

    def handle(self, *args, **options):
        if options['usar_listado_validacion']:
            filas = filas_validacion()
            fuente = 'listado de validacion'
        else:
            if not options['excel']:
                raise CommandError('Indica la ruta del Excel o usa --usar-listado-validacion.')
            filas = filas_excel(options['excel'], options['sheet'])
            fuente = f'{options["excel"]} / {options["sheet"]}'

        if len(filas) != 44:
            raise CommandError(f'Se esperaban 44 libros y se leyeron {len(filas)} desde {fuente}.')

        creados, actualizados = importar_filas(filas)
        activos = Libro.objects.filter(activo=True).count()
        self.stdout.write(self.style.SUCCESS(
            f'Importacion completada desde {fuente}: {creados} creados, {actualizados} actualizados, {activos} libros activos.'
        ))
