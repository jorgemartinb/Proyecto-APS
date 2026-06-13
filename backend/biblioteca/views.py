from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Libro, PrestamoLibro
from .serializers import (
    CrearSolicitudPrestamoSerializer,
    LibroSerializer,
    MotivoRechazoSerializer,
    ObservacionesSerializer,
    PrestamoLibroSerializer,
    aprobar_prestamo,
    devolver_prestamo,
    prestar_prestamo,
    rechazar_prestamo,
)


class LibroListCreateView(generics.ListCreateAPIView):
    serializer_class = LibroSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdminUser()]
        return [AllowAny()]

    def get_queryset(self):
        queryset = Libro.objects.all()
        if not self.request.user.is_staff:
            queryset = queryset.filter(activo=True)

        search = self.request.query_params.get('search', '').strip()
        categoria = self.request.query_params.get('categoria', '').strip()
        disponibilidad = self.request.query_params.get('disponibilidad', '').strip()

        if search:
            queryset = queryset.filter(
                Q(titulo__icontains=search)
                | Q(autor__icontains=search)
                | Q(categoria__icontains=search)
                | Q(isbn__icontains=search)
            )
        if categoria:
            queryset = queryset.filter(categoria=categoria)
        if disponibilidad:
            queryset = queryset.filter(disponibilidad=disponibilidad)
        return queryset


class LibroDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = LibroSerializer

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [IsAdminUser()]
        return [AllowAny()]

    def get_queryset(self):
        queryset = Libro.objects.all()
        if not self.request.user.is_staff:
            queryset = queryset.filter(activo=True)
        return queryset

    def perform_destroy(self, instance):
        instance.activo = False
        instance.disponibilidad = 'NO_DISPONIBLE'
        instance.save(update_fields=['activo', 'disponibilidad', 'fecha_actualizacion'])


class SolicitarPrestamoView(generics.CreateAPIView):
    serializer_class = CrearSolicitudPrestamoSerializer
    permission_classes = [IsAuthenticated]


class MisPrestamosView(generics.ListAPIView):
    serializer_class = PrestamoLibroSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PrestamoLibro.objects.filter(usuario=self.request.user).select_related('usuario', 'libro', 'administradora')


class AdminPrestamosView(generics.ListAPIView):
    serializer_class = PrestamoLibroSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        queryset = PrestamoLibro.objects.select_related('usuario', 'libro', 'administradora')
        estado = self.request.query_params.get('estado', '').strip()
        if estado:
            queryset = queryset.filter(estado=estado)
        if self.request.query_params.get('vencidos') == '1':
            queryset = queryset.filter(
                estado__in=PrestamoLibro.ESTADOS_BLOQUEAN_LIBRO,
                fecha_prevista_devolucion__lt=timezone.now().date(),
            )
        return queryset


class PrestamoDetailView(generics.RetrieveAPIView):
    serializer_class = PrestamoLibroSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = PrestamoLibro.objects.select_related('usuario', 'libro', 'administradora')
        if self.request.user.is_staff:
            return queryset
        return queryset.filter(usuario=self.request.user)


class PrestamoActionView(APIView):
    permission_classes = [IsAdminUser]
    accion = None

    def post(self, request, pk):
        try:
            prestamo = PrestamoLibro.objects.get(pk=pk)
        except PrestamoLibro.DoesNotExist as exc:
            raise NotFound('No se encontro el prestamo.') from exc

        if self.accion == 'aprobar':
            prestamo = aprobar_prestamo(prestamo, request.user)
        elif self.accion == 'prestar':
            serializer = ObservacionesSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            prestamo = prestar_prestamo(prestamo, request.user, serializer.validated_data.get('observaciones', ''))
        elif self.accion == 'rechazar':
            serializer = MotivoRechazoSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            prestamo = rechazar_prestamo(prestamo, request.user, serializer.validated_data.get('motivo_rechazo', ''))
        elif self.accion == 'devolver':
            serializer = ObservacionesSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            prestamo = devolver_prestamo(prestamo, request.user, serializer.validated_data.get('observaciones', ''))
        else:
            return Response({'detail': 'Accion no soportada.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(PrestamoLibroSerializer(prestamo).data)
