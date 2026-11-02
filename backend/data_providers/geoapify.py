import time
import logging
import requests
from typing import Optional, Dict, Any, List
from django.conf import settings
from .base import BaseDataProvider, ProviderError, ProviderTimeoutError, ProviderRateLimitError
from .cache import ProviderCache
from .validators import validate_coordinates, sanitize_text

logger = logging.getLogger(__name__)

GEOAPIFY_BASE_URL = "https://api.geoapify.com/v2/places"
DEFAULT_USER_AGENT = "LocalLensIndia/1.0 (https://github.com/google-deepmind/locallensindia; geoapify-client@locallensindia.internal)"

GEOAPIFY_CATEGORY_MAP = [
    (['heritage', 'entertainment.museum'], 'history', 'Museum & Heritage'),
    (['tourism.attraction', 'tourism.sights'], 'culture', 'Attraction & Sights'),
    (['beach', 'natural.beach'], 'beaches', 'Beach & Coastal'),
    (['leisure.park', 'natural'], 'nature', 'Park & Nature'),
    (['catering.restaurant', 'catering.fast_food'], 'food', 'Restaurant & Dining'),
    (['catering.cafe'], 'food', 'Cafe & Bakery'),
    (['commercial.shopping_mall', 'commercial.marketplace', 'commercial.supermarket'], 'shopping', 'Shopping & Market'),
    (['tourism.viewpoint'], 'photography', 'Scenic Viewpoint'),
    (['activity.sport_club'], 'adventure', 'Outdoor Activity'),
    (['accommodation.hotel', 'accommodation.guest_house'], 'stay', 'Accommodation'),
]

def map_geoapify_categories(categories_list: List[str]) -> tuple[str, str]:
    if not categories_list:
        return 'culture', 'Local Point of Interest'
    
    joined = ' '.join(categories_list).lower()
    for triggers, cat, subcat in GEOAPIFY_CATEGORY_MAP:
        if any(t in joined for t in triggers):
            return cat, subcat
    return 'culture', 'Local Point of Interest'


class GeoapifyProvider(BaseDataProvider):
    """
    Isolated client for Geoapify Places API v2.
    Retrieves verified restaurants, cafes, museums, attractions, parks,
    and markets using coordinate radius filters.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        timeout: int = 10,
        cache: Optional[ProviderCache] = None,
        user_agent: str = DEFAULT_USER_AGENT
    ):
        super().__init__(name="Geoapify Places API", user_agent=user_agent, timeout=timeout)
        self.api_key = api_key if api_key is not None else getattr(settings, 'GEOAPIFY_API_KEY', '')
        self.cache = cache or ProviderCache()
        self.last_request_time: float = 0.0
        self.min_interval_seconds: float = 0.2  # 5 req/sec safe throttle

    def is_available(self) -> bool:
        """Returns True only when an API key is configured."""
        return bool(self.api_key and self.api_key.strip())

    def _throttle(self) -> None:
        elapsed = time.time() - self.last_request_time
        if elapsed < self.min_interval_seconds:
            time.sleep(self.min_interval_seconds - elapsed)
        self.last_request_time = time.time()

    def fetch(self, endpoint: str = "", params: Optional[Dict[str, Any]] = None) -> Any:
        if not self.is_available():
            return None

        params = dict(params or {})
        params['apiKey'] = self.api_key

        cache_key = {"params": {k: v for k, v in params.items() if k != 'apiKey'}}
        cached = self.cache.get("geoapify", cache_key)
        if cached is not None:
            return cached

        self._throttle()
        url = GEOAPIFY_BASE_URL
        headers = {
            "User-Agent": self.user_agent,
            "Accept": "application/json",
        }

        try:
            response = requests.get(
                url,
                params=params,
                headers=headers,
                timeout=self.timeout,
                proxies={"http": None, "https": None}
            )
            if response.status_code == 429:
                raise ProviderRateLimitError("Geoapify daily or per-second credit limit exceeded (HTTP 429).")
            if response.status_code in (401, 402, 403):
                logger.warning("Geoapify request rejected HTTP %d: check GEOAPIFY_API_KEY or credit balance", response.status_code)
                return None
            if response.status_code >= 500:
                raise ProviderError(f"Geoapify upstream server error HTTP {response.status_code}")

            response.raise_for_status()
            data = response.json()
            self.cache.set("geoapify", cache_key, data)
            return data
        except requests.exceptions.Timeout as e:
            raise ProviderTimeoutError(f"Geoapify request timed out after {self.timeout}s: {e}")
        except requests.exceptions.RequestException as e:
            raise ProviderError(f"Geoapify network failure: {e}")

    def search_places(
        self,
        lat: float,
        lon: float,
        radius_meters: int = 15000,
        categories: Optional[str] = None,
        limit: int = 25
    ) -> List[Dict[str, Any]]:
        """
        Discovers places near (lat, lon) within radius_meters.
        """
        if not self.is_available():
            return []

        default_categories = (
            "catering.restaurant,catering.cafe,entertainment.museum,"
            "tourism.attraction,tourism.sights,leisure.park,"
            "commercial.shopping_mall,commercial.marketplace"
        )

        params = {
            "categories": categories or default_categories,
            "filter": f"circle:{lon},{lat},{max(500, min(radius_meters, 50000))}",
            "bias": f"proximity:{lon},{lat}",
            "limit": max(1, min(limit, 50)),
        }

        try:
            raw = self.fetch(params=params)
            if isinstance(raw, dict) and 'features' in raw:
                return self.parse(raw.get('features', []))
            return []
        except Exception as e:
            logger.warning("Geoapify search_places notice for (%s, %s): %s", lat, lon, e)
            return []

    def parse(self, raw_data: Any) -> List[Dict[str, Any]]:
        """Transforms raw Geoapify GeoJSON features into normalized Local Lens place dictionaries."""
        if not isinstance(raw_data, list):
            return []

        parsed_places: List[Dict[str, Any]] = []

        for feature in raw_data:
            if not isinstance(feature, dict):
                continue

            props = feature.get('properties') or {}
            name = sanitize_text(props.get('name'))
            if not name:
                continue

            raw_lat = props.get('lat')
            raw_lon = props.get('lon')
            if raw_lat is None or raw_lon is None:
                continue

            try:
                lat, lon = validate_coordinates(float(raw_lat), float(raw_lon), enforce_india_bounds=True)
            except Exception:
                continue

            place_id = str(props.get('place_id', '')).strip()
            cats_list = props.get('categories') or []
            cat, subcat = map_geoapify_categories(cats_list)

            # Extract formatted address
            address = sanitize_text(props.get('formatted') or props.get('address_line1', ''))
            opening_hours = sanitize_text(props.get('opening_hours', ''))
            website = props.get('website') or ''

            parsed_places.append({
                "name": name,
                "category": cat,
                "subcategory": subcat,
                "latitude": lat,
                "longitude": lon,
                "address": address,
                "description": f"Verified venue discovered via Geoapify ({subcat}).",
                "ticket_price_inr": None,
                "typical_cost_inr": None,
                "opening_hours": opening_hours,
                "rating": None,
                "review_count": 0,
                "source_name": "Geoapify Places",
                "source_record_id": f"geoapify_{place_id}" if place_id else f"geoapify_{name.lower()[:20]}",
                "source_url": website,
                "geoapify_place_id": place_id,
                "verification_status": "SOURCE_REPORTED",
                "provenance_label": "Geoapify verified places",
            })

        return parsed_places

