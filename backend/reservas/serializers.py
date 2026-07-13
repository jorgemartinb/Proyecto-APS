from rest_framework import serializers
from .models import Reservation
from django.utils import timezone

class ReservationSerializer(serializers.ModelSerializer):
    user_username = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = Reservation
        fields = [
            'id', 'user', 'user_username', 'title', 'start_time', 'end_time',
            'created_at', 'estado', 'is_recurring', 'recurrence_type'
        ]
        read_only_fields = ['user', 'user_username', 'created_at']

    def validate(self, data):
        start_time = data.get('start_time', self.instance.start_time if self.instance else None)
        end_time = data.get('end_time', self.instance.end_time if self.instance else None)
        request = self.context.get('request')
        is_recurring = data.get('is_recurring', self.instance.is_recurring if self.instance else False)
        recurrence_type = data.get('recurrence_type', self.instance.recurrence_type if self.instance else None)

        if 'estado' in data and request and not request.user.is_staff:
            raise serializers.ValidationError(
                {"estado": "Solo una administradora puede cambiar el estado de una reserva."}
            )

        if is_recurring and not recurrence_type:
            raise serializers.ValidationError(
                {"recurrence_type": "Elige una periodicidad para repetir la cita."}
            )

        if not is_recurring:
            data['recurrence_type'] = None

        if start_time and end_time:
            # 1. Validación de orden cronológico
            if start_time >= end_time:
                raise serializers.ValidationError(
                    {"end_time": "La fecha y hora de fin debe ser posterior a la de inicio."}
                )

            # Solo validamos que sea en el futuro si es una reserva nueva 
            if not self.instance and start_time < timezone.now():
                raise serializers.ValidationError({
                "start_time": "No puedes tramitar una reserva en el pasado. Elige una fecha y hora futura."
            })

            # 2. Validación de solapamiento (Overlap)
            should_check_overlap = not self.instance or 'start_time' in data or 'end_time' in data

            overlaps = Reservation.objects.none()
            if should_check_overlap:
                overlaps = Reservation.objects.exclude(estado='RECHAZADA').filter(
                    start_time__lt=end_time,
                    end_time__gt=start_time
                )

                if self.instance:
                    overlaps = overlaps.exclude(pk=self.instance.pk)

                if overlaps.exists():
                    raise serializers.ValidationError(
                        {"non_field_errors": "Lo sentimos, la sala ya está reservada en ese rango de horarios."}
                    )

        return data
