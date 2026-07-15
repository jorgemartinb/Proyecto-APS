from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

Usuario = get_user_model()

PASSWORD_RULE_MESSAGE = "La contraseña debe tener mínimo 8 caracteres e incluir letras y números."


def validate_password_strength(password):
    if len(password) < 8 or not any(char.isalpha() for char in password) or not any(char.isdigit() for char in password):
        raise serializers.ValidationError(PASSWORD_RULE_MESSAGE)
    return password


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    password_two = serializers.CharField(write_only=True)

    class Meta:
        model = Usuario
        fields = [
            'id', 'username', 'password', 'password_two', 
            'first_name', 'last_name', 'email', 'telefono', 'dni_nif'
        ]

    def validate(self, data):
        if data['password'] != data['password_two']:
            raise serializers.ValidationError({"password_two": "Las contraseñas no coinciden."})
        validate_password_strength(data['password'])
        return data


# Este serializer se encargará de mostrar y permitir rellenar la ficha de inscripción del Socio
class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'telefono', 'dni_nif', 'fecha_nacimiento',
            'es_socio', 'numero_socio', 'is_alta', 'estado_socio', 'recibo_anual_pagado', 'fecha_pago_recibo',
            'domicilio', 'numero_casa', 'piso', 'letra', 'localidad', 'codigo_postal',
            'email_secundario', 'telefono_movil_2', 'titular_cuenta', 'nif_titular', 
            'iban', 'entidad_bancaria', 'banco_entidad', 'banco_sucursal', 'banco_dc', 'banco_cuenta',
            'familiares', 'es_socio_otras_asoc', 'cuales_otras_asoc', 'autoriza_imagenes', 'is_staff'
        ]
        # Protegemos los campos administrativos para que el socio común no se los auto-apruebe
        read_only_fields = [
            'id', 'username', 'is_staff', 'numero_socio',
            'es_socio', 'is_alta', 'estado_socio', 'recibo_anual_pagado', 'fecha_pago_recibo'
        ]


# Este serializer le da todo el poder al Admin para buscar, crear, editar altas/bajas y recibos
class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        exclude = ['password']
        read_only_fields = ['id']
        extra_kwargs = {
            'numero_socio': {'validators': []},
        }

    def _estado_permite_numero_socio(self, validated_data, current_user=None):
        default_estado = current_user.estado_socio if current_user else Usuario._meta.get_field('estado_socio').get_default()
        estado_socio = validated_data.get('estado_socio', default_estado)
        return estado_socio not in ['NO_SOCIO', 'RECHAZADA']

    def _reassign_conflicting_numero_socio(self, numero_socio, current_user=None):
        if not numero_socio:
            return

        queryset = Usuario.objects.filter(numero_socio=numero_socio)
        if current_user and current_user.pk:
            queryset = queryset.exclude(pk=current_user.pk)

        conflicting_user = queryset.first()
        if not conflicting_user:
            return

        conflicting_user.numero_socio = Usuario.get_next_numero_socio()
        conflicting_user.save()

    def create(self, validated_data):
        # Cuando el admin crea un usuario manualmente, lo creamos sin contraseña asignada por seguridad.
        with transaction.atomic():
            if self._estado_permite_numero_socio(validated_data):
                self._reassign_conflicting_numero_socio(validated_data.get('numero_socio'))
            user = Usuario(**validated_data)
            user.set_unusable_password()
            user.save()
            return user

    def update(self, instance, validated_data):
        with transaction.atomic():
            if 'numero_socio' in validated_data and self._estado_permite_numero_socio(validated_data, current_user=instance):
                self._reassign_conflicting_numero_socio(validated_data.get('numero_socio'), current_user=instance)
            return super().update(instance, validated_data)

class UserPasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    new_password_two = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['new_password'] != data['new_password_two']:
            raise serializers.ValidationError({"new_password_two": "La nueva contraseña no coincide."})
        validate_password_strength(data['new_password'])
        request = self.context.get('request')
        if request and not request.user.check_password(data['old_password']):
            raise serializers.ValidationError({"old_password": "La contraseña actual es incorrecta."})
        return data


class AdminUserPasswordChangeSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True)
    new_password_two = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['new_password'] != data['new_password_two']:
            raise serializers.ValidationError({"new_password_two": "La nueva contraseña no coincide."})
        validate_password_strength(data['new_password'])
        return data
    
class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(help_text="El token de refresco que se va a invalidar.")
