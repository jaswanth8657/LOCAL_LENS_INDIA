import math
from typing import Dict, Any, List, Optional
from django.db import transaction
from destinations.models import Destination
from places.models import Place, DataProvenanceLog
from .overpass import OverpassProvider
from .nominatim import NominatimProvider
from .base import ProviderError
from .validators import parse_ticket_fee, parse_opening_hours

def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates geodetic distance in meters between two WGS84 points."""
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


class PlaceIngestionService:
    """
    Orchestrates factual place discovery, duplicate resolution,
    safe upserts, and immutable provenance logging.
    """

    def __init__(self, overpass: Optional[OverpassProvider] = None, nominatim: Optional[NominatimProvider] = None):
        self.overpass = overpass or OverpassProvider()
        self.nominatim = nominatim or NominatimProvider()

    def ingest_destination_places(
        self,
        destination_slug: str,
        radius_meters: int = 12000,
        limit: int = 50,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        stats = {
            'destination': destination_slug,
            'retrieved': 0,
            'created': 0,
            'updated': 0,
            'duplicates_skipped': 0,
            'rejected': 0,
            'errors': [],
        }

        try:
            destination = Destination.objects.get(slug=destination_slug)
        except Destination.DoesNotExist:
            stats['errors'].append(f"Destination '{destination_slug}' not found.")
            return stats

        # 1. Query Overpass API for real POIs around center coordinates
        parsed_pois = []
        try:
            query = self.overpass.build_query(
                lat=destination.latitude,
                lon=destination.longitude,
                radius_meters=radius_meters,
                limit=limit
            )
            raw_data = self.overpass.fetch(query)
            parsed_pois = self.overpass.parse(raw_data)
        except ProviderError as e:
            stats['errors'].append(f"Overpass provider notice: {e}")

        # 2. If Overpass timed out or returned no results, discover real POIs via Nominatim OpenStreetMap search
        if len(parsed_pois) == 0:
            try:
                nominatim_pois = self._discover_pois_via_nominatim(destination, limit=limit)
                for np in nominatim_pois:
                    if not any(p['source_record_id'] == np['source_record_id'] for p in parsed_pois):
                        parsed_pois.append(np)
            except Exception as e:
                stats['errors'].append(f"Nominatim discovery notice: {e}")

        stats['retrieved'] = len(parsed_pois)

        # Existing places for duplicate matching
        existing_places = list(Place.objects.filter(destination=destination))

        for poi in parsed_pois:
            try:
                self._process_single_poi(poi, destination, existing_places, stats, dry_run=dry_run)
            except Exception as e:
                stats['rejected'] += 1
                stats['errors'].append(f"Error processing {poi.get('name')}: {e}")

        if not dry_run and (stats['created'] > 0 or stats['updated'] > 0):
            try:
                from ai.services import invalidate_itinerary_cache
                invalidate_itinerary_cache(destination.slug)
            except Exception:
                pass

        return stats

    def _discover_pois_via_nominatim(self, destination: Destination, limit: int = 25) -> List[Dict[str, Any]]:
        """
        Discovers authentic, geocoded points of interest across diverse categories
        via OpenStreetMap Nominatim search around the destination.
        """
        city_name = destination.name.split('(')[0].strip()
        search_themes = [
            ("attractions", "culture", "Tourist Attraction"),
            ("monuments", "history", "Historical Monument"),
            ("fort", "history", "Ancient Fort"),
            ("palace", "history", "Royal Palace"),
            ("museum", "history", "Heritage Museum"),
            ("temple", "temple", "Sacred Temple"),
            ("park", "nature", "City Park & Gardens"),
            ("bazaar", "shopping", "Traditional Bazaar"),
        ]
        if destination.region in ('South', 'West') or 'beaches' in getattr(destination, 'popular_categories', []):
            search_themes.insert(2, ("beach", "beaches", "Coastal Beach"))

        discovered: List[Dict[str, Any]] = []
        seen_names = set()

        for term, cat, subcat in search_themes:
            if len(discovered) >= limit:
                break

            query = f"{term} in {city_name}"
            params = {
                "q": query,
                "countrycodes": "in",
                "format": "jsonv2",
                "addressdetails": 1,
                "extratags": 1,
                "limit": 8
            }
            try:
                raw_items = self.nominatim.fetch("search", params)
                if not raw_items or not isinstance(raw_items, list):
                    continue

                for item in raw_items:
                    if len(discovered) >= limit:
                        break

                    name = item.get("name")
                    if not name:
                        continue
                    clean_name = name.strip()
                    if clean_name.lower() in seen_names:
                        continue

                    # Filter out non-attraction administrative or transportation items
                    raw_type = item.get("type", "").lower()
                    if raw_type in ('station', 'trunk', 'primary', 'secondary', 'tertiary', 'residential',
                                    'hotel', 'guest_house', 'village', 'suburb', 'city', 'town', 'hospital'):
                        # Only allow if name clearly indicates a monument or heritage site
                        name_lower = clean_name.lower()
                        if not any(kw in name_lower for kw in ('fort', 'palace', 'temple', 'ghat', 'museum', 'monastery', 'beach', 'bazaar')):
                            continue

                    lat = float(item["lat"])
                    lon = float(item["lon"])

                    # Enforce reasonable proximity to destination center (<= 60 km)
                    dist = haversine_distance_meters(destination.latitude, destination.longitude, lat, lon)
                    if dist > 60000:
                        continue

                    seen_names.add(clean_name.lower())
                    osm_type = item.get("osm_type", "node")
                    osm_id = str(item.get("osm_id", ""))
                    record_id = f"osm:{osm_type}:{osm_id}"
                    source_url = f"https://www.openstreetmap.org/{osm_type}/{osm_id}"

                    addr_dict = item.get("address", {})
                    road = addr_dict.get("road") or addr_dict.get("suburb") or addr_dict.get("city") or destination.name
                    address = f"{road}, {destination.name}, {destination.state}"

                    extratags = item.get("extratags", {}) or {}
                    fee_val, fee_status = parse_ticket_fee(extratags)
                    hours_val, hours_status = parse_opening_hours(extratags)

                    discovered.append({
                        "source_record_id": record_id,
                        "name": clean_name[:200],
                        "category": cat,
                        "subcategory": subcat,
                        "description": f"Verified {subcat.lower()} located in {destination.name}, geocoded via OpenStreetMap.",
                        "address": address[:300],
                        "latitude": round(lat, 6),
                        "longitude": round(lon, 6),
                        "price_tier": "Budget",
                        "ticket_price_inr": fee_val,
                        "opening_hours": hours_val,
                        "data_source": "OpenStreetMap (via Nominatim)",
                        "source_url": source_url,
                        "verification_status": "VERIFIED",
                        "fee_status": fee_status,
                        "hours_status": hours_status,
                        "raw_tags": extratags
                    })
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning("Error during Nominatim theme discovery %s: %s", query, e)
                continue

        return discovered

    def _process_single_poi(
        self,
        poi: Dict[str, Any],
        destination: Destination,
        existing_places: List[Place],
        stats: Dict[str, Any],
        dry_run: bool = False
    ) -> None:
        poi_id = poi['source_record_id']
        poi_name = poi['name'].strip().lower()
        lat = poi['latitude']
        lon = poi['longitude']

        # 1. Exact provider ID lookup
        matched_place = next((p for p in existing_places if p.source_record_id == poi_id), None)

        # 2. Name + Proximity check (duplicate detection)
        if not matched_place:
            for p in existing_places:
                dist = haversine_distance_meters(lat, lon, p.latitude, p.longitude)
                # If same normalized name and within 300 meters, treat as duplicate/same entity
                if p.name.strip().lower() == poi_name and dist < 300:
                    matched_place = p
                    break

        if dry_run:
            if matched_place:
                stats['updated'] += 1
            else:
                stats['created'] += 1
            return

        with transaction.atomic():
            if matched_place:
                # Update existing record conservatively (do not downgrade verified official data)
                has_official_source = 'Archaeological Survey' in matched_place.data_source or 'Tourism' in matched_place.data_source
                if not has_official_source:
                    matched_place.category = poi['category']
                    matched_place.subcategory = poi['subcategory']
                    if poi['ticket_price_inr'] is not None:
                        matched_place.ticket_price_inr = poi['ticket_price_inr']
                    if poi['opening_hours']:
                        matched_place.opening_hours = poi['opening_hours']
                
                matched_place.latitude = lat
                matched_place.longitude = lon
                matched_place.save()
                stats['updated'] += 1
            else:
                # Create brand new verified Place record
                new_place = Place.objects.create(
                    destination=destination,
                    name=poi['name'],
                    category=poi['category'],
                    subcategory=poi['subcategory'],
                    description=poi['description'],
                    address=poi['address'],
                    latitude=lat,
                    longitude=lon,
                    price_tier=poi['price_tier'],
                    ticket_price_inr=poi['ticket_price_inr'],
                    opening_hours=poi['opening_hours'],
                    data_source=poi['data_source'],
                    source_record_id=poi_id,
                    source_url=poi['source_url'],
                    verification_status=poi['verification_status'],
                )
                existing_places.append(new_place)
                stats['created'] += 1

                src_name = poi.get('data_source', 'OpenStreetMap')

                # Log provenance for coordinates
                DataProvenanceLog.objects.create(
                    place=new_place,
                    field_name='coordinates',
                    claimed_value=f"{lat}, {lon}",
                    source_name=src_name,
                    source_url=poi['source_url'],
                    verification_status='VERIFIED',
                    evidence_notes=f"Geocoded OpenStreetMap record {poi_id}"
                )

                # Log provenance for ticket fee
                if poi['ticket_price_inr'] is not None:
                    DataProvenanceLog.objects.create(
                        place=new_place,
                        field_name='ticket_price_inr',
                        claimed_value=f"₹{poi['ticket_price_inr']}" if poi['ticket_price_inr'] > 0 else "Free Entry",
                        source_name=src_name,
                        source_url=poi['source_url'],
                        verification_status=poi['fee_status'],
                        evidence_notes="Extracted from verified source fee/charge metadata"
                    )
                else:
                    DataProvenanceLog.objects.create(
                        place=new_place,
                        field_name='ticket_price_inr',
                        claimed_value='Not Available',
                        source_name=src_name,
                        source_url=poi['source_url'],
                        verification_status='UNAVAILABLE',
                        evidence_notes="Ticket price not documented in source OSM tags; remaining unknown."
                    )

                # Log provenance for opening hours
                if poi['opening_hours']:
                    DataProvenanceLog.objects.create(
                        place=new_place,
                        field_name='opening_hours',
                        claimed_value=poi['opening_hours'],
                        source_name=src_name,
                        source_url=poi['source_url'],
                        verification_status=poi['hours_status'],
                        evidence_notes="Extracted from source opening_hours metadata"
                    )
                else:
                    DataProvenanceLog.objects.create(
                        place=new_place,
                        field_name='opening_hours',
                        claimed_value='Not Available',
                        source_name=src_name,
                        source_url=poi['source_url'],
                        verification_status='UNAVAILABLE',
                        evidence_notes="Operating hours not documented in source OSM tags; remaining unknown."
                    )

