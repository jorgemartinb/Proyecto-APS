from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Compra


class ComprasTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.socio = User.objects.create_user(username='socia', password='pass123', estado_socio='ACEPTADA')
        self.no_socio = User.objects.create_user(username='vecina', password='pass123')
        self.admin = User.objects.create_user(username='admin', password='pass123', is_staff=True)

    def test_socio_activo_puede_crear_solicitud(self):
        self.client.force_authenticate(self.socio)

        response = self.client.post(
            reverse('compra-list-create'),
            {'nombre': 'Cafetera', 'precio_aproximado': '29.90', 'descripcion': 'Para eventos'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Compra.objects.count(), 1)
        self.assertEqual(Compra.objects.get().estado, 'SOLICITADO')

    def test_no_socio_no_puede_crear_solicitud(self):
        self.client.force_authenticate(self.no_socio)

        response = self.client.post(
            reverse('compra-list-create'),
            {'nombre': 'Tazas', 'precio_aproximado': '10.00'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_socio_solo_ve_sus_solicitudes(self):
        Compra.objects.create(nombre='Papel', precio_aproximado=Decimal('4.50'), solicitante=self.socio)
        Compra.objects.create(nombre='Rotuladores', precio_aproximado=Decimal('8.00'), solicitante=self.admin)
        self.client.force_authenticate(self.socio)

        response = self.client.get(reverse('compra-list-create'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['nombre'], 'Papel')

    def test_admin_puede_aprobar_y_ver_todo(self):
        compra = Compra.objects.create(nombre='Cables', precio_aproximado=Decimal('12.00'), solicitante=self.socio)
        self.client.force_authenticate(self.admin)

        response = self.client.post(reverse('admin-compra-aprobar', kwargs={'pk': compra.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        compra.refresh_from_db()
        self.assertEqual(compra.estado, 'APROBADO')

        listado = self.client.get(reverse('compra-list-create'))
        self.assertEqual(listado.status_code, status.HTTP_200_OK)
        self.assertEqual(len(listado.data), 1)

    def test_admin_puede_marcar_como_comprado_y_borrar(self):
        compra = Compra.objects.create(nombre='Archivador', precio_aproximado=Decimal('15.00'), solicitante=self.socio, estado='APROBADO')
        self.client.force_authenticate(self.admin)

        comprado = self.client.post(reverse('admin-compra-comprado', kwargs={'pk': compra.id}))
        self.assertEqual(comprado.status_code, status.HTTP_200_OK)
        compra.refresh_from_db()
        self.assertEqual(compra.estado, 'COMPRADO')

        borrado = self.client.delete(reverse('compra-detail', kwargs={'pk': compra.id}))
        self.assertEqual(borrado.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Compra.objects.count(), 0)
