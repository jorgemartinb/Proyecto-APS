from django.urls import path
from .views import PropuestaPlenoListCreateView, PropuestaPlenoRetrieveUpdateDestroyView

urlpatterns = [
    path('', PropuestaPlenoListCreateView.as_view(), name='propuesta-list-create'),
    path('<int:pk>/', PropuestaPlenoRetrieveUpdateDestroyView.as_view(), name='propuesta-detail'),
]