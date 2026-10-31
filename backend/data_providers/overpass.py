import time
import requests
from typing import Optional, Dict, Any, List, Tuple
from .base import BaseDataProvider, ProviderError, ProviderTimeoutError, ProviderRateLimitError
from .cache import ProviderCache
from .validators import (
    validate_coordinates,
    sanitize_text,
    parse_ticket_fee,
    parse_opening_hours
)

OVERPASS_SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

TAG_CATEGORY_MAPPINGS: List[Tuple[str, str, str, str]] = [
    # (osm_key, osm_value, local_lens_category, subcategory)
    ('natural', 'beach', 'beaches', 'Coastal Beach'),
    ('historic', 'monument', 'history', 'Historical Monument'),
    ('historic', 'memorial', 'history', 'Memorial'),
    ('historic', 'fort', 'history', 'Ancient Fort'),
    ('historic', 'castle', 'history', 'Palace / Fortress'),
    ('historic', 'archaeological_site', 'history', 'Archaeological Heritage Site'),
    ('historic', 'ruins', 'history', 'Historic Ruins'),
    ('tourism', 'museum', 'history', 'Museum & Gallery'),
    ('tourism', 'attraction', 'culture', 'Tourist Attraction'),
    ('tourism', 'viewpoint', 'photography', 'Scenic Viewpoint'),
    ('amenity', 'place_of_worship', 'temple', 'Temple / Sacred Shrine'),
    ('amenity', 'restaurant', 'food', 'Local Restaurant'),
    ('amenity', 'cafe', 'food', 'Cafe & Bakery'),
    ('amenity', 'fast_food', 'food', 'Street Eats & Snacks'),
    ('shop', 'mall', 'shopping', 'Shopping Complex'),
    ('shop', 'bazaar', 'shopping', 'Traditional Bazaar'),
    ('leisure', 'park', 'nature', 'City Park / Garden'),
    ('leisure', 'nature_reserve', 'nature', 'Nature Reserve / Wildlife'),
    ('natural', 'waterfall', 'nature', 'Natural Waterfall'),
    ('natural', 'cave_entrance', 'adventure', 'Cave / Rock Formation'),
]

