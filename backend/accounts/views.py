from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.authtoken.models import Token
from drf_spectacular.utils import extend_schema
from trips.models import Itinerary
from trips.serializers import ItinerarySerializer
from .models import UserProfile
from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    UserProfileSerializer,
    ProfileUpdateSerializer,
)

class RegisterAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        summary="Register a new user account",
        request=RegisterSerializer,
        responses={201: dict}
    )
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        profile = getattr(user, 'profile', None)

        return Response({
            "message": "Account created successfully.",
            "token": token.key,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "name": profile.name if profile else user.first_name,
            },
            "profile": UserProfileSerializer(profile).data if profile else None
        }, status=status.HTTP_201_CREATED)


class LoginAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        summary="Authenticate user and return auth token",
        request=LoginSerializer,
        responses={200: dict}
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.validated_data['user']
        token, _ = Token.objects.get_or_create(user=user)
        profile = getattr(user, 'profile', None)

        return Response({
            "message": "Login successful.",
            "token": token.key,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "name": profile.name if profile else user.first_name,
            },
            "profile": UserProfileSerializer(profile).data if profile else None
        }, status=status.HTTP_200_OK)


class LogoutAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(summary="Logout user and invalidate auth token")
    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response({"message": "Successfully logged out."}, status=status.HTTP_200_OK)


class UserProfileAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(summary="Get current user profile and preferences")
    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        return Response(UserProfileSerializer(profile).data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Update all user profile preferences and theme",
        request=ProfileUpdateSerializer,
        responses={200: UserProfileSerializer}
    )
    def put(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        serializer = ProfileUpdateSerializer(profile, data=request.data, partial=False)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        serializer.save()
        if 'name' in serializer.validated_data:
            request.user.first_name = serializer.validated_data['name']
            request.user.save(update_fields=['first_name'])

        return Response(UserProfileSerializer(profile).data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Partially update user profile preferences and theme",
        request=ProfileUpdateSerializer,
        responses={200: UserProfileSerializer}
    )
    def patch(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        serializer = ProfileUpdateSerializer(profile, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        serializer.save()
        if 'name' in serializer.validated_data:
            request.user.first_name = serializer.validated_data['name']
            request.user.save(update_fields=['first_name'])

        return Response(UserProfileSerializer(profile).data, status=status.HTTP_200_OK)


