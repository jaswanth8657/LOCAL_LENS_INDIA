import re
import uuid
import logging
from typing import Dict, Any, List, Optional
from django.db.models import Q
from django.core.cache import cache
from destinations.models import Destination
from places.models import Place, DataProvenanceLog
from data_providers.overpass import OverpassProvider
from data_providers.nominatim import NominatimProvider
from data_providers.services import haversine_distance_meters
from data_providers.validators import (
    sanitize_text,
    parse_ticket_fee,
    parse_opening_hours,
    validate_coordinates
)
from data_providers.base import ProviderError, ProviderTimeoutError, ProviderRateLimitError

logger = logging.getLogger(__name__)

def _normalize_name(name: str) -> str:
    """Normalizes place name for robust deduplication."""
    return re.sub(r'[^a-z0-9]', '', (name or '').lower())

class LivePlaceSearchService:
    """
    Hybrid place discovery service combining:
    1. Local SQLite database records (verified & immutable).
    2. Real-time external OpenStreetMap/Nominatim/Overpass POI searches.
    
    Ensures that external results are never persisted automatically to SQLite
    unless explicitly imported by user action.
    """

    def __init__(
        self,
        overpass: Optional[OverpassProvider] = None,
        nominatim: Optional[NominatimProvider] = None
    ):
        self.overpass = overpass or OverpassProvider()
        self.nominatim = nominatim or NominatimProvider()

    def search_places(
        self,
        q: Optional[str] = None,
        destination_slug: Optional[str] = None,
        category: Optional[str] = None,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        radius: int = 15000,
        limit: int = 25,
        live: bool = True
    ) -> Dict[str, Any]:
        limit = max(1, min(limit, 50))
        radius = max(500, min(radius, 50000))
        clean_q = sanitize_text(q.strip()) if q else ""
        clean_dest = destination_slug.strip().lower() if destination_slug else ""
        clean_cat = category.strip().lower() if category and category.lower() != 'all' else ""

        # 1. Search Local Database
        places_qs = Place.objects.select_related('destination').prefetch_related('provenance_records')

        matched_dest = None
        if clean_dest:
            matched_dest = Destination.objects.filter(
                Q(slug=clean_dest) | Q(name__iexact=clean_dest)
            ).first()
            if matched_dest:
                places_qs = places_qs.filter(destination=matched_dest)
            else:
                places_qs = places_qs.filter(
                    Q(destination__slug__iexact=clean_dest) | Q(destination__name__icontains=clean_dest)
                )

        if clean_cat:
            places_qs = places_qs.filter(category__iexact=clean_cat)

        if clean_q:
            places_qs = places_qs.filter(
                Q(name__icontains=clean_q) |
                Q(address__icontains=clean_q) |
                Q(description__icontains=clean_q) |
                Q(subcategory__icontains=clean_q)
            )

        db_places = list(places_qs)

        # Build local results
        local_results: List[Dict[str, Any]] = []
        seen_names = set()
        seen_coords = []

        for p in db_places:
            dist = None
            if lat is not None and lon is not None:
                dist = haversine_distance_meters(lat, lon, p.latitude, p.longitude)
                if dist > radius and clean_dest == "":
                    # Outside radius when searching purely by coords without explicit destination
                    continue

            norm_name = _normalize_name(p.name)
            seen_names.add(norm_name)
            seen_coords.append((p.latitude, p.longitude, norm_name))

            # Determine provenance label
            is_imported = any(
                'Live Discovery' in (log.source_name or '') or 'Imported' in (log.field_name or '')
                for log in p.provenance_records.all()
            )
            prov_label = "Imported and persisted record" if is_imported else "Existing database record"

            local_results.append({
                "id": str(p.id),
                "name": p.name,
                "category": p.category,
                "subcategory": p.subcategory,
                "destination_slug": p.destination.slug if p.destination else "",
                "destination_name": p.destination.name if p.destination else "",
                "latitude": p.latitude,
                "longitude": p.longitude,
                "address": p.address,
                "description": p.description,
                "ticket_price_inr": p.ticket_price_inr,
                "typical_cost_inr": p.typical_cost_inr,
                "opening_hours": p.opening_hours,
                "rating": p.rating,
                "review_count": p.reviews_count,
                "image_url": getattr(p, 'image_url', ''),
                "match_score": p.match_score,
                "verification_status": p.verification_status,
                "result_type": "database",
                "provenance_label": prov_label,
                "is_persisted": True,
                "distance_meters": round(dist, 1) if dist is not None else None,
            })

        # 2. Live External Search (if requested and we have room or external search is enabled)
        external_results: List[Dict[str, Any]] = []
        if live:
            external_pois = self._fetch_external_pois(
                clean_q=clean_q,
                clean_dest=clean_dest,
                matched_dest=matched_dest,
                clean_cat=clean_cat,
                lat=lat,
                lon=lon,
                radius=radius,
                limit=limit
            )

            for poi in external_pois:
                poi_name = poi.get('name', '').strip()
                if not poi_name:
                    continue

                norm_poi = _normalize_name(poi_name)
                poi_lat = poi['latitude']
                poi_lon = poi['longitude']

                # Deduplication check against local database
                is_duplicate = False
                if norm_poi in seen_names:
                    is_duplicate = True
                else:
                    for exist_lat, exist_lon, exist_name in seen_coords:
                        coord_dist = haversine_distance_meters(exist_lat, exist_lon, poi_lat, poi_lon)
                        if coord_dist < 150:
                            is_duplicate = True
                            break
                        if coord_dist < 800 and (norm_poi in exist_name or exist_name in norm_poi):
                            is_duplicate = True
                            break

                if is_duplicate:
                    continue

                seen_names.add(norm_poi)
                seen_coords.append((poi_lat, poi_lon, norm_poi))

                dist = None
                if lat is not None and lon is not None:
                    dist = haversine_distance_meters(lat, lon, poi_lat, poi_lon)

                external_results.append({
                    "id": f"ext-{poi.get('source_record_id') or uuid.uuid4().hex[:8]}",
                    "name": poi_name,
                    "category": poi.get('category', clean_cat or 'culture'),
                    "subcategory": poi.get('subcategory', ''),
                    "destination_slug": matched_dest.slug if matched_dest else (clean_dest or ""),
                    "destination_name": matched_dest.name if matched_dest else (clean_dest.title() if clean_dest else ""),
                    "latitude": poi_lat,
                    "longitude": poi_lon,
                    "address": poi.get('address', ''),
                    "description": poi.get('description') or f"Real-world location discovered live via OpenStreetMap.",
                    "ticket_price_inr": poi.get('ticket_price_inr'),
                    "typical_cost_inr": poi.get('typical_cost_inr'),
                    "opening_hours": poi.get('opening_hours', ''),
                    "rating": None,  # Factual accuracy: do not fabricate ratings for external OSM data
                    "review_count": 0,
                    "image_url": poi.get('image_url', ''),
                    "match_score": 75,
                    "verification_status": "UNVERIFIED",
                    "result_type": "live_external",
                    "provenance_label": "Live external search result",
                    "is_persisted": False,
                    "source_record_id": poi.get('source_record_id', ''),
                    "osm_type": poi.get('osm_type', 'node'),
                    "osm_id": str(poi.get('osm_id', '')),
                    "distance_meters": round(dist, 1) if dist is not None else None,
                })

        # 3. Merge & Sort
        # If coordinates provided, sort combined list by distance; otherwise local records first
        if lat is not None and lon is not None:
            combined = sorted(
                local_results + external_results,
                key=lambda x: (x['distance_meters'] is None, x['distance_meters'] or 0)
            )
        else:
            combined = local_results + external_results

        final_slice = combined[:limit]

        return {
            "query": clean_q,
            "destination": clean_dest,
            "category": clean_cat or "all",
            "total_count": len(final_slice),
            "database_count": sum(1 for r in final_slice if r['result_type'] == 'database'),
            "live_external_count": sum(1 for r in final_slice if r['result_type'] == 'live_external'),
            "results": final_slice
        }

    def _fetch_external_pois(
        self,
        clean_q: str,
        clean_dest: str = "",
        matched_dest: Optional[Destination] = None,
        clean_cat: str = "",
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        radius: int = 15000,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Safely fetches and parses external POIs with caching and rate limiting."""
        # Determine center coordinates
        center_lat = lat
        center_lon = lon
        if center_lat is None or center_lon is None:
            if matched_dest:
                center_lat = matched_dest.latitude
                center_lon = matched_dest.longitude
            elif clean_dest:
                try:
                    geocoded = self.nominatim.geocode_destination(f"{clean_dest}, India")
                    if not geocoded:
                        geocoded = self.nominatim.geocode_destination(clean_dest)
                    if geocoded:
                        center_lat = geocoded["latitude"]
                        center_lon = geocoded["longitude"]
                except Exception as e:
                    logger.warning("Nominatim destination geocoding notice for '%s': %s", clean_dest, e)

        safe_q = re.sub(r'[^a-zA-Z0-9_-]', '_', clean_q)
        safe_dest = re.sub(r'[^a-zA-Z0-9_-]', '_', clean_dest)
        safe_cat = re.sub(r'[^a-zA-Z0-9_-]', '_', clean_cat)
        cache_key = (
            f"ext_poi_v1_{center_lat}_{center_lon}_{radius}_{safe_q}_{safe_dest}_{safe_cat}_{limit}"
        )
        cached_pois = cache.get(cache_key)
        if cached_pois is not None:
            return cached_pois

        discovered_pois: List[Dict[str, Any]] = []
        seen_keys = set()

        # Strategy A: If center coordinates exist, use Overpass bounding radius
        if center_lat is not None and center_lon is not None:
            try:
                query = self.overpass.build_query(
                    lat=center_lat,
                    lon=center_lon,
                    radius_meters=radius,
                    limit=limit
                )
                raw_data = self.overpass.fetch(query)
                parsed = self.overpass.parse(raw_data)
                for item in parsed:
                    if clean_cat and item.get('category') != clean_cat:
                        continue
                    if clean_q and clean_q.lower() not in item.get('name', '').lower():
                        continue
                    key = (item.get('osm_type', 'node'), str(item.get('osm_id', ''))) if item.get('osm_id') else item.get('name')
                    if key in seen_keys:
                        continue
                    seen_keys.add(key)
                    discovered_pois.append(item)
            except Exception as e:
                logger.warning("Overpass live search notice: %s", e)

        # Strategy B: If Overpass yielded few results or no center coordinates, try Nominatim search
        if len(discovered_pois) < limit and (clean_q or clean_dest):
            try:
                if clean_q:
                    if matched_dest:
                        search_query = f"{clean_q}, {matched_dest.name}, India"
                    elif clean_dest:
                        search_query = f"{clean_q}, {clean_dest}, India"
                    else:
                        search_query = f"{clean_q}, India"
                else:
                    target_cat = f"{clean_cat} " if clean_cat else ""
                    search_query = f"{target_cat}attractions in {clean_dest}, India"

                params = {
                    "q": search_query,
                    "countrycodes": "in",
                    "format": "jsonv2",
                    "addressdetails": 1,
                    "limit": min(limit, 10),
                }
                raw_nominatim = self.nominatim.fetch("search", params)
                if isinstance(raw_nominatim, list):
                    for r in raw_nominatim:
                        p_name = sanitize_text(r.get("name") or clean_q or r.get("display_name", "").split(",")[0])
                        if not p_name:
                            continue
                        try:
                            p_lat, p_lon = validate_coordinates(float(r["lat"]), float(r["lon"]))
                        except Exception:
                            continue

                        osm_t = r.get('osm_type', 'node')
                        osm_i = str(r.get('osm_id', ''))
                        key = (osm_t, osm_i) if osm_i else p_name
                        if key in seen_keys:
                            continue
                        seen_keys.add(key)

                        discovered_pois.append({
                            "name": p_name,
                            "category": clean_cat or "culture",
                            "subcategory": r.get("type", "attraction"),
                            "latitude": p_lat,
                            "longitude": p_lon,
                            "address": sanitize_text(r.get("display_name", "")),
                            "description": "Point of interest discovered via OpenStreetMap.",
                            "ticket_price_inr": None,
                            "typical_cost_inr": None,
                            "opening_hours": "",
                            "source_record_id": f"nominatim_{osm_t}_{osm_i}",
                            "osm_type": osm_t,
                            "osm_id": osm_i,
                        })
            except Exception as e:
                logger.warning("Nominatim live search notice: %s", e)

        # Cache for 300 seconds
        cache.set(cache_key, discovered_pois, timeout=300)
        return discovered_pois

    def import_external_place(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Explicitly persists a live external search result to SQLite.
        Guarantees that unpersisted live items only become permanent upon user request.
        """
        name = sanitize_text(data.get('name', '').strip())
        if not name:
            raise ValueError("Place name is required for import.")

        dest_slug = data.get('destination_slug', '').strip().lower()
        destination = Destination.objects.filter(slug=dest_slug).first()
        if not destination:
            # Fallback to nearest destination if coordinates available
            lat = float(data.get('latitude', 0))
            lon = float(data.get('longitude', 0))
            all_dests = list(Destination.objects.all())
            if all_dests and lat and lon:
                destination = min(
                    all_dests,
                    key=lambda d: haversine_distance_meters(lat, lon, d.latitude, d.longitude)
                )

        if not destination:
            raise ValueError("Valid Indian destination is required to persist a place.")

        lat = float(data['latitude'])
        lon = float(data['longitude'])
        category = sanitize_text(data.get('category', 'culture')).lower()
        address = sanitize_text(data.get('address', f"{name}, {destination.name}"))
        source_id = sanitize_text(data.get('source_record_id') or f"osm_manual_{uuid.uuid4().hex[:8]}")

        place, created = Place.objects.update_or_create(
            destination=destination,
            name=name,
            defaults={
                "category": category,
                "subcategory": sanitize_text(data.get('subcategory', 'attraction')),
                "latitude": lat,
                "longitude": lon,
                "address": address,
                "description": sanitize_text(data.get('description', f"Imported attraction in {destination.name}.")),
                "ticket_price_inr": data.get('ticket_price_inr'),
                "opening_hours": sanitize_text(data.get('opening_hours', '')),
                "verification_status": "ESTIMATED",
                "source_record_id": source_id,
                "match_score": 80
            }
        )

        # Log immutable DataProvenanceLog record
        osm_type = data.get('osm_type', 'node')
        osm_id = data.get('osm_id', '')
        source_uri = f"https://www.openstreetmap.org/{osm_type}/{osm_id}" if osm_id else "https://www.openstreetmap.org"

        DataProvenanceLog.objects.create(
            place=place,
            field_name="live_discovery_import",
            claimed_value=f"Coordinates: {lat}, {lon} | Address: {address[:100]}",
            source_name="OpenStreetMap / Live Discovery",
            source_url=source_uri,
            verification_status="ESTIMATED",
            evidence_notes="Imported via Live Discovery Search user action"
        )

        return {
            "id": str(place.id),
            "name": place.name,
            "category": place.category,
            "subcategory": place.subcategory,
            "destination_slug": destination.slug,
            "destination_name": destination.name,
            "latitude": place.latitude,
            "longitude": place.longitude,
            "address": place.address,
            "description": place.description,
            "ticket_price_inr": place.ticket_price_inr,
            "typical_cost_inr": place.typical_cost_inr,
            "opening_hours": place.opening_hours,
            "rating": place.rating,
            "review_count": place.reviews_count,
            "image_url": getattr(place, 'image_url', ''),
            "match_score": place.match_score,
            "verification_status": place.verification_status,
            "result_type": "database",
            "provenance_label": "Imported and persisted record",
            "is_persisted": True,
            "created": created
        }
