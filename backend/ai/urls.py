from django.urls import path
from .views import AIPlanAPIView, AIRegenerateAPIView, AIProviderStatusAPIView, AIChatAPIView

app_name = 'ai'

urlpatterns = [
    path('chat/', AIChatAPIView.as_view(), name='ai-chat'),
    path('plan/', AIPlanAPIView.as_view(), name='ai-plan'),
    path('plan/regenerate/', AIRegenerateAPIView.as_view(), name='ai-regenerate'),
    path('status/', AIProviderStatusAPIView.as_view(), name='ai-status'),
    path('providers/status/', AIProviderStatusAPIView.as_view(), name='ai-providers-status'),
]

