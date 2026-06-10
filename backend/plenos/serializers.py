from rest_framework import serializers
from .models import PropuestaPleno

class PropuestaPlenoSerializer(serializers.ModelSerializer):
    vecino_username = serializers.ReadOnlyField(source='vecino.username')
    
    class Meta:
        model = PropuestaPleno
        fields = [
            'id', 'vecino', 'vecino_username', 'titulo', 'descripcion', 
            'estado', 'fecha_creacion', 'fecha_registro', 
            'numero_registro', 'respuesta_admin'
        ]
        read_only_fields = ['vecino', 'fecha_creacion']