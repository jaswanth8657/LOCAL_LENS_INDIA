import re
import logging
from typing import Dict, Any, List, Optional
from destinations.models import Destination
from places.models import Place
from recommendations.services import RecommendationService
from .schemas import TripPreferencesInput
from .manager import AIManager
from .services import AITripPlannerService
from .prompts import SYSTEM_INSTRUCTION

logger = logging.getLogger(__name__)

CHAT_SYSTEM_PROMPT = """You are the Senior Local Guide for "LOCAL LENS INDIA" (Tagline: Experience Like a Local).
You provide authentic, culturally rich, realistic travel recommendations for Indian destinations.

STRICT GROUNDING RULES:
1. ONLY recommend and reference places present in the VERIFIED PLACES list below.
2. NEVER fabricate attractions, street names, fake ticket prices, or fake opening hours.
3. If entry fee or opening hours are unavailable, clearly state that rather than guessing.
4. Keep answers engaging, structured, practical, and helpful (e.g. highlight best timings, attire, street foods, transit advice).
5. Always respond in text only.
"""

class AIChatbotService:
    """
    Conversational Travel Assistant for LOCAL LENS INDIA.
    Answers natural language queries about destinations, food, heritage, budget, and itineraries
    by grounding directly against SQLite places and Phase 4/Phase 5 AI services.
    """

    def __init__(self):
        self.ai_manager = AIManager()
        self.recs_service = RecommendationService()
        self.planner_service = AITripPlannerService()

    def handle_message(
        self,
        message: str,
        destination_slug: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        clean_msg = message.strip()
        if not clean_msg:
            raise ValueError("Message cannot be empty.")

        # 1. Resolve Destination
        dest = self._resolve_destination(clean_msg, destination_slug)

        # 2. Detect Intent: Is the user requesting a multi-day itinerary plan?
        is_itinerary_request = self._is_itinerary_intent(clean_msg)

        if is_itinerary_request and dest:
            return self._handle_itinerary_request(clean_msg, dest)

        # 3. Destination Query (e.g. "What destinations are available?" or "Tell me about Kochi")
        if not dest and any(w in clean_msg.lower() for w in ['destination', 'destinations', 'where can i go', 'places to visit in india', 'cities']):
            return self._handle_general_destinations_query()

        # 4. If destination is found, fetch verified places and answer with database grounding
        if dest:
            return self._handle_grounded_place_query(clean_msg, dest, history or [])

        # 5. Default fallback if no destination could be determined
        return self._handle_unknown_destination_query(clean_msg)

    def _resolve_destination(self, message: str, explicit_slug: Optional[str]) -> Optional[Destination]:
        if explicit_slug:
            dest = Destination.objects.filter(slug=explicit_slug.lower()).first()
            if dest:
                return dest

        msg_lower = message.lower()
        all_dests = list(Destination.objects.all())

        # Exact or partial match on destination name / slug
        for d in all_dests:
            if d.slug in msg_lower or d.name.lower() in msg_lower:
                return d

        # Common aliases
        if 'vizag' in msg_lower:
            return Destination.objects.filter(slug='visakhapatnam').first()
        if 'banaras' in msg_lower or 'kashi' in msg_lower:
            return Destination.objects.filter(slug='varanasi').first()
        if 'ladakh' in msg_lower:
            return Destination.objects.filter(slug='leh-ladakh').first()

        return None

    def _is_itinerary_intent(self, message: str) -> bool:
        lower = message.lower()
        keywords = ['itinerary', 'plan a trip', 'plan my trip', 'plan a tour', 'day trip', 'days trip', 'schedule for']
        if any(k in lower for k in keywords):
            return True
        if re.search(r'\b\d+\s*days?\b', lower):
            return True
        return False

    def _handle_itinerary_request(self, message: str, destination: Destination) -> Dict[str, Any]:
        # Extract duration: handles "2-day", "3 days", "5day"
        duration_days = 3
        match_days = re.search(r'(\d+)[\s-]*days?', message.lower())
        if match_days:
            try:
                duration_days = max(1, min(14, int(match_days.group(1))))
            except ValueError:
                duration_days = 3

        # Extract budget
        budget_per_day = 2000
        match_budget = re.search(r'(?:₹|rs\.?|inr)?\s*(\d{3,5})', message.lower())
        if match_budget:
            try:
                b = int(match_budget.group(1))
                if 500 <= b <= 50000:
                    budget_per_day = b
            except ValueError:
                budget_per_day = 2000

        # Generate itinerary using Phase 5 AI service
        itinerary = self.planner_service.generate_itinerary({
            'destination': destination.slug,
            'duration_days': duration_days,
            'budget_per_day': budget_per_day,
            'group_type': 'Duo',
            'preferred_pace': 'Moderate',
            'save_to_db': False
        })

        reply_text = (
            f"I have crafted an authentic {duration_days}-day itinerary for **{destination.name}** "
            f"tailored to a daily budget of ₹{budget_per_day:,}. "
            f"Every stop is grounded strictly in our verified SQLite place records."
        )

        return {
            "reply": reply_text,
            "destination": {
                "name": destination.name,
                "slug": destination.slug
            },
            "intent": "itinerary_plan",
            "providerUsed": itinerary.get("aiProviderUsed", "DETERMINISTIC"),
            "itinerary": itinerary,
            "places": []
        }

    def _handle_grounded_place_query(
        self,
        message: str,
        destination: Destination,
        history: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        # Retrieve candidate places from SQLite
        places_qs = Place.objects.filter(destination=destination)
        
        # Check if user query matches specific category (e.g. beaches, food, culture, nature)
        msg_lower = message.lower()
        matched_category = None
        for cat in ['beaches', 'beach', 'food', 'culture', 'history', 'nature', 'shopping']:
            if cat in msg_lower:
                matched_category = 'beaches' if cat == 'beach' else cat
                break

        if matched_category:
            filtered_qs = places_qs.filter(category=matched_category)
            if filtered_qs.exists():
                places = list(filtered_qs) + [p for p in places_qs if p.category != matched_category]
            else:
                places = list(places_qs)
        else:
            places = list(places_qs)

        places = places[:15]

        if not places:
            return {
                "reply": f"We currently have no verified places registered for {destination.name} yet.",
                "destination": {"name": destination.name, "slug": destination.slug},
                "intent": "place_query",
                "providerUsed": "DETERMINISTIC",
                "places": []
            }

        # Format places into verified candidate list
        compact_places = []
        for p in places:
            compact_places.append({
                "id": str(p.id),
                "name": p.name,
                "category": p.category,
                "ticket_price_inr": p.ticket_price_inr if p.ticket_price_inr is not None else "unavailable",
                "opening_hours": p.opening_hours if p.opening_hours else "unavailable",
                "address": p.address,
                "description": p.description[:140],
                "rating": p.rating,
                "verification_status": p.verification_status
            })

        user_prompt = f"""User Query: "{message}"

Target Destination: {destination.name} ({destination.state}, {destination.region} India)
Verified Places in Database:
{compact_places}

Please answer the user's question directly and concisely, citing the relevant verified places, their entry fees, and authentic local tips."""

        # Attempt Gemini -> Ollama -> Deterministic grounded text synthesis
        answer_text = None
        provider_used = "DETERMINISTIC"

        # Try Gemini
        try:
            if self.ai_manager.gemini.check_health().available:
                from google import genai
                from google.genai import types
                client = genai.Client(api_key=self.ai_manager.gemini.api_key)
                response = client.models.generate_content(
                    model=self.ai_manager.gemini.model_name,
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=CHAT_SYSTEM_PROMPT,
                        temperature=0.3
                    )
                )
                if response and response.text:
                    answer_text = response.text.strip()
                    provider_used = "GEMINI"
        except Exception as e:
            logger.info(f"Chatbot Gemini attempt failed: {e}")

        # Try Ollama (Primary then Fallback)
        if not answer_text:
            models_to_try = [
                getattr(self.ai_manager.ollama, 'model_name', 'gemma3:4b'),
                getattr(self.ai_manager.ollama, 'fallback_model', 'qwen2.5:3b')
            ]
            for m in models_to_try:
                if not m:
                    continue
                try:
                    import requests
                    payload = {
                        "model": m,
                        "prompt": user_prompt,
                        "system": CHAT_SYSTEM_PROMPT,
                        "stream": False
                    }
                    resp = requests.post(f"{self.ai_manager.ollama.base_url}/api/generate", json=payload, timeout=20)
                    if resp.status_code == 200:
                        data = resp.json()
                        text = data.get("response", "").strip()
                        if text:
                            answer_text = text
                            provider_used = f"OLLAMA ({m})"
                            break
                except Exception as e:
                    logger.info(f"Chatbot Ollama model '{m}' attempt failed: {e}")

        # Deterministic Grounded Synthesis Fallback
        if not answer_text:
            provider_used = "DETERMINISTIC"
            lines = [f"Here are authentic verified attractions in **{destination.name}**:"]
            for idx, p in enumerate(places[:4], start=1):
                fee_str = f"₹{p.ticket_price_inr}" if p.ticket_price_inr is not None else "Free entry" if p.ticket_price_inr == 0 else "Fee unavailable"
                lines.append(f"**{idx}. {p.name}** ({p.category.capitalize()}) — {p.description}")
                lines.append(f"   • *Entry:* {fee_str} | *Hours:* {p.opening_hours or 'General hours'}")
            lines.append(f"\n*Grounded directly against local SQLite records for {destination.name}.*")
            answer_text = "\n".join(lines)

        # Place objects for client cards
        recommended_places_payload = []
        for p in places[:4]:
            recommended_places_payload.append({
                "id": str(p.id),
                "name": p.name,
                "category": p.category,
                "address": p.address,
                "ticketPriceInr": p.ticket_price_inr,
                "typicalCostInr": p.typical_cost_inr,
                "openingHours": p.opening_hours,
                "rating": p.rating,
                "verificationStatus": p.verification_status,
                "dataSource": p.data_source
            })

        return {
            "reply": answer_text,
            "destination": {
                "name": destination.name,
                "slug": destination.slug
            },
            "intent": "place_query",
            "providerUsed": provider_used,
            "places": recommended_places_payload
        }

    def _handle_general_destinations_query(self) -> Dict[str, Any]:
        destinations = Destination.objects.all()
        dest_list = [f"• **{d.name}** ({d.state}) — {d.tagline}" for d in destinations]
        dest_summary = "\n".join(dest_list)

        reply = (
            f"Here are the authentic destinations currently available in LOCAL LENS INDIA:\n\n"
            f"{dest_summary}\n\n"
            f"Ask me about any destination to discover verified local attractions, food, or to build a day-by-day itinerary!"
        )

        return {
            "reply": reply,
            "intent": "destinations_list",
            "providerUsed": "DETERMINISTIC",
            "places": []
        }

    def _handle_unknown_destination_query(self, message: str) -> Dict[str, Any]:
        available = ", ".join([d.name for d in Destination.objects.all()])
        reply = (
            f"I can help you explore authentic Indian travel experiences! "
            f"Please mention which destination you'd like to discover (e.g. {available}). "
            f"You can ask about local food, beaches, heritage sights, or request a complete multi-day itinerary."
        )

        return {
            "reply": reply,
            "intent": "general_guidance",
            "providerUsed": "DETERMINISTIC",
            "places": []
        }
