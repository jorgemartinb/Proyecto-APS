from rest_framework import generics, status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Compra
from .serializers import (
    CompraSerializer,
    CrearCompraSerializer,
    aprobar_compra,
    marcar_compra_comprada,
    rechazar_compra,
)


def es_socio_activo(user):
    return user.es_socio and user.estado_socio == 'ACEPTADA'


class CompraListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CrearCompraSerializer
        return CompraSerializer

    def get_queryset(self):
        queryset = Compra.objects.select_related('solicitante', 'gestionada_por')
        if self.request.user.is_staff:
            return queryset
        return queryset.filter(solicitante=self.request.user)

    def perform_create(self, serializer):
        if not self.request.user.is_staff and not es_socio_activo(self.request.user):
            raise PermissionDenied('Solo los socios activos y las administradoras pueden crear solicitudes de compra.')
        serializer.save()


class CompraDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = CompraSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = Compra.objects.select_related('solicitante', 'gestionada_por')
        if self.request.user.is_staff:
            return queryset
        return queryset.filter(solicitante=self.request.user)


class CompraActionView(APIView):
    permission_classes = [IsAdminUser]
    accion = None

    def post(self, request, pk):
        try:
            compra = Compra.objects.get(pk=pk)
        except Compra.DoesNotExist as exc:
            raise NotFound('No se encontro la solicitud de compra.') from exc

        if self.accion == 'aprobar':
            compra = aprobar_compra(compra, request.user)
        elif self.accion == 'rechazar':
            compra = rechazar_compra(compra, request.user)
        elif self.accion == 'comprado':
            compra = marcar_compra_comprada(compra, request.user)
        else:
            return Response({'detail': 'Accion no soportada.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(CompraSerializer(compra).data)
