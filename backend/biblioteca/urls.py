from django.urls import path

from .views import (
    AdminPrestamosView,
    LibroDetailView,
    LibroListCreateView,
    MisPrestamosView,
    PrestamoActionView,
    PrestamoDetailView,
    SolicitarPrestamoView,
)

urlpatterns = [
    path('libros/', LibroListCreateView.as_view(), name='libro-list-create'),
    path('libros/<int:pk>/', LibroDetailView.as_view(), name='libro-detail'),
    path('prestamos/libros/solicitar/', SolicitarPrestamoView.as_view(), name='prestamo-libro-solicitar'),
    path('prestamos/libros/mios/', MisPrestamosView.as_view(), name='mis-prestamos-libros'),
    path('prestamos/libros/<int:pk>/', PrestamoDetailView.as_view(), name='prestamo-libro-detail'),
    path('admin/prestamos/libros/', AdminPrestamosView.as_view(), name='admin-prestamos-libros'),
    path('admin/prestamos/libros/<int:pk>/aprobar/', PrestamoActionView.as_view(accion='aprobar'), name='admin-prestamo-aprobar'),
    path('admin/prestamos/libros/<int:pk>/prestar/', PrestamoActionView.as_view(accion='prestar'), name='admin-prestamo-prestar'),
    path('admin/prestamos/libros/<int:pk>/rechazar/', PrestamoActionView.as_view(accion='rechazar'), name='admin-prestamo-rechazar'),
    path('admin/prestamos/libros/<int:pk>/devolver/', PrestamoActionView.as_view(accion='devolver'), name='admin-prestamo-devolver'),
]
