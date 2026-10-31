from django.urls import path
from .views import (
    RegisterAPIView,
    LoginAPIView,
    LogoutAPIView,
    UserProfileAPIView,
)

urlpatterns = [
    path('register/', RegisterAPIView.as_view(), name='account-register'),
    path('login/', LoginAPIView.as_view(), name='account-login'),
    path('logout/', LogoutAPIView.as_view(), name='account-logout'),
    path('profile/', UserProfileAPIView.as_view(), name='account-profile'),
]

