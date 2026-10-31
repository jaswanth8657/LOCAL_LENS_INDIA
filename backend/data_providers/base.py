from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

class ProviderError(Exception):
    """Base exception for all external data provider issues."""
    pass

class ProviderTimeoutError(ProviderError):
    """Raised when an external API times out."""
    pass

class ProviderRateLimitError(ProviderError):
    """Raised when an external API indicates throttling or HTTP 429."""
    pass

class ValidationError(ProviderError):
    """Raised when incoming external data fails sanity or geographic bounds validation."""
    pass


class BaseDataProvider(ABC):
    """
    Abstract interface for external factual data providers.
    Every provider must identify itself, respect rate limits, support caching,
    and convert external responses into standardized POI dictionaries.
    """

    def __init__(self, name: str, user_agent: str, timeout: int = 15):
        self.name = name
        self.user_agent = user_agent
        self.timeout = timeout

    @abstractmethod
    def fetch(self, **kwargs) -> Any:
        """Fetch raw data from the external source."""
        pass

    @abstractmethod
    def parse(self, raw_data: Any) -> List[Dict[str, Any]]:
        """Transform raw external payload into normalized place records."""
        pass

