from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from .models import Libro, PrestamoLibro


class LibroSerializer(serializers.ModelSerializer):
    disponible = serializers.SerializerMethodField()

    class Meta:
        model = Libro
        fields = [
            'id', 'titulo', 'autor', 'editorial', 'categoria', 'isbn', 'etiqueta',
            'disponibilidad', 'disponible', 'activo', 'fecha_creacion', 'fecha_actualizacion',
        ]
        read_only_fields = ['fecha_creacion', 'fecha_actualizacion', 'disponible']

    def get_disponible(self, obj):
        return obj.activo and obj.disponibilidad == 'DISPONIBLE'

    def validate_titulo(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('El titulo es obligatorio.')
        return value

    def validate(self, attrs):
        for field in ['autor', 'editorial', 'categoria', 'isbn', 'etiqueta']:
            if isinstance(attrs.get(field), str):
                attrs[field] = attrs[field].strip()
        if attrs.get('isbn') == '':
            attrs['isbn'] = None
        if attrs.get('etiqueta') == '':
            attrs['etiqueta'] = None
        return attrs


class PrestamoLibroSerializer(serializers.ModelSerializer):
    libro_titulo = serializers.ReadOnlyField(source='libro.titulo')
    libro_autor = serializers.ReadOnlyField(source='libro.autor')
    libro_isbn = serializers.ReadOnlyField(source='libro.isbn')
    usuario_username = serializers.ReadOnlyField(source='usuario.username')
    usuario_nombre = serializers.SerializerMethodField()
    usuario_email = serializers.ReadOnlyField(source='usuario.email')
    usuario_telefono = serializers.ReadOnlyField(source='usuario.telefono')
    usuario_numero_socio = serializers.ReadOnlyField(source='usuario.numero_socio')
    administradora_username = serializers.ReadOnlyField(source='administradora.username')

    class Meta:
        model = PrestamoLibro
        fields = [
            'id', 'usuario', 'usuario_username', 'usuario_nombre', 'usuario_email',
            'usuario_telefono', 'usuario_numero_socio', 'libro', 'libro_titulo',
            'libro_autor', 'libro_isbn', 'fecha_solicitud', 'estado',
            'fecha_aprobacion', 'fecha_rechazo', 'administradora', 'administradora_username',
            'motivo_rechazo', 'fecha_entrega', 'fecha_prevista_devolucion',
            'fecha_devolucion', 'observaciones', 'fecha_creacion', 'fecha_actualizacion',
        ]
        read_only_fields = fields

    def get_usuario_nombre(self, obj):
        nombre = f'{obj.usuario.first_name} {obj.usuario.last_name}'.strip()
        return nombre or obj.usuario.username


class CrearSolicitudPrestamoSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrestamoLibro
        fields = ['id', 'libro', 'observaciones']

    def validate(self, attrs):
        usuario = self.context['request'].user
        libro = attrs['libro']

        if not usuario.es_socio or usuario.estado_socio != 'ACEPTADA':
            raise serializers.ValidationError('Solo los socios activos pueden solicitar prestamos de libros.')
        if not libro.activo:
            raise serializers.ValidationError('Este libro esta inactivo.')
        if libro.disponibilidad != 'DISPONIBLE':
            raise serializers.ValidationError('Este libro no esta disponible.')
        if PrestamoLibro.objects.filter(
            usuario=usuario,
            libro=libro,
            estado__in=PrestamoLibro.ESTADOS_ACTIVOS_USUARIO,
        ).exists():
            raise serializers.ValidationError('Ya tienes una solicitud activa para este libro.')
        if PrestamoLibro.objects.filter(
            libro=libro,
            estado__in=PrestamoLibro.ESTADOS_BLOQUEAN_LIBRO,
        ).exists():
            raise serializers.ValidationError('Este libro ya esta prestado o aprobado.')
        return attrs

    def create(self, validated_data):
        try:
            return PrestamoLibro.objects.create(usuario=self.context['request'].user, **validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError('Ya existe una solicitud activa para este libro.') from exc


class MotivoRechazoSerializer(serializers.Serializer):
    motivo_rechazo = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class ObservacionesSerializer(serializers.Serializer):
    observaciones = serializers.CharField(required=False, allow_blank=True, allow_null=True)


def aprobar_prestamo(prestamo, administradora):
    with transaction.atomic():
        prestamo = PrestamoLibro.objects.select_for_update().get(pk=prestamo.pk)
        libro = Libro.objects.select_for_update().get(pk=prestamo.libro_id)

        if prestamo.estado != 'PENDIENTE':
            raise serializers.ValidationError('Solo se pueden aprobar solicitudes pendientes.')
        if not libro.activo or libro.disponibilidad != 'DISPONIBLE':
            raise serializers.ValidationError('El libro ya no esta disponible.')
        if PrestamoLibro.objects.filter(
            libro=libro,
            estado__in=PrestamoLibro.ESTADOS_BLOQUEAN_LIBRO,
        ).exclude(pk=prestamo.pk).exists():
            raise serializers.ValidationError('Este libro ya tiene un prestamo activo.')

        ahora = timezone.now()
        prestamo.estado = 'APROBADA'
        prestamo.fecha_aprobacion = ahora
        prestamo.fecha_prevista_devolucion = prestamo.fecha_devolucion_15_dias(ahora)
        prestamo.administradora = administradora
        prestamo.save()

        libro.disponibilidad = 'NO_DISPONIBLE'
        libro.save(update_fields=['disponibilidad', 'fecha_actualizacion'])
        return prestamo


def prestar_prestamo(prestamo, administradora, observaciones=''):
    if prestamo.estado == 'PENDIENTE':
        prestamo = aprobar_prestamo(prestamo, administradora)

    with transaction.atomic():
        prestamo = PrestamoLibro.objects.select_for_update().get(pk=prestamo.pk)
        if prestamo.estado != 'APROBADA':
            raise serializers.ValidationError('Solo se pueden entregar prestamos aprobados.')
        ahora = timezone.now()
        prestamo.estado = 'PRESTADA'
        prestamo.fecha_entrega = ahora
        prestamo.fecha_prevista_devolucion = prestamo.fecha_devolucion_15_dias(ahora)
        prestamo.administradora = administradora
        if observaciones is not None:
            prestamo.observaciones = observaciones
        prestamo.save()
        return prestamo


def rechazar_prestamo(prestamo, administradora, motivo=''):
    with transaction.atomic():
        prestamo = PrestamoLibro.objects.select_for_update().select_related('libro').get(pk=prestamo.pk)
        if prestamo.estado not in ['PENDIENTE', 'APROBADA']:
            raise serializers.ValidationError('Este prestamo no se puede rechazar.')

        liberaba_libro = prestamo.estado == 'APROBADA'
        prestamo.estado = 'RECHAZADA'
        prestamo.fecha_rechazo = timezone.now()
        prestamo.administradora = administradora
        prestamo.motivo_rechazo = motivo or ''
        prestamo.save()

        if liberaba_libro:
            prestamo.libro.disponibilidad = 'DISPONIBLE'
            prestamo.libro.save(update_fields=['disponibilidad', 'fecha_actualizacion'])
        return prestamo


def devolver_prestamo(prestamo, administradora, observaciones=''):
    with transaction.atomic():
        prestamo = PrestamoLibro.objects.select_for_update().select_related('libro').get(pk=prestamo.pk)
        if prestamo.estado not in PrestamoLibro.ESTADOS_BLOQUEAN_LIBRO:
            raise serializers.ValidationError('Solo se pueden devolver prestamos aprobados o prestados.')

        prestamo.estado = 'DEVUELTA'
        prestamo.fecha_devolucion = timezone.now()
        prestamo.administradora = administradora
        if observaciones is not None:
            prestamo.observaciones = observaciones
        prestamo.save()

        prestamo.libro.disponibilidad = 'DISPONIBLE'
        prestamo.libro.save(update_fields=['disponibilidad', 'fecha_actualizacion'])
        return prestamo
