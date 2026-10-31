from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import UserProfile

class UserProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    savedTripsCount = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            'id',
            'username',
            'email',
            'name',
            'interests',
            'budget_per_day',
            'group_type',
            'group_size',
            'preferred_destinations',
            'theme_preference',
            'savedTripsCount',
            'created_at',
            'updated_at',
        ]

    def get_savedTripsCount(self, obj) -> int:
        return obj.user.itineraries.count()


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = [
            'name',
            'interests',
            'budget_per_day',
            'group_type',
            'group_size',
            'preferred_destinations',
            'theme_preference',
        ]


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=True, trim_whitespace=True)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    confirm_password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})

    def validate_email(self, value):
        email_clean = value.strip().lower()
        if User.objects.filter(email__iexact=email_clean).exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        return email_clean

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        # Run Django's password validation
        validate_password(attrs['password'])
        return attrs

    def create(self, validated_data):
        email = validated_data['email']
        name = validated_data['name']
        password = validated_data['password']

        # Derive a clean username from email if not provided
        base_username = email.split('@')[0][:30]
        username = base_username
        suffix = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}_{suffix}"
            suffix += 1

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=name
        )

        profile = getattr(user, 'profile', None)
        if not profile:
            profile = UserProfile.objects.create(user=user, name=name)
        else:
            profile.name = name
            profile.save()

        return user


class LoginSerializer(serializers.Serializer):
    email_or_username = serializers.CharField(required=True, trim_whitespace=True)
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})

    def validate(self, attrs):
        login_val = attrs.get('email_or_username', '').strip()
        password = attrs.get('password', '')

        user = None
        # Try authenticate by username first
        user = authenticate(username=login_val, password=password)

        # If not, try find by email
        if not user and '@' in login_val:
            user_by_email = User.objects.filter(email__iexact=login_val).first()
            if user_by_email:
                user = authenticate(username=user_by_email.username, password=password)

        if not user:
            raise serializers.ValidationError("Invalid credentials. Please verify your email/username and password.")

        if not user.is_active:
            raise serializers.ValidationError("This user account is inactive.")

        attrs['user'] = user
        return attrs

