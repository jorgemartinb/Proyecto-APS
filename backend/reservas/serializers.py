from rest_framework import serializers
from .models import Reservation
from django.utils import timezone

class ReservationSerializer(serializers.ModelSerializer):
    user_username = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = Reservation
        fields = ['id', 'user', 'title', 'start_time', 'end_time', 'created_at', 'estado']        
        read_only_fields = ['user']

    def validate(self, data):
        start_time = data.get('start_time', self.instance.start_time if self.instance else None)
        end_time = data.get('end_time', self.instance.end_time if self.instance else None)

        if start_time and end_time:
            # 1. Validación de orden cronológico
            if start_time >= end_time:
                raise serializers.ValidationError(
                    {"end_time": "La fecha y hora de fin debe ser posterior a la de inicio."}
                )
            
            if start_time < timezone.now():
                raise serializers.ValidationError({
                "start_time": "No puedes tramitar una reserva en el pasado. Elige una fecha y hora futura."
            })

            # 2. Validación de solapamiento (Overlap)
            overlaps = Reservation.objects.filter(
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