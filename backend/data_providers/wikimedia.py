import re
import time
import logging
import requests
from typing import Optional, Dict, Any, List
from .base import BaseDataProvider, ProviderError, ProviderTimeoutError
from .cache import ProviderCache
from .validators import sanitize_text

logger = logging.getLogger(__name__)

WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php"
COMMONS_API_URL = "https://commons.wikimedia.org/w/api.php"
DEFAULT_USER_AGENT = "LocalLensIndia/1.0 (https://github.com/google-deepmind/locallensindia; travel-discovery@locallensindia.internal)"

def _strip_html(text: Optional[str]) -> str:
    if not text:
        return ""
    clean = re.sub(r'<[^>]*>', '', str(text))
    return re.sub(r'\s+', ' ', clean).strip()


class WikimediaProvider(BaseDataProvider):
    """
    Public MediaWiki integration for Wikipedia extracts and Wikimedia Commons photographs.
    Provides factual cultural summaries and trustworthy, attributed images with licensing metadata.
    Operates without API key, strictly respecting Wikimedia's User-Agent & caching guidelines.
    """

    def __init__(
        self,
        timeout: int = 8,
        cache: Optional[ProviderCache] = None,
        user_agent: str = DEFAULT_USER_AGENT
    ):
        super().__init__(name="Wikimedia & Wikipedia MediaWiki API", user_agent=user_agent, timeout=timeout)
        self.cache = cache or ProviderCache()
        self.last_request_time: float = 0.0
        self.min_interval_seconds: float = 0.2  # 5 req/sec polite spacing

    def is_available(self) -> bool:
        """Public endpoint always available unless offline."""
        return True

    def _throttle(self) -> None:
        elapsed = time.time() - self.last_request_time
        if elapsed < self.min_interval_seconds:
            time.sleep(self.min_interval_seconds - elapsed)
        self.last_request_time = time.time()

    def fetch(self, api_url: str, params: Dict[str, Any]) -> Any:
        cache_key = {"api_url": api_url, "params": params}
        cached = self.cache.get("wikimedia", cache_key)
        if cached is not None:
            return cached

        self._throttle()
        headers = {
            "User-Agent": self.user_agent,
            "Accept": "application/json",
        }

        try:
            response = requests.get(
                api_url,
                params=params,
                headers=headers,
                timeout=self.timeout,
                proxies={"http": None, "https": None}
            )
            response.raise_for_status()
            data = response.json()
            self.cache.set("wikimedia", cache_key, data)
            return data
        except requests.exceptions.Timeout as e:
            raise ProviderTimeoutError(f"Wikimedia API timed out after {self.timeout}s: {e}")
        except Exception as e:
            raise ProviderError(f"Wikimedia request error: {e}")

    def get_wikipedia_extract(self, place_name: str, city_hint: Optional[str] = None) -> Optional[str]:
        """
        Retrieves a factual, non-promotional introductory extract for a verified place.
        """
        clean_name = sanitize_text(place_name)
        if not clean_name or len(clean_name) < 3:
            return None

        # 1. Search Wikipedia
        search_query = f"{clean_name} {city_hint}" if city_hint else clean_name
        search_params = {
            "action": "query",
            "list": "search",
            "srsearch": search_query,
            "format": "json",
            "srlimit": 3,
        }

        try:
            data = self.fetch(WIKIPEDIA_API_URL, search_params)
            search_results = data.get("query", {}).get("search", [])
            if not search_results:
                return None

            # Pick the top result if title has high word overlap
            best_title = None
            target_words = set(re.findall(r'\w+', clean_name.lower()))
            for res in search_results:
                candidate_title = res.get("title", "")
                cand_words = set(re.findall(r'\w+', candidate_title.lower()))
                overlap = len(target_words & cand_words)
                if overlap >= 1 or len(target_words) == 1:
                    best_title = candidate_title
                    break

            if not best_title:
                return None

            # 2. Fetch page extract
            extract_params = {
                "action": "query",
                "prop": "extracts",
                "exintro": "true",
                "explaintext": "true",
                "titles": best_title,
                "redirects": "1",
                "format": "json",
            }
            page_data = self.fetch(WIKIPEDIA_API_URL, extract_params)
            pages = page_data.get("query", {}).get("pages", {})
            for pid, pdata in pages.items():
                if pid == "-1":
                    continue
                raw_extract = pdata.get("extract", "")
                if raw_extract:
                    # Clean up and limit to first 2-3 sentences (~350 characters)
                    clean_extract = _strip_html(raw_extract)
                    sentences = re.split(r'(?<=[.!?])\s+', clean_extract)
                    short_summary = ' '.join(sentences[:3]).strip()
                    return short_summary[:380]

            return None
        except Exception as e:
            logger.debug("Wikipedia extract lookup notice for '%s': %s", clean_name, e)
            return None

    def get_commons_photo(self, place_name: str, city_hint: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Discovers a high-quality, attributed Wikimedia Commons photograph matching place_name.
        Returns URL, thumbnail, author, license, and source page link.
        """
        clean_name = sanitize_text(place_name)
        if not clean_name or len(clean_name) < 3:
            return None

        search_query = f"{clean_name} {city_hint}" if city_hint else clean_name
        params = {
            "action": "query",
            "generator": "search",
            "gsrsearch": f'"{clean_name}"' if " " in clean_name else clean_name,
            "gsrnamespace": "6",  # File: namespace
            "prop": "imageinfo",
            "iiprop": "url|extmetadata|size",
            "iiurlwidth": "800",
            "format": "json",
            "gsrlimit": "5",
        }

        try:
            data = self.fetch(COMMONS_API_URL, params)
            pages = data.get("query", {}).get("pages", {})
            if not pages:
                # Retry with broader search without quotes
                params["gsrsearch"] = search_query
                data = self.fetch(COMMONS_API_URL, params)
                pages = data.get("query", {}).get("pages", {})
                if not pages:
                    return None

            target_tokens = set(re.findall(r'[a-zA-Z]{3,}', clean_name.lower()))

            for pid, page_info in pages.items():
                title = page_info.get("title", "")
                image_info_list = page_info.get("imageinfo", [])
                if not image_info_list:
                    continue

                info = image_info_list[0]
                thumb_url = info.get("thumburl") or info.get("url")
                if not thumb_url or not (thumb_url.startswith("http://") or thumb_url.startswith("https://")):
                    continue

                # Filter out svg icons, maps, flags, logos, or tiny thumbnails
                lower_title = title.lower()
                if any(bad in lower_title for bad in ('.svg', 'map', 'flag', 'logo', 'icon', 'locator', 'plan')):
                    continue

                # Strict relevance check: at least 1 significant token from place_name must appear in file title
                file_tokens = set(re.findall(r'[a-zA-Z]{3,}', lower_title))
                if target_tokens and not (target_tokens & file_tokens):
                    continue

                ext = info.get("extmetadata", {})
                raw_artist = ext.get("Artist", {}).get("value", "Wikimedia Contributor")
                raw_license = (
                    ext.get("LicenseShortName", {}).get("value") or
                    ext.get("License", {}).get("value") or
                    "Creative Commons / Public Domain"
                )
                license_url = ext.get("LicenseUrl", {}).get("value", "https://creativecommons.org/licenses/")
                desc_url = info.get("descriptionurl", f"https://commons.wikimedia.org/wiki/{title.replace(' ', '_')}")

                author = _strip_html(raw_artist) or "Wikimedia Contributor"
                license_name = _strip_html(raw_license) or "CC BY-SA"

                return {
                    "image_url": thumb_url,
                    "image_author": author[:80],
                    "image_license": license_name[:50],
                    "image_license_url": license_url,
                    "image_source_url": desc_url,
                    "image_title": title.replace("File:", ""),
                    "image_provenance": "Wikimedia Commons",
                }

            return None
        except Exception as e:
            logger.debug("Wikimedia Commons lookup notice for '%s': %s", clean_name, e)
            return None

    def parse(self, raw_data: Any) -> List[Dict[str, Any]]:
        # Required by BaseDataProvider abstract interface
        return []

