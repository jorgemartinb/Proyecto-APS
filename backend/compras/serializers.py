from rest_framework import serializers

from .models import Compra


class CompraSerializer(serializers.ModelSerializer):
    solicitante_username = serializers.ReadOnlyField(source='solicitante.username')
    solicitante_nombre = serializers.SerializerMethodField()
    gestionada_por_username = serializers.ReadOnlyField(source='gestionada_por.username')

    class Meta:
        model = Compra
        fields = [
            'id', 'nombre', 'precio_aproximado', 'solicitante', 'solicitante_username',
            'solicitante_nombre', 'fecha_solicitud', 'estado', 'descripcion',
            'gestionada_por', 'gestionada_por_username', 'fecha_creacion', 'fecha_actualizacion',
        ]
        read_only_fields = [
            'id', 'solicitante', 'solicitante_username', 'solicitante_nombre',
            'fecha_solicitud', 'gestionada_por', 'gestionada_por_username',
            'fecha_creacion', 'fecha_actualizacion',
        ]

    def get_solicitante_nombre(self, obj):
        nombre = f'{obj.solicitante.first_name} {obj.solicitante.last_name}'.strip()
        return nombre or obj.solicitante.username

    def validate_nombre(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('El nombre del objeto es obligatorio.')
        return value

    def validate_precio_aproximado(self, value):
        if value < 0:
            raise serializers.ValidationError('El precio aproximado no puede ser negativo.')
        return value

    def validate_descripcion(self, value):
        if value is None:
            return value
        value = value.strip()
        return value or None


class CrearCompraSerializer(CompraSerializer):
    class Meta(CompraSerializer.Meta):
        read_only_fields = CompraSerializer.Meta.read_only_fields

    def create(self, validated_data):
        request = self.context['request']
        user = request.user

        if user.is_staff:
            validated_data.setdefault('estado', 'APROBADO')
        else:
            validated_data['estado'] = 'SOLICITADO'

        return Compra.objects.create(solicitante=user, **validated_data)


def aprobar_compra(compra, administradora):
    if compra.estado != 'SOLICITADO':
        raise serializers.ValidationError('Solo se pueden aprobar solicitudes en estado solicitado.')

    compra.estado = 'APROBADO'
    compra.gestionada_por = administradora
    compra.save(update_fields=['estado', 'gestionada_por', 'fecha_actualizacion'])
    return compra


def rechazar_compra(compra, administradora):
    if compra.estado not in ['SOLICITADO', 'APROBADO']:
        raise serializers.ValidationError('Solo se pueden rechazar solicitudes pendientes o aprobadas.')

    compra.estado = 'RECHAZADO'
    compra.gestionada_por = administradora
    compra.save(update_fields=['estado', 'gestionada_por', 'fecha_actualizacion'])
    return compra


def marcar_compra_comprada(compra, administradora):
    if compra.estado not in ['SOLICITADO', 'APROBADO']:
        raise serializers.ValidationError('Solo se pueden marcar como comprados los objetos pendientes o aprobados.')

    compra.estado = 'COMPRADO'
    compra.gestionada_por = administradora
    compra.save(update_fields=['estado', 'gestionada_por', 'fecha_actualizacion'])
    return compra
