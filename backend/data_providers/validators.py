import re
from typing import Dict, Any, Tuple, Optional
from .base import ValidationError

# Geographic bounding box for India (including territorial island archipelagos)
INDIA_BOUNDS = {
    'min_lat': 6.0,
    'max_lat': 38.0,
    'min_lon': 68.0,
    'max_lon': 98.0,
}

VALID_CATEGORIES = {
    'history',
    'culture',
    'nature',
    'beaches',
    'food',
    'shopping',
    'adventure',
    'photography',
    'stay',
    'temple',
}

def validate_coordinates(lat: float, lon: float, enforce_india_bounds: bool = True) -> Tuple[float, float]:
    """
    Validates that coordinates are authentic WGS84 floats and optionally fall within India.
    """
    try:
        lat_f = float(lat)
        lon_f = float(lon)
    except (ValueError, TypeError):
        raise ValidationError(f"Invalid coordinate format: lat={lat}, lon={lon}")

    if not (-90.0 <= lat_f <= 90.0):
        raise ValidationError(f"Latitude out of global range: {lat_f}")
    if not (-180.0 <= lon_f <= 180.0):
        raise ValidationError(f"Longitude out of global range: {lon_f}")

    if enforce_india_bounds:
        if not (INDIA_BOUNDS['min_lat'] <= lat_f <= INDIA_BOUNDS['max_lat'] and
                INDIA_BOUNDS['min_lon'] <= lon_f <= INDIA_BOUNDS['max_lon']):
            raise ValidationError(
                f"Coordinates ({lat_f}, {lon_f}) fall outside authentic Indian geographical boundaries."
            )

    return round(lat_f, 6), round(lon_f, 6)


def sanitize_text(text: Optional[str], max_length: int = 500) -> str:
    """Strips script blocks, HTML tags, and excessive whitespace."""
    if not text:
        return ""
    # Strip script and style blocks entirely
    clean = re.sub(r'<script.*?</script>', '', str(text), flags=re.DOTALL | re.IGNORECASE)
    clean = re.sub(r'<style.*?</style>', '', clean, flags=re.DOTALL | re.IGNORECASE)
    # Strip remaining HTML tags
    clean = re.sub(r'<[^>]*>', '', clean)
    # Replace multiple whitespaces/newlines with single space
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean[:max_length]


def parse_ticket_fee(tags: Dict[str, Any]) -> Tuple[Optional[int], str]:
    """
    Strict fee parser:
    - If fee=no, return (0, 'VERIFIED')
    - If charge has numeric rupees (e.g. '₹50', '50 INR', '50'), return (50, 'VERIFIED')
    - If fee=yes with no numeric value, return (None, 'ESTIMATED')
    - Otherwise, return (None, 'UNAVAILABLE')
    """
    fee_tag = str(tags.get('fee', '')).lower().strip()
    charge_tag = str(tags.get('charge', '')).strip()

    if fee_tag == 'no' or charge_tag == '0':
        return 0, 'VERIFIED'

    # Try extracting rupee amounts from charge tag
    if charge_tag:
        numbers = re.findall(r'\d+', charge_tag)
        if numbers:
            return int(numbers[0]), 'VERIFIED'

    if fee_tag == 'yes':
        return None, 'ESTIMATED'

    return None, 'UNAVAILABLE'


def parse_opening_hours(tags: Dict[str, Any]) -> Tuple[str, str]:
    """
    Strict opening hours parser:
    - Returns hours string and verification status ('VERIFIED' or 'UNAVAILABLE')
    """
    hours = tags.get('opening_hours', '')
    if hours:
        return sanitize_text(hours, max_length=200), 'VERIFIED'
    return '', 'UNAVAILABLE'
