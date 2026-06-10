from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import PropuestaPleno
from .serializers import PropuestaPlenoSerializer

class PropuestaPlenoListCreateView(generics.ListCreateAPIView):
    serializer_class = PropuestaPlenoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff:
            return PropuestaPleno.objects.all().order_by('-fecha_creacion')
        return PropuestaPleno.objects.filter(vecino=self.request.user).order_by('-fecha_creacion')

    def perform_create(self, serializer):
        serializer.save(vecino=self.request.user)

class PropuestaPlenoRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PropuestaPlenoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff:
            return PropuestaPleno.objects.all()
        return PropuestaPleno.objects.filter(vecino=self.request.user)