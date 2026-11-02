import time
import logging
import requests
from typing import Optional, Dict, Any, List
from django.conf import settings
from .base import BaseDataProvider, ProviderError, ProviderTimeoutError, ProviderRateLimitError
from .cache import ProviderCache
from .validators import validate_coordinates, sanitize_text

logger = logging.getLogger(__name__)

OPENTRIPMAP_BASE_URL = "https://api.opentripmap.com/0.1/en"
DEFAULT_USER_AGENT = "LocalLensIndia/1.0 (https://github.com/google-deepmind/locallensindia; opentripmap-client@locallensindia.internal)"

# OpenTripMap kinds mapping to Local Lens categories
OTM_CATEGORY_MAP = [
    (['historic', 'monuments', 'fortifications', 'castles', 'archaeology', 'ruins'], 'history', 'Historical Monument'),
    (['museums', 'art_galleries', 'theatres_and_entertainments', 'cultural'], 'culture', 'Cultural Landmark'),
    (['beaches', 'seaside_resorts'], 'beaches', 'Coastal Beach'),
    (['natural', 'nature_reserves', 'waterfalls', 'caves', 'geological_formations'], 'nature', 'Natural Attraction'),
    (['foods', 'restaurants', 'cafes', 'bars', 'fast_food'], 'food', 'Culinary & Dining'),
    (['shops', 'malls', 'marketplaces', 'supermarkets'], 'shopping', 'Bazaar & Shopping'),
    (['religion', 'churches', 'mosques', 'hindu_temples', 'buddhist_temples'], 'temple', 'Sacred & Temple Site'),
    (['view_points', 'photography'], 'photography', 'Scenic Viewpoint'),
    (['sport', 'climbing', 'diving'], 'adventure', 'Adventure & Outdoor'),
]

def map_otm_kinds_to_category(kinds: str) -> tuple[str, str]:
    kinds_lower = (kinds or '').lower()
    for triggers, cat, subcat in OTM_CATEGORY_MAP:
        if any(t in kinds_lower for t in triggers):
            return cat, subcat
    return 'culture', 'Tourist Attraction'


class OpenTripMapProvider(BaseDataProvider):
    """
    Isolated client for OpenTripMap REST API.
    Retrieves cultural and tourist attractions, historic monuments, coordinates,
    and available Wikipedia summaries without subscription billing risk.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        timeout: int = 10,
        cache: Optional[ProviderCache] = None,
        user_agent: str = DEFAULT_USER_AGENT
    ):
        super().__init__(name="OpenTripMap API", user_agent=user_agent, timeout=timeout)
        self.api_key = api_key if api_key is not None else getattr(settings, 'OPENTRIPMAP_API_KEY', '')
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

    def fetch(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Any:
        if not self.is_available():
            return None

        params = dict(params or {})
        params['apikey'] = self.api_key

        cache_key = {"endpoint": endpoint, "params": {k: v for k, v in params.items() if k != 'apikey'}}
        cached = self.cache.get("opentripmap", cache_key)
        if cached is not None:
            return cached

        self._throttle()
        url = f"{OPENTRIPMAP_BASE_URL}/{endpoint.lstrip('/')}"
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
                raise ProviderRateLimitError("OpenTripMap daily or per-second rate limit exceeded (HTTP 429).")
            if response.status_code in (401, 403):
                logger.warning("OpenTripMap authentication failed HTTP %d: check OPENTRIPMAP_API_KEY", response.status_code)
                return None
            if response.status_code >= 500:
                raise ProviderError(f"OpenTripMap upstream server error HTTP {response.status_code}")
            
            response.raise_for_status()
            data = response.json()
            self.cache.set("opentripmap", cache_key, data)
            return data
        except requests.exceptions.Timeout as e:
            raise ProviderTimeoutError(f"OpenTripMap request timed out after {self.timeout}s: {e}")
        except requests.exceptions.RequestException as e:
            raise ProviderError(f"OpenTripMap network failure: {e}")

    def search_radius(
        self,
        lat: float,
        lon: float,
        radius_meters: int = 15000,
        kinds: Optional[str] = None,
        rate: int = 1,
        limit: int = 25
    ) -> List[Dict[str, Any]]:
        """
        Discovers attractions within radius_meters around coordinates.
        'rate' (1, 2, or 3) filters by OpenTripMap catalog popularity.
        """
        if not self.is_available():
            return []

        params = {
            "radius": max(500, min(radius_meters, 50000)),
            "lon": lon,
            "lat": lat,
            "rate": max(1, min(rate, 3)),
            "format": "json",
            "limit": max(1, min(limit, 50)),
        }
        if kinds:
            params['kinds'] = kinds
        else:
            params['kinds'] = "interesting_places,cultural,historic,natural,foods,architecture"

        try:
            raw = self.fetch("places/radius", params=params)
            if isinstance(raw, list):
                return self.parse(raw)
            return []
        except Exception as e:
            logger.warning("OpenTripMap search_radius notice for (%s, %s): %s", lat, lon, e)
            return []

    def get_place_details(self, xid: str) -> Optional[Dict[str, Any]]:
        """Fetches detailed profile including Wikipedia extract and preview photo."""
        if not self.is_available() or not xid:
            return None
        try:
            return self.fetch(f"places/xid/{xid}")
        except Exception as e:
            logger.warning("OpenTripMap get_place_details notice for %s: %s", xid, e)
            return None

    def parse(self, raw_data: Any) -> List[Dict[str, Any]]:
        """Transforms raw OpenTripMap places into normalized Local Lens place dictionaries."""
        if not isinstance(raw_data, list):
            return []

        parsed_places: List[Dict[str, Any]] = []

        for item in raw_data:
            if not isinstance(item, dict):
                continue

            name = sanitize_text(item.get('name'))
            if not name:
                continue

            point = item.get('point') or {}
            raw_lat = point.get('lat', item.get('lat'))
            raw_lon = point.get('lon', item.get('lon'))
            if raw_lat is None or raw_lon is None:
                continue

            try:
                lat, lon = validate_coordinates(float(raw_lat), float(raw_lon), enforce_india_bounds=True)
            except Exception:
                continue

            xid = str(item.get('xid', '')).strip()
            kinds = str(item.get('kinds', ''))
            cat, subcat = map_otm_kinds_to_category(kinds)
            # OpenTripMap 'rate' is catalog popularity (1 to 3), NOT customer review rating
            otm_rate = item.get('rate')

            parsed_places.append({
                "name": name,
                "category": cat,
                "subcategory": subcat,
                "latitude": lat,
                "longitude": lon,
                "address": "",
                "description": f"Cultural attraction discovered via OpenTripMap catalog ({subcat}).",
                "ticket_price_inr": None,
                "typical_cost_inr": None,
                "opening_hours": "",
                "rating": None,  # Keep None: do not confuse catalog popularity with reviews
                "review_count": 0,
                "source_name": "OpenTripMap",
                "source_record_id": f"otm_{xid}" if xid else f"otm_{name.lower()[:20]}",
                "source_url": f"https://opentripmap.com/en/card/{xid}" if xid else "",
                "otm_xid": xid,
                "otm_rate": otm_rate,
                "verification_status": "SOURCE_REPORTED",
                "provenance_label": "OpenTripMap cultural catalog",
            })

        return parsed_places

