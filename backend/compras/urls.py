from django.urls import path

from .views import CompraActionView, CompraDetailView, CompraListCreateView


urlpatterns = [
    path('compras/', CompraListCreateView.as_view(), name='compra-list-create'),
    path('compras/<int:pk>/', CompraDetailView.as_view(), name='compra-detail'),
    path('admin/compras/<int:pk>/aprobar/', CompraActionView.as_view(accion='aprobar'), name='admin-compra-aprobar'),
    path('admin/compras/<int:pk>/rechazar/', CompraActionView.as_view(accion='rechazar'), name='admin-compra-rechazar'),
    path('admin/compras/<int:pk>/comprado/', CompraActionView.as_view(accion='comprado'), name='admin-compra-comprado'),
]
