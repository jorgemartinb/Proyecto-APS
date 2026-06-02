from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Reservation


class ReservationOverlapTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user_one = User.objects.create_user(username="ana", password="test-pass-123")
        self.user_two = User.objects.create_user(username="luis", password="test-pass-123")
        self.admin = User.objects.create_user(username="admin", password="test-pass-123", is_staff=True)
        self.url = reverse("reservation-list-create")
        self.start_time = timezone.now().replace(second=0, microsecond=0) + timedelta(days=1)
        self.end_time = self.start_time + timedelta(hours=1)

    def test_rejects_overlapping_reservation_from_another_user(self):
        Reservation.objects.create(
            user=self.user_one,
            title="Reserva inicial",
            start_time=self.start_time,
            end_time=self.end_time,
        )

        self.client.force_authenticate(user=self.user_two)
        response = self.client.post(
            self.url,
            {
                "title": "Reserva solapada",
                "start_time": self.start_time.isoformat(),
                "end_time": self.end_time.isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Reservation.objects.count(), 1)

    def test_allows_reservation_after_existing_one_ends(self):
        Reservation.objects.create(
            user=self.user_one,
            title="Reserva inicial",
            start_time=self.start_time,
            end_time=self.end_time,
        )

        self.client.force_authenticate(user=self.user_two)
        response = self.client.post(
            self.url,
            {
                "title": "Reserva posterior",
                "start_time": self.end_time.isoformat(),
                "end_time": (self.end_time + timedelta(hours=1)).isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Reservation.objects.count(), 2)

    def test_list_includes_reservation_owner_username(self):
        Reservation.objects.create(
            user=self.user_one,
            title="Reserva inicial",
            start_time=self.start_time,
            end_time=self.end_time,
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["user_username"], "ana")

    def test_regular_user_cannot_change_reservation_status(self):
        reservation = Reservation.objects.create(
            user=self.user_one,
            title="Reserva inicial",
            start_time=self.start_time,
            end_time=self.end_time,
        )

        self.client.force_authenticate(user=self.user_one)
        response = self.client.patch(
            reverse("reservation-detail", kwargs={"pk": reservation.pk}),
            {"estado": "ACEPTADA"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        reservation.refresh_from_db()
        self.assertEqual(reservation.estado, "PENDIENTE")

    def test_admin_can_change_reservation_status(self):
        reservation = Reservation.objects.create(
            user=self.user_one,
            title="Reserva inicial",
            start_time=self.start_time,
            end_time=self.end_time,
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            reverse("reservation-detail", kwargs={"pk": reservation.pk}),
            {"estado": "ACEPTADA"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        reservation.refresh_from_db()
        self.assertEqual(reservation.estado, "ACEPTADA")

    def test_rejected_reservation_does_not_block_same_time_slot(self):
        Reservation.objects.create(
            user=self.user_one,
            title="Reserva rechazada",
            start_time=self.start_time,
            end_time=self.end_time,
            estado="RECHAZADA",
        )

        self.client.force_authenticate(user=self.user_two)
        response = self.client.post(
            self.url,
            {
                "title": "Reserva nueva",
                "start_time": self.start_time.isoformat(),
                "end_time": self.end_time.isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Reservation.objects.count(), 2)
