from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class PropuestaPlenoApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="vecina", password="test-pass-123")

    def test_created_propuesta_returns_tracking_number(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse("propuesta-list-create"),
            {
                "titulo": "Arreglo de acera",
                "descripcion": "Hay baldosas sueltas en la calle Mayor 1.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["numero_pedido"], f"PL-{response.data['id']:06d}")