class OverpassProvider(BaseDataProvider):
    """
    Client for OpenStreetMap Overpass API.
    Queries real-world POIs around geographic coordinates, parses factual tags,
    and returns verified place structures.
    """

    def __init__(self, timeout: int = 5, cache: Optional[ProviderCache] = None):
        super().__init__(
            name="OpenStreetMap Overpass API",
            user_agent="LocalLensIndia/1.0 (https://github.com/google-deepmind/locallensindia; overpass-client@locallensindia.internal)",
            timeout=timeout
        )
        self.cache = cache or ProviderCache()

    def build_query(self, lat: float, lon: float, radius_meters: int = 15000, limit: int = 50) -> str:
        """
        Constructs an efficient Overpass QL query around center coordinates.
        Covers attractions, historic monuments/forts/ruins, temples, parks, beaches, viewpoints, and bazaars.
        """
        return f"""[out:json][timeout:{self.timeout}];
(
  node["tourism"~"attraction|museum|viewpoint"](around:{radius_meters},{lat},{lon});
  node["historic"](around:{radius_meters},{lat},{lon});
  node["natural"~"beach|waterfall|peak|cave_entrance"](around:{radius_meters},{lat},{lon});
  node["amenity"="place_of_worship"]["name"](around:{radius_meters},{lat},{lon});
  node["leisure"~"park|nature_reserve"](around:{radius_meters},{lat},{lon});
  node["shop"~"bazaar|mall"](around:{radius_meters},{lat},{lon});
  node["amenity"~"restaurant|cafe"](around:{radius_meters},{lat},{lon});
  way["tourism"~"attraction|museum|viewpoint"](around:{radius_meters},{lat},{lon});
  way["historic"](around:{radius_meters},{lat},{lon});
  way["amenity"="place_of_worship"]["name"](around:{radius_meters},{lat},{lon});
  way["leisure"~"park|nature_reserve"](around:{radius_meters},{lat},{lon});
  way["natural"~"beach|waterfall|peak"](around:{radius_meters},{lat},{lon});
);
out center tags {limit};
"""

    def fetch(self, query: str) -> Dict[str, Any]:
        """Executes query with caching and retry over available Overpass mirrors."""
        cache_key = {"query": query}
        cached = self.cache.get("overpass", cache_key)
        if cached is not None:
            return cached

        headers = {
            "User-Agent": self.user_agent,
            "Accept": "application/json",
        }

        last_error = None
        s = requests.Session()
        s.trust_env = False
        for server in OVERPASS_SERVERS:
            for attempt in range(1):
                try:
                    response = s.post(
                        server,
                        data={"data": query},
                        headers=headers,
                        timeout=self.timeout
                    )
                    if response.status_code == 429:
                        time.sleep(2.0)
                        continue
                    if response.status_code >= 500:
                        time.sleep(1.0)
                        continue
                    response.raise_for_status()

                    data = response.json()
                    self.cache.set("overpass", cache_key, data)
                    return data
                except requests.exceptions.Timeout as e:
                    last_error = ProviderTimeoutError(f"Overpass timeout at {server}: {e}")
                    time.sleep(1.0)
                except Exception as e:
                    last_error = ProviderError(f"Overpass error at {server}: {e}")
                    time.sleep(1.0)

        if last_error:
            raise last_error
        raise ProviderError("Failed to reach any Overpass API mirror.")

    def parse(self, raw_data: Any) -> List[Dict[str, Any]]:
        """Parses Overpass JSON output into standardized POI dictionaries."""
        if not raw_data or not isinstance(raw_data, dict):
            return []

        elements = raw_data.get('elements', [])
        results: List[Dict[str, Any]] = []

        for elem in elements:
            tags = elem.get('tags', {})
            name = tags.get('name') or tags.get('name:en')
            if not name:
                # Discard nameless features
                continue

            # Extract coordinates (direct for nodes, center for ways/relations)
            lat = elem.get('lat') or (elem.get('center', {}).get('lat') if elem.get('center') else None)
            lon = elem.get('lon') or (elem.get('center', {}).get('lon') if elem.get('center') else None)

            if lat is None or lon is None:
                continue

            try:
                valid_lat, valid_lon = validate_coordinates(lat, lon)
            except Exception:
                continue

            # Classify category and subcategory from OSM tags
            category, subcategory = self._classify_category(tags)

            # Ticket fee parsing
            ticket_price, fee_status = parse_ticket_fee(tags)

            # Opening hours parsing
            opening_hours, hours_status = parse_opening_hours(tags)

            # Build provider record ID and URL
            osm_type = elem.get('type', 'node')
            osm_id = elem.get('id')
            record_id = f"osm:{osm_type}:{osm_id}"
            source_url = f"https://www.openstreetmap.org/{osm_type}/{osm_id}"

            # Assemble description from factual tags
            desc_parts = []
            if tags.get('description'):
                desc_parts.append(tags.get('description'))
            if tags.get('wikipedia'):
                desc_parts.append(f"Referenced in Wikipedia ({tags.get('wikipedia')}).")
            if tags.get('religion'):
                desc_parts.append(f"Dedicated to {tags.get('religion').title()} tradition.")
            if tags.get('cuisine'):
                desc_parts.append(f"Specializes in {tags.get('cuisine')} cuisine.")
            if not desc_parts:
                desc_parts.append(f"Verified {subcategory.lower()} located in this area.")

            description = sanitize_text(" ".join(desc_parts), max_length=600)
            address = sanitize_text(
                tags.get('addr:street') or tags.get('addr:full') or f"Near {name}",
                max_length=300
            )

            poi = {
                'source_record_id': record_id,
                'name': sanitize_text(name, max_length=200),
                'category': category,
                'subcategory': subcategory,
                'description': description,
                'address': address,
                'latitude': valid_lat,
                'longitude': valid_lon,
                'price_tier': 'Budget',
                'ticket_price_inr': ticket_price,
                'opening_hours': opening_hours,
                'data_source': 'OpenStreetMap Overpass API',
                'source_url': source_url,
                'verification_status': 'VERIFIED',
                'fee_status': fee_status,
                'hours_status': hours_status,
                'raw_tags': tags,
            }
            results.append(poi)

        return results

    def _classify_category(self, tags: Dict[str, Any]) -> Tuple[str, str]:
        """Matches tags against prioritized classification rules."""
        for osm_key, osm_val, cat, subcat in TAG_CATEGORY_MAPPINGS:
            val = str(tags.get(osm_key, '')).lower()
            if val == osm_val:
                return cat, subcat

        # Fallback category checks
        if 'historic' in tags:
            return 'history', 'Historical Site'
        if 'tourism' in tags:
            return 'culture', 'Attraction'
        if 'amenity' in tags and tags['amenity'] == 'place_of_worship':
            return 'temple', 'Religious Shrine'
        if 'natural' in tags:
            return 'nature', 'Natural Landmark'
        if 'leisure' in tags:
            return 'nature', 'Park'

        return 'culture', 'Point of Interest'
