from django.urls import path
from .views import ReservationListCreateView, ReservationRetrieveUpdateDestroyView, AdminReservationDeleteView

urlpatterns = [
    path('reservations', ReservationListCreateView.as_view(), name='reservation-list-create-no-slash'),
    path('reservations/', ReservationListCreateView.as_view(), name='reservation-list-create'),
    path('reservations/<int:pk>', ReservationRetrieveUpdateDestroyView.as_view(), name='reservation-detail-no-slash'),
    path('reservations/<int:pk>/', ReservationRetrieveUpdateDestroyView.as_view(), name='reservation-detail'),
    path('admin/reservas/<int:pk>/', AdminReservationDeleteView.as_view(), name='admin-delete-reserva'),
]
