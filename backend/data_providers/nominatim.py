import time
import requests
from typing import Optional, Dict, Any, List
from .base import BaseDataProvider, ProviderError, ProviderTimeoutError, ProviderRateLimitError
from .cache import ProviderCache
from .validators import validate_coordinates, sanitize_text

NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org"
DEFAULT_USER_AGENT = "LocalLensIndia/1.0 (https://github.com/google-deepmind/locallensindia; travel-discovery@locallensindia.internal)"

class NominatimProvider(BaseDataProvider):
    """
    Polite Nominatim geocoding & reverse geocoding client.
    Enforces the official 1 req/sec rate limit policy, custom User-Agent, and caching.
    """

    def __init__(self, user_agent: str = DEFAULT_USER_AGENT, timeout: int = 15, cache: Optional[ProviderCache] = None):
        super().__init__(name="Nominatim Geocoding", user_agent=user_agent, timeout=timeout)
        self.cache = cache or ProviderCache()
        self.last_request_time: float = 0.0
        self.min_interval_seconds: float = 1.05  # Enforce 1s spacing

    def _throttle(self) -> None:
        elapsed = time.time() - self.last_request_time
        if elapsed < self.min_interval_seconds:
            time.sleep(self.min_interval_seconds - elapsed)
        self.last_request_time = time.time()

    def fetch(self, endpoint: str, params: Dict[str, Any]) -> Any:
        cache_key = {"endpoint": endpoint, "params": params}
        cached = self.cache.get("nominatim", cache_key)
        if cached is not None:
            return cached

        self._throttle()

        headers = {
            "User-Agent": self.user_agent,
            "Accept": "application/json",
        }

        url = f"{NOMINATIM_BASE_URL}/{endpoint}"
        try:
            response = requests.get(
                url,
                params=params,
                headers=headers,
                timeout=self.timeout,
                proxies={"http": None, "https": None}
            )
            if response.status_code == 429:
                raise ProviderRateLimitError("Nominatim rate limit exceeded (HTTP 429).")
            if response.status_code >= 500:
                raise ProviderError(f"Nominatim server error HTTP {response.status_code}")
            response.raise_for_status()

            data = response.json()
            self.cache.set("nominatim", cache_key, data)
            return data
        except requests.exceptions.Timeout as e:
            raise ProviderTimeoutError(f"Nominatim request timed out: {e}")
        except requests.exceptions.RequestException as e:
            raise ProviderError(f"Nominatim network failure: {e}")

    def geocode_destination(self, query: str) -> Optional[Dict[str, Any]]:
        """Geocodes an Indian destination name into coordinates and administrative boundary."""
        params = {
            "q": query,
            "countrycodes": "in",
            "format": "jsonv2",
            "addressdetails": 1,
            "limit": 1,
        }
        results = self.fetch("search", params)
        if not results or not isinstance(results, list):
            return None

        first = results[0]
        try:
            lat, lon = validate_coordinates(float(first["lat"]), float(first["lon"]))
            address = first.get("address", {})
            return {
                "name": sanitize_text(first.get("name") or query),
                "display_name": sanitize_text(first.get("display_name")),
                "latitude": lat,
                "longitude": lon,
                "state": sanitize_text(address.get("state", "")),
                "osm_id": str(first.get("osm_id")),
                "osm_type": str(first.get("osm_type")),
                "source": "Nominatim / OpenStreetMap",
                "source_url": f"https://www.openstreetmap.org/{first.get('osm_type')}/{first.get('osm_id')}",
            }
        except Exception:
            return None

    def reverse_geocode(self, lat: float, lon: float) -> Optional[Dict[str, Any]]:
        """Reverse geocodes coordinates to administrative locality/address."""
        params = {
            "lat": lat,
            "lon": lon,
            "format": "jsonv2",
            "addressdetails": 1,
        }
        data = self.fetch("reverse", params)
        if not data or not isinstance(data, dict):
            return None

        address = data.get("address", {})
        return {
            "display_name": sanitize_text(data.get("display_name")),
            "city": sanitize_text(address.get("city") or address.get("town") or address.get("village", "")),
            "state": sanitize_text(address.get("state", "")),
            "country": sanitize_text(address.get("country", "")),
            "postcode": sanitize_text(address.get("postcode", "")),
            "road": sanitize_text(address.get("road", "")),
        }

    def parse(self, raw_data: Any) -> List[Dict[str, Any]]:
        # Parsing handled in specific methods
        return []

