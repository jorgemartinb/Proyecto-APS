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
