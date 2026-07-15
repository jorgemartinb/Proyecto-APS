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
                "numero_socio": 1,
                "es_socio": True,
                "estado_socio": "ACEPTADA",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = get_user_model().objects.get(username="maria")
        self.assertFalse(created.has_usable_password())
        self.assertEqual(created.numero_socio, 1)

    def test_new_member_without_manual_number_uses_highest_existing_number(self):
        User = get_user_model()
        User.objects.create_user(username="socio101", password="test-pass-123", estado_socio="ACEPTADA", numero_socio=101)
        User.objects.create_user(username="socio3", password="test-pass-123", estado_socio="ACEPTADA", numero_socio=3)
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            reverse("admin-user-list-create"),
            {
                "username": "nuevo",
                "first_name": "Nuevo",
                "last_name": "Socio",
                "email": "nuevo@example.com",
                "telefono": "600000001",
                "dni_nif": "87654321B",
                "es_socio": True,
                "estado_socio": "ACEPTADA",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = User.objects.get(username="nuevo")
        self.assertEqual(created.numero_socio, 102)

    def test_admin_manual_number_reassigns_previous_holder_to_next_highest(self):
        User = get_user_model()
        previous_holder = User.objects.create_user(
            username="socio3",
            password="test-pass-123",
            estado_socio="ACEPTADA",
            numero_socio=3,
        )
        target = User.objects.create_user(
            username="socio101",
            password="test-pass-123",
            estado_socio="ACEPTADA",
            numero_socio=101,
        )
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(
            reverse("admin-user-detail", kwargs={"pk": target.pk}),
            {"numero_socio": 3},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        previous_holder.refresh_from_db()
        target.refresh_from_db()
        self.assertEqual(target.numero_socio, 3)
        self.assertEqual(previous_holder.numero_socio, 102)

    def test_register_requires_strong_password(self):
        response = self.client.post(
            reverse("auth_register"),
            {
                "username": "ana",
                "email": "ana@example.com",
                "password": "sololetras",
                "password_two": "sololetras",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("mínimo 8 caracteres", str(response.data).lower())

    def test_user_can_change_own_password_with_rules(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.put(
            reverse("user_password_change"),
            {
                "old_password": "test-pass-123",
                "new_password": "Nueva1234",
                "new_password_two": "Nueva1234",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Nueva1234"))

    def test_admin_can_force_password_change_without_old_password(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.put(
            reverse("admin-user-password-change", kwargs={"pk": self.user.pk}),
            {
                "new_password": "Forzada123",
                "new_password_two": "Forzada123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Forzada123"))

    def test_admin_force_password_change_rejects_self(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.put(
            reverse("admin-user-password-change", kwargs={"pk": self.admin.pk}),
            {
                "new_password": "Propia123",
                "new_password_two": "Propia123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password("test-pass-123"))
