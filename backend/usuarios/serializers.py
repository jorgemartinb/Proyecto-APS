from django.contrib.auth import get_user_model
from rest_framework import serializers

Usuario = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    password_two = serializers.CharField(write_only=True)

    class Meta:
        model = Usuario
        fields = [
            'id',
            'username',
            'password',
            'password_two',
            'first_name',
            'last_name',
            'email',
            'is_staff',
            'telefono',
            'dni_nif',
            'numero_socio',
            'es_socio',
        ]
        read_only_fields = ['is_staff']

    def validate(self, data):
        if data['password'] != data['password_two']:
            raise serializers.ValidationError({"password_two": "Las contraseñas no coinciden."})
        return data

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'is_staff',
            'telefono',
            'dni_nif',
            'numero_socio',
            'es_socio',
        ]
        read_only_fields = ['id', 'username', 'is_staff', 'numero_socio', 'es_socio']


class AdminUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password_two = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Usuario
        fields = [
            'id',
            'username',
            'password',
            'password_two',
            'first_name',
            'last_name',
            'email',
            'is_staff',
            'telefono',
            'dni_nif',
            'numero_socio',
            'es_socio',
        ]
        read_only_fields = ['id', 'is_staff']

    def validate(self, data):
        password = data.get('password')
        password_two = data.get('password_two')

        if password or password_two:
            if password != password_two:
                raise serializers.ValidationError({"password_two": "Las contraseñas no coinciden."})

        return data

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        validated_data.pop('password_two', None)

        user = Usuario(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        validated_data.pop('password_two', None)

        for field, value in validated_data.items():
            setattr(instance, field, value)

        if password:
            instance.set_password(password)

        instance.save()
        return instance

class UserPasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    new_password_two = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['new_password'] != data['new_password_two']:
            raise serializers.ValidationError({"new_password_two": "La nueva contraseña no coincide."})
        
        request = self.context.get('request')
        if request and not request.user.check_password(data['old_password']):
            raise serializers.ValidationError({"old_password": "La contraseña actual es incorrecta."})
        
        return data
    
class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(help_text="El token de refresco que se va a invalidar.")
