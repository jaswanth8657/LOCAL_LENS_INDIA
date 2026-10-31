import re
from typing import List, Dict, Any, Optional

# Semantic expansion keywords for Indian travel interests to enrich TF-IDF matching
INTEREST_SYNONYMS: Dict[str, List[str]] = {
    'food': ['culinary', 'food', 'cuisine', 'street', 'eats', 'thali', 'restaurant', 'cafe', 'taste', 'dining', 'snack', 'spices'],
    'culture': ['culture', 'heritage', 'art', 'tradition', 'monument', 'museum', 'craft', 'classical', 'folklore', 'temple'],
    'nature': ['nature', 'natural', 'greenery', 'park', 'garden', 'forest', 'serenity', 'hills', 'scenic', 'wildlife', 'outdoors'],
    'beach': ['beach', 'beaches', 'coastal', 'coastline', 'shore', 'sand', 'sea', 'ocean', 'bay', 'water', 'waves'],
    'beaches': ['beach', 'beaches', 'coastal', 'coastline', 'shore', 'sand', 'sea', 'ocean', 'bay', 'water', 'waves'],
    'history': ['history', 'historical', 'fort', 'fortress', 'palace', 'monument', 'ancient', 'ruins', 'archaeological', 'dynasty', 'memorial', 'heritage'],
    'heritage': ['heritage', 'history', 'monument', 'culture', 'tradition', 'archaeological', 'fort', 'palace', 'ruins'],
    'adventure': ['adventure', 'trek', 'trekking', 'trail', 'cave', 'watersports', 'kayaking', 'boating', 'hike', 'climbing'],
    'shopping': ['shopping', 'bazaar', 'market', 'handicrafts', 'textiles', 'silk', 'spices', 'mall', 'emporium', 'souvenirs'],
    'photography': ['photography', 'viewpoint', 'panoramic', 'sunset', 'sunrise', 'scenic', 'landscape', 'architecture', 'vista'],
    'temple': ['temple', 'temples', 'mandir', 'shrine', 'spiritual', 'sacred', 'worship', 'ashram', 'prayer', 'ghat', 'pilgrimage', 'deity'],
    'temples': ['temple', 'temples', 'mandir', 'shrine', 'spiritual', 'sacred', 'worship', 'ashram', 'prayer', 'ghat', 'pilgrimage', 'deity'],
}

def expand_synonyms(category: str) -> List[str]:
    """Returns a list of semantic synonyms for an interest category."""
    cat_clean = clean_text(category)
    return INTEREST_SYNONYMS.get(cat_clean, [cat_clean])

def clean_text(text: Optional[str]) -> str:
    """Lowercases, strips punctuation, and cleans extra whitespace."""
    if not text:
        return ""
    lowered = text.lower()
    cleaned = re.sub(r'[^a-zA-Z0-9\s]', ' ', lowered)
    return re.sub(r'\s+', ' ', cleaned).strip()

def build_place_document(place_dict: Dict[str, Any]) -> str:
    """
    Constructs an information-rich document representation for TF-IDF vectorization.
    Combines authentic place name, category, subcategory, description, and address.
    Does NOT invent factual details.
    """
    tokens: List[str] = []

    # Place name weighted 2x
    name = clean_text(place_dict.get('name'))
    if name:
        tokens.extend([name, name])

    # Category and subcategory
    cat = clean_text(place_dict.get('category'))
    if cat:
        tokens.append(cat)
        # Add curated synonyms for category
        if cat in INTEREST_SYNONYMS:
            tokens.extend(INTEREST_SYNONYMS[cat][:3])

    subcat = clean_text(place_dict.get('subcategory'))
    if subcat:
        tokens.append(subcat)

    # Destination name if present
    dest_name = clean_text(place_dict.get('destination_name'))
    if dest_name:
        tokens.append(dest_name)

    # Real description
    desc = clean_text(place_dict.get('description'))
    if desc:
        tokens.append(desc)

    # Address / Locality
    addr = clean_text(place_dict.get('address'))
    if addr:
        tokens.append(addr)

    doc = " ".join(tokens)
    return doc if doc else "attraction point of interest"

def build_user_query_document(interests: List[str], custom_keywords: Optional[str] = None) -> str:
    """
    Builds a vectorizable user preference query from selected interests.
    Expands interests using Indian travel synonyms.
    """
    query_tokens: List[str] = []

    for interest in interests:
        clean_int = clean_text(interest)
        if not clean_int:
            continue
        query_tokens.append(clean_int)
        query_tokens.append(clean_int)  # Repeat for frequency weight
        if clean_int in INTEREST_SYNONYMS:
            query_tokens.extend(INTEREST_SYNONYMS[clean_int])

    if custom_keywords:
        query_tokens.append(clean_text(custom_keywords))

    query_doc = " ".join(query_tokens)
    return query_doc if query_doc else "travel discovery destinations"
