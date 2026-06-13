from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .importacion import filas_validacion, importar_filas
from .models import Libro, PrestamoLibro


class PrestamosLibrosTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.socio = User.objects.create_user(username='socia', password='pass123', estado_socio='ACEPTADA')
        self.no_socio = User.objects.create_user(username='vecina', password='pass123')
        self.admin = User.objects.create_user(username='admin', password='pass123', is_staff=True)
        self.libro = Libro.objects.create(titulo='Brujas', autor='Mona Chollet', isbn='9788466665612')

    def test_socio_puede_solicitar_libro_disponible(self):
        self.client.force_authenticate(self.socio)
        response = self.client.post(reverse('prestamo-libro-solicitar'), {'libro': self.libro.id}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PrestamoLibro.objects.count(), 1)

    def test_no_socio_no_puede_solicitar(self):
        self.client.force_authenticate(self.no_socio)
        response = self.client.post(reverse('prestamo-libro-solicitar'), {'libro': self.libro.id}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_aprobar_bloquea_libro_y_calcula_15_dias(self):
        prestamo = PrestamoLibro.objects.create(usuario=self.socio, libro=self.libro)
        self.client.force_authenticate(self.admin)

        response = self.client.post(reverse('admin-prestamo-aprobar', kwargs={'pk': prestamo.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        prestamo.refresh_from_db()
        self.libro.refresh_from_db()
        self.assertEqual(prestamo.estado, 'APROBADA')
        self.assertEqual(prestamo.fecha_prevista_devolucion, (prestamo.fecha_aprobacion + timedelta(days=15)).date())
        self.assertEqual(self.libro.disponibilidad, 'NO_DISPONIBLE')

    def test_no_aprueba_dos_prestamos_del_mismo_libro(self):
        User = get_user_model()
        otra_socia = User.objects.create_user(username='otra', password='pass123', estado_socio='ACEPTADA')
        primero = PrestamoLibro.objects.create(usuario=self.socio, libro=self.libro)
        segundo = PrestamoLibro.objects.create(usuario=otra_socia, libro=self.libro)
        self.client.force_authenticate(self.admin)

        self.assertEqual(self.client.post(reverse('admin-prestamo-aprobar', kwargs={'pk': primero.id})).status_code, 200)
        response = self.client.post(reverse('admin-prestamo-aprobar', kwargs={'pk': segundo.id}))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_devolver_libera_libro(self):
        prestamo = PrestamoLibro.objects.create(usuario=self.socio, libro=self.libro, estado='PRESTADA')
        self.libro.disponibilidad = 'NO_DISPONIBLE'
        self.libro.save()
        self.client.force_authenticate(self.admin)

        response = self.client.post(reverse('admin-prestamo-devolver', kwargs={'pk': prestamo.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.libro.refresh_from_db()
        prestamo.refresh_from_db()
        self.assertEqual(self.libro.disponibilidad, 'DISPONIBLE')
        self.assertEqual(prestamo.estado, 'DEVUELTA')


class ImportacionLibrosTests(APITestCase):
    def test_importa_44_libros_y_respeta_isbn_texto_y_vacio(self):
        creados, actualizados = importar_filas(filas_validacion())

        self.assertEqual(creados, 44)
        self.assertEqual(actualizados, 0)
        self.assertEqual(Libro.objects.filter(activo=True).count(), 44)
        self.assertEqual(Libro.objects.get(titulo='Mujeres grafiteando').isbn, 'Edición independiente')
        self.assertIsNone(Libro.objects.get(titulo='La otra mitad de la ciencia').isbn)

    def test_importacion_es_idempotente(self):
        importar_filas(filas_validacion())
        creados, actualizados = importar_filas(filas_validacion())

        self.assertEqual(creados, 0)
        self.assertEqual(actualizados, 44)
        self.assertEqual(Libro.objects.count(), 44)
