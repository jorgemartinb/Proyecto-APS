from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import UserCreate, UserProfileView, UserPasswordChangeView, LogoutView

urlpatterns = [
    path('auth/register/', UserCreate.as_view(), name='auth_register'),
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='auth_logout'),
    path('user/profile/', UserProfileView.as_view(), name='user_profile'),
    path('user/password-change/', UserPasswordChangeView.as_view(), name='user_password_change'),
]