from django.contrib.auth import get_user_model
from rest_framework import serializers

Usuario = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    password_two = serializers.CharField(write_only=True)

    class Meta:
        model = Usuario
        fields = ['username', 'email', 'password', 'password_two', 'first_name', 'last_name']

    def validate(self, data):
        if data['password'] != data['password_two']:
            raise serializers.ValidationError({"password_two": "Las contraseñas no coinciden."})
        return data

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ['username', 'email', 'first_name', 'last_name']
        read_only_fields = ['username'] 

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