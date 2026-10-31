import os
import logging
import requests
from typing import Dict, Any, Optional
from .base import BaseAIProvider, ProviderStatus

logger = logging.getLogger(__name__)

class OllamaProvider(BaseAIProvider):
    """
    Automatic local AI fallback using Ollama's local HTTP API.
    Interacts via localhost:11434 with format='json'.
    Supports primary model (default 'gemma3:4b') and secondary fallback model (default 'qwen2.5:3b').
    Does not require Ollama to be running to start Django.
    """

    def __init__(self):
        super().__init__(name="OLLAMA")
        self.base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip('/')
        self.model_name = os.getenv("OLLAMA_MODEL", "gemma3:4b").strip()
        self.fallback_model = os.getenv("OLLAMA_FALLBACK_MODEL", "qwen2.5:3b").strip()
        try:
            self.timeout_sec = float(os.getenv("AI_REQUEST_TIMEOUT", "60"))
        except ValueError:
            self.timeout_sec = 60.0

    def check_health(self) -> ProviderStatus:
        """Checks if local Ollama daemon is reachable and which models are pulled."""
        try:
            url = f"{self.base_url}/api/tags"
            resp = requests.get(url, timeout=3.0)
            if resp.status_code == 200:
                data = resp.json()
                raw_models = [m.get('name', '') for m in data.get('models', [])]
                base_models = [m.split(':')[0] for m in raw_models]
                all_model_identifiers = set(raw_models + base_models)

                primary_avail = (
                    self.model_name in all_model_identifiers
                    or self.model_name.split(':')[0] in all_model_identifiers
                )
                fallback_avail = (
                    bool(self.fallback_model)
                    and (
                        self.fallback_model in all_model_identifiers
                        or self.fallback_model.split(':')[0] in all_model_identifiers
                    )
                )

                if primary_avail:
                    extra = f" (fallback: {self.fallback_model})" if fallback_avail else ""
                    return ProviderStatus(
                        name=self.name,
                        available=True,
                        message=f"Ollama running with primary model '{self.model_name}'{extra}.",
                        model=self.model_name
                    )
                elif fallback_avail:
                    return ProviderStatus(
                        name=self.name,
                        available=True,
                        message=f"Ollama running with fallback model '{self.fallback_model}' (primary '{self.model_name}' not available).",
                        model=self.fallback_model
                    )
                else:
                    return ProviderStatus(
                        name=self.name,
                        available=False,
                        message=f"Ollama running but neither primary '{self.model_name}' nor fallback '{self.fallback_model}' is pulled.",
                        model=self.model_name
                    )
            return ProviderStatus(
                name=self.name,
                available=False,
                message=f"Ollama returned HTTP status {resp.status_code}",
                model=self.model_name
            )
        except requests.exceptions.RequestException as e:
            return ProviderStatus(
                name=self.name,
                available=False,
                message=f"Ollama daemon not reachable at {self.base_url}: {e}",
                model=self.model_name
            )

    def generate_plan(self, user_prompt: str, system_instruction: str, model_name: Optional[str] = None) -> Dict[str, Any]:
        target_model = (model_name or self.model_name).strip()
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": target_model,
            "prompt": user_prompt,
            "system": system_instruction,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.2,
            }
        }

        try:
            resp = requests.post(url, json=payload, timeout=self.timeout_sec)
        except requests.exceptions.ConnectTimeout:
            raise TimeoutError(f"Ollama connection timed out after {self.timeout_sec}s for model '{target_model}'.")
        except requests.exceptions.ReadTimeout:
            raise TimeoutError(f"Ollama generation timed out after {self.timeout_sec}s for model '{target_model}'.")
        except requests.exceptions.ConnectionError as e:
            raise ConnectionError(f"Could not connect to Ollama daemon at {self.base_url}: {e}")
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Ollama HTTP error with model '{target_model}': {e}")

        if resp.status_code == 404:
            raise LookupError(f"Ollama model '{target_model}' not found. Run: ollama pull {target_model}")
        elif resp.status_code != 200:
            raise RuntimeError(f"Ollama API returned HTTP {resp.status_code} for '{target_model}': {resp.text}")

        try:
            data = resp.json()
            raw_text = data.get("response", "")
            return self.extract_json_from_response(raw_text)
        except Exception as e:
            raise ValueError(f"Failed to process Ollama response from '{target_model}': {e}")

