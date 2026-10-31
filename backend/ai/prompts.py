import json
from typing import List, Dict, Any

SYSTEM_INSTRUCTION = """You are the Senior Local Guide for "LOCAL LENS INDIA" (Tagline: Experience Like a Local).
Your mission is to curate an authentic, personalized, realistic Indian travel itinerary based strictly on the verified candidate places provided.

STRICT GROUNDING RULES:
1. ONLY use places provided in the CANDIDATE PLACES list. Each stop MUST reference the exact `place_id` from that list.
2. DO NOT invent, hallucinate, or recommend any attractions, restaurants, or places not in the candidate list.
3. DO NOT fabricate coordinates, ticket fees, opening hours, or official ratings.
4. Schedule realistic pacing:
   - "Relaxed" pace: 2 stops per day (Morning + Evening).
   - "Moderate" pace: 3 stops per day (Morning + Afternoon + Evening).
   - "Packed" pace: 4 stops per day (Morning + Afternoon + Evening + Night).
5. Never repeat the same place unless it is a multi-visit hub.
6. Provide authentic, culturally grounded, practical tips (e.g. best photography time, local etiquette, attire, bargaining or street snack recommendations).
7. Suggest realistic transit notes between consecutive stops (e.g. "15 mins auto-rickshaw (approx ₹60-80)", "10 mins walk").
8. RETURN ONLY A STRICT JSON OBJECT matching the schema. No markdown formatting, no commentary before or after.
"""

def build_planning_user_prompt(
    destination_name: str,
    duration_days: int,
    daily_budget_inr: int,
    group_type: str,
    interests: List[str],
    pace: str,
    candidate_places: List[Dict[str, Any]],
    start_date: str = ""
) -> str:
    """
    Constructs bounded, sanitized prompt context with verified candidate places.
    Limits text size to avoid prompt injection and token overflow.
    """
    # Sanitize and compact candidate list for the prompt
    compact_candidates = []
    for p in candidate_places[:30]:  # Cap at top 30 ranked places
        t_fee = p.get("ticket_price_inr") if p.get("ticket_price_inr") is not None else p.get("ticketPriceInr")
        typ_cost = p.get("typical_cost_inr") if p.get("typical_cost_inr") is not None else p.get("typicalCostInr")
        o_hours = p.get("opening_hours") or p.get("openingHours") or "unavailable"

        compact_candidates.append({
            "place_id": str(p.get("id")),
            "name": str(p.get("name"))[:80],
            "category": str(p.get("category", ""))[:30],
            "subcategory": str(p.get("subcategory", ""))[:30],
            "address": str(p.get("address", ""))[:100],
            "ticket_price_inr": t_fee if t_fee is not None else "unavailable",
            "typical_cost_inr": typ_cost if typ_cost is not None else "unavailable",
            "opening_hours": str(o_hours)[:60],
            "description": str(p.get("description", ""))[:180]
        })

    payload = {
        "travel_parameters": {
            "destination": destination_name,
            "duration_days": duration_days,
            "daily_budget_inr": daily_budget_inr,
            "group_type": group_type,
            "interests": interests,
            "preferred_pace": pace,
            "start_date": start_date or "Flexible"
        },
        "candidate_places": compact_candidates,
        "json_schema_format": {
            "title": f"{duration_days}-Day Authentic {destination_name} Discovery",
            "destination_name": destination_name,
            "duration_days": duration_days,
            "days": [
                {
                    "day_number": 1,
                    "theme": "Theme of Day 1",
                    "date": start_date or "Day 1",
                    "stops": [
                        {
                            "place_id": "<exact place_id from candidates>",
                            "time_slot": "Morning",
                            "time": "09:00 AM",
                            "duration_minutes": 90,
                            "local_tips": "Authentic practical recommendation",
                            "transport_to_next": "Realistic transit method"
                        }
                    ]
                }
            ],
            "notes": "Practical local advice regarding seasons, manners and safety."
        }
    }

    return f"""Please create a {duration_days}-day itinerary for {destination_name} according to the following parameters and candidate places:

{json.dumps(payload, indent=2)}

Remember: Every single stop MUST use a valid `place_id` from the `candidate_places` list. Return ONLY raw JSON."""

