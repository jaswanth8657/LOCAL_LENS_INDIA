import math
from typing import Optional, Tuple

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes great-circle distance between two WGS84 points in kilometers.
    """
    R = 6371.0  # Earth radius in kilometers
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 2)

def calculate_distance_score(distance_km: Optional[float], max_radius_km: float = 25.0) -> float:
    """
    Computes a normalized proximity score in [0.0, 1.0].
    Nearby places receive high scores; places farther decay exponentially.
    If distance is unknown (missing coordinates), returns neutral fallback score 0.5.
    """
    if distance_km is None:
        return 0.5

    if distance_km <= 2.0:
        return 1.0

    if distance_km >= max_radius_km:
        return 0.1

    # Exponential decay from 2km to max_radius_km
    decay_rate = 2.0 / max_radius_km
    score = math.exp(-decay_rate * (distance_km - 2.0))
    return float(max(0.1, min(1.0, score)))

