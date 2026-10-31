import abc
import json
import re
from typing import Dict, Any, Optional

class ProviderStatus:
    def __init__(self, name: str, available: bool, message: str, model: str = ""):
        self.name = name
        self.available = available
        self.message = message
        self.model = model

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "available": self.available,
            "message": self.message,
            "model": self.model
        }


class BaseAIProvider(abc.ABC):
    """Abstract base class for all AI itinerary generation providers."""

    def __init__(self, name: str):
        self.name = name

    @abc.abstractmethod
    def generate_plan(self, user_prompt: str, system_instruction: str) -> Dict[str, Any]:
        """
        Executes generation against provider.
        Returns parsed JSON dict matching RawAIItinerary or raises an exception.
        """
        pass

    @abc.abstractmethod
    def check_health(self) -> ProviderStatus:
        """Returns availability and configuration health status."""
        pass

    @staticmethod
    def extract_json_from_response(text: str) -> Dict[str, Any]:
        """
        Robustly extracts JSON from LLM response text, stripping markdown codeblocks,
        leading/trailing preambles, and conversational artifacts.
        """
        if not text or not text.strip():
            raise ValueError("Provider returned an empty response.")

        clean = text.strip()

        # Handle ```json ... ``` or ``` ... ```
        if "```" in clean:
            matches = re.findall(r'```(?:json)?\s*([\s\S]*?)\s*```', clean)
            if matches:
                clean = matches[0].strip()

        # If not matching fences, find outermost { and }
        start = clean.find('{')
        end = clean.rfind('}')
        if start != -1 and end != -1 and end > start:
            clean = clean[start:end+1]

        try:
            return json.loads(clean)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse provider response into valid JSON: {e}")

