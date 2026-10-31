from typing import List, Optional
from pydantic import BaseModel, Field, field_validator

class TripPreferencesInput(BaseModel):
    destination: str = Field(..., description="Destination slug (e.g. 'visakhapatnam', 'jaipur', 'kochi')")
    interests: List[str] = Field(default_factory=list, description="User travel interests (e.g. ['beaches', 'culture', 'food'])")
    budget_per_day: int = Field(default=2000, ge=500, le=50000, description="Daily budget in INR")
    group_type: str = Field(default="Duo", description="Travel party size/composition: Solo, Duo, Family, Friends")
    duration_days: int = Field(default=3, ge=1, le=21, description="Trip duration in days")
    start_date: Optional[str] = Field(default=None, description="Trip start date (YYYY-MM-DD)")
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0, description="User starting latitude")
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0, description="User starting longitude")
    preferred_pace: str = Field(default="Moderate", description="Travel pace: Relaxed (2 stops/day), Moderate (3 stops/day), Packed (4 stops/day)")
    save_to_db: bool = Field(default=False, description="Whether to automatically persist the itinerary to SQLite")

    @field_validator('group_type')
    def validate_group_type(cls, v: str) -> str:
        valid = {'Solo', 'Duo', 'Family', 'Friends'}
        norm = v.capitalize()
        return norm if norm in valid else 'Duo'

    @field_validator('preferred_pace')
    def validate_pace(cls, v: str) -> str:
        valid = {'Relaxed', 'Moderate', 'Packed'}
        norm = v.capitalize()
        return norm if norm in valid else 'Moderate'


class RawAIStop(BaseModel):
    place_id: str = Field(..., description="Database ID of the selected place from candidate list")
    time_slot: str = Field(default="Morning", description="Morning, Afternoon, Evening, or Night")
    time: str = Field(default="09:00 AM", description="Scheduled start time e.g. '09:00 AM'")
    duration_minutes: int = Field(default=90, ge=30, le=360, description="Recommended visit duration in minutes")
    local_tips: str = Field(default="", description="Specific practical tip for visiting like a local")
    transport_to_next: str = Field(default="", description="Realistic transit method to next stop (auto-rickshaw, cab, walk)")


class RawAIDay(BaseModel):
    day_number: int = Field(..., ge=1, le=21, description="Day index starting at 1")
    theme: str = Field(..., description="Atmospheric title/theme for this day's exploration")
    date: str = Field(default="", description="Calendar date if available")
    stops: List[RawAIStop] = Field(default_factory=list, description="Sequence of stops for the day")


class RawAIItinerary(BaseModel):
    title: str = Field(..., description="Evocative title for the authentic journey")
    destination_name: str = Field(..., description="Target destination city/region")
    duration_days: int = Field(..., ge=1, le=21, description="Number of days planned")
    days: List[RawAIDay] = Field(..., description="Day-by-day plan")
    notes: Optional[str] = Field(default="", description="Cultural etiquette and seasonal travel advice")

