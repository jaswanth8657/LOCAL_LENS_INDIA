from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from pydantic import ValidationError
from drf_spectacular.utils import extend_schema, OpenApiExample
from .services import AITripPlannerService
from .manager import AIManager
from .chat import AIChatbotService

class AIChatAPIView(APIView):
    """
    Conversational Travel Assistant API.
    Interprets user natural language messages, queries database-grounded places,
    or triggers itinerary generation via 3-tier fallback.
    """

    @extend_schema(
        summary="Conversational travel query assistant",
        description="Processes typed or speech-recognized user travel inquiries with database grounding.",
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "message": {"type": "string", "example": "What are the best beaches in Visakhapatnam?"},
                    "destination": {"type": "string", "example": "visakhapatnam"},
                    "history": {"type": "array", "items": {"type": "object"}}
                },
                "required": ["message"]
            }
        },
        responses={200: dict}
    )
    def post(self, request):
        message = request.data.get('message', '').strip()
        if not message:
            return Response({"error": "The 'message' field is required."}, status=status.HTTP_400_BAD_REQUEST)

        destination_slug = request.data.get('destination')
        history = request.data.get('history', [])

        service = AIChatbotService()
        try:
            response_data = service.handle_message(
                message=message,
                destination_slug=destination_slug,
                history=history
            )
            return Response(response_data, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Chatbot processing failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIPlanAPIView(APIView):
    """
    AI Trip Planner API Endpoint.
    Generates a personalized, day-by-day itinerary grounded strictly in verified SQLite places.
    Follows automatic fallback hierarchy: Gemini -> Ollama -> Deterministic Planner.
    """

    @extend_schema(
        summary="Generate AI-powered personalized travel itinerary",
        description="Creates a day-by-day travel plan with verified candidate places, transit estimations, and budget breakdown.",
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "destination": {"type": "string", "example": "visakhapatnam"},
                    "interests": {"type": "array", "items": {"type": "string"}, "example": ["beaches", "culture", "food"]},
                    "budget_per_day": {"type": "integer", "example": 2500},
                    "group_type": {"type": "string", "example": "Duo"},
                    "duration_days": {"type": "integer", "example": 3},
                    "preferred_pace": {"type": "string", "example": "Moderate"},
                    "start_date": {"type": "string", "example": "2026-11-01"},
                    "save_to_db": {"type": "boolean", "example": False}
                },
                "required": ["destination"]
            }
        },
        responses={200: dict}
    )
    def post(self, request):
        service = AITripPlannerService()
        try:
            itinerary = service.generate_itinerary(request.data)
            return Response(itinerary, status=status.HTTP_200_OK)
        except LookupError as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except ValidationError as e:
            return Response({"error": "Invalid trip preferences", "details": e.errors()}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Trip planning failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIRegenerateAPIView(APIView):
    """
    Regenerates an existing itinerary with altered pace or alternate sequence.
    """

    @extend_schema(
        summary="Regenerate travel itinerary",
        description="Regenerates itinerary with fresh place combinations and transit arrangements.",
        request=AIPlanAPIView,
        responses={200: dict}
    )
    def post(self, request):
        service = AITripPlannerService()
        try:
            itinerary = service.generate_itinerary(request.data)
            return Response(itinerary, status=status.HTTP_200_OK)
        except LookupError as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except (ValidationError, ValueError) as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Trip regeneration failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIProviderStatusAPIView(APIView):
    """
    Health check endpoint reporting live status of Gemini, Ollama, and Deterministic engines.
    """

    @extend_schema(
        summary="Check AI providers status and availability",
        description="Returns connection health, configured models, and fallback readiness for Gemini, Ollama, and Deterministic engines.",
        responses={200: dict}
    )
    def get(self, request):
        manager = AIManager()
        status_data = manager.get_providers_status()
        return Response(status_data, status=status.HTTP_200_OK)

