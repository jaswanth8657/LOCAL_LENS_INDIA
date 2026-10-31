import os
import json
import hashlib
import time
from pathlib import Path
from typing import Optional, Any

class ProviderCache:
    """
    Lightweight, disk-based JSON query cache with configurable TTL.
    Prevents repeated queries to public Overpass and Nominatim servers.
    """

    def __init__(self, cache_dir: Optional[Path] = None, default_ttl_seconds: Optional[int] = None):
        if cache_dir is None:
            base_dir = Path(__file__).resolve().parent.parent
            self.cache_dir = base_dir / '.provider_cache'
        else:
            self.cache_dir = Path(cache_dir)
        
        if default_ttl_seconds is not None:
            self.default_ttl = default_ttl_seconds
        else:
            try:
                self.default_ttl = int(os.getenv("DATA_CACHE_TTL", "86400"))
            except ValueError:
                self.default_ttl = 86400
        os.makedirs(self.cache_dir, exist_ok=True)

    def _get_key(self, namespace: str, key_data: Any) -> str:
        serialized = json.dumps(key_data, sort_keys=True)
        hash_digest = hashlib.sha256(serialized.encode('utf-8')).hexdigest()
        return f"{namespace}_{hash_digest}.json"

    def get(self, namespace: str, key_data: Any) -> Optional[Any]:
        filename = self._get_key(namespace, key_data)
        file_path = self.cache_dir / filename
        if not file_path.exists():
            return None

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                record = json.load(f)
            
            timestamp = record.get('_cached_at', 0)
            ttl = record.get('_ttl', self.default_ttl)
            if time.time() - timestamp > ttl:
                # Expired
                return None
            return record.get('payload')
        except Exception:
            return None

    def set(self, namespace: str, key_data: Any, payload: Any, ttl_seconds: Optional[int] = None) -> None:
        filename = self._get_key(namespace, key_data)
        file_path = self.cache_dir / filename
        record = {
            '_cached_at': time.time(),
            '_ttl': ttl_seconds if ttl_seconds is not None else self.default_ttl,
            'payload': payload,
        }
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(record, f, ensure_ascii=False, indent=2)
        except Exception as e:
            # Non-fatal if cache fails to write
            pass

    def clear(self) -> None:
        """Clear all cached files."""
        for file in self.cache_dir.glob('*.json'):
            try:
                file.unlink()
            except Exception:
                pass

