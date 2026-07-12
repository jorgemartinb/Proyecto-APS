from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    AdminUserListCreateView,
    AdminUserPasswordChangeView,
    AdminUserRetrieveUpdateDestroyView,
    LogoutView,
    UserCreate,
    UserPasswordChangeView,
    UserProfileView,
    UserRequestBajaView,
)

urlpatterns = [
    path('auth/register', UserCreate.as_view(), name='auth_register_no_slash'),
    path('auth/register/', UserCreate.as_view(), name='auth_register'),
    path('auth/login', TokenObtainPairView.as_view(), name='token_obtain_pair_no_slash'),
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh', TokenRefreshView.as_view(), name='token_refresh_no_slash'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout', LogoutView.as_view(), name='auth_logout_no_slash'),
    path('auth/logout/', LogoutView.as_view(), name='auth_logout'),
    path('user/profile', UserProfileView.as_view(), name='user_profile_no_slash'),
    path('user/profile/', UserProfileView.as_view(), name='user_profile'),
    path('user/request-baja', UserRequestBajaView.as_view(), name='user_request_baja_no_slash'),
    path('user/request-baja/', UserRequestBajaView.as_view(), name='user_request_baja'),
    path('user/password-change', UserPasswordChangeView.as_view(), name='user_password_change_no_slash'),
    path('user/password-change/', UserPasswordChangeView.as_view(), name='user_password_change'),
    path('admin/users', AdminUserListCreateView.as_view(), name='admin-user-list-create-no-slash'),
    path('admin/users/', AdminUserListCreateView.as_view(), name='admin-user-list-create'),
    path('admin/users/<int:pk>', AdminUserRetrieveUpdateDestroyView.as_view(), name='admin-user-detail-no-slash'),
    path('admin/users/<int:pk>/', AdminUserRetrieveUpdateDestroyView.as_view(), name='admin-user-detail'),
    path('admin/users/<int:pk>/password', AdminUserPasswordChangeView.as_view(), name='admin-user-password-change-no-slash'),
    path('admin/users/<int:pk>/password/', AdminUserPasswordChangeView.as_view(), name='admin-user-password-change'),
]
