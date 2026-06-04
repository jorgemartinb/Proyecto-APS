from django.contrib.auth import get_user_model
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from .serializers import (
    AdminUserSerializer,
    LogoutSerializer,
    UserPasswordChangeSerializer,
    UserProfileSerializer,
    UserSerializer,
)

Usuario = get_user_model()

class UserCreate(generics.CreateAPIView):
    queryset = Usuario.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data
        validated_data.pop('password_two', None) # Usamos pop con None por seguridad
        
        # Al crearse con create_user, nacerá con es_socio=False por defecto tal como querías
        user = Usuario.objects.create_user(**validated_data)
        
        # Devolvemos los datos limpios de la respuesta
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

# 👑 Permite al administrador listar y editar los nuevos campos (is_alta, recibos, etc.)
class AdminUserListCreateView(generics.ListCreateAPIView):
    queryset = Usuario.objects.order_by('last_name', 'first_name', 'username')
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminUser]


class AdminUserRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Usuario.objects.all()
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminUser]


# El propio usuario utilizará esta vista para rellenar su ficha completa y "Darse de Alta"
class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        serializer = UserProfileSerializer(user)
        return Response(serializer.data)

    def put(self, request):
        user = request.user
        # Permitimos actualizar sus datos del Excel
        serializer = UserProfileSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            # Al rellenar la ficha por primera vez o tras un rechazo previo, 
            # lanzamos la solicitud de socio (PENDIENTE)
            if user.estado_socio in ['NO_SOCIO', 'RECHAZADA']:
                user.estado_socio = 'PENDIENTE'
                user.save()
            
            instance = serializer.save()
            
            # Devolvemos el perfil actualizado completo
            return Response(UserProfileSerializer(instance).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserRequestBajaView(APIView):
    """
    Permite a un socio activo solicitar su baja del sistema.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not user.es_socio or user.estado_socio != 'ACEPTADA':
            return Response(
                {"detail": "Solo los socios activos pueden solicitar la baja."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.estado_socio = 'BAJA_SOLICITADA'
        user.save()
        return Response({"detail": "Solicitud de baja enviada. El administrador la procesará pronto."})


class UserPasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        user = request.user
        serializer = UserPasswordChangeSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            new_password = serializer.validated_data.get('new_password')
            user.set_password(new_password)
            user.save()
            return Response({"message": "Contraseña actualizada correctamente."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh', None)
            if not refresh_token:
                return Response({"detail": "No se recibio el token de sesion."}, status=status.HTTP_400_BAD_REQUEST)
            
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"detail": "Sesion cerrada correctamente."}, status=status.HTTP_205_RESET_CONTENT)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)