from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class UserApiTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="socia", password="test-pass-123")
        self.admin = User.objects.create_user(username="admin", password="test-pass-123", is_staff=True)

    def test_profile_includes_staff_and_member_fields(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(reverse("user_profile"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_staff"])
        self.assertIn("telefono", response.data)
        self.assertIn("numero_socio", response.data)

    def test_regular_user_cannot_list_admin_users(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(reverse("admin-user-list-create"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_manual_member_without_password(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            reverse("admin-user-list-create"),
            {
                "username": "maria",
                "first_name": "Maria",
                "last_name": "Lopez",
                "email": "maria@example.com",
                "telefono": "600123123",
                "dni_nif": "12345678A",
                "numero_socio": "SOC-001",
                "es_socio": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = get_user_model().objects.get(username="maria")
        self.assertFalse(created.has_usable_password())
        self.assertEqual(created.numero_socio, "SOC-001")
