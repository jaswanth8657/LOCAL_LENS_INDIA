import os
import logging
from typing import Dict, Any, Optional
from .base import BaseAIProvider, ProviderStatus

logger = logging.getLogger(__name__)

class GeminiProvider(BaseAIProvider):
    """
    Primary AI Provider using Google Gemini API.
    Interacts via Google GenAI SDK (google-genai) with configured timeout and fallback.
    Never hardcodes or logs API keys.
    """

    def __init__(self):
        super().__init__(name="GEMINI")
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()
        try:
            self.timeout_sec = float(os.getenv("AI_REQUEST_TIMEOUT", "25"))
        except ValueError:
            self.timeout_sec = 25.0

    def check_health(self) -> ProviderStatus:
        if not self.api_key:
            return ProviderStatus(
                name=self.name,
                available=False,
                message="GEMINI_API_KEY not configured in environment variables.",
                model=self.model_name
            )
        return ProviderStatus(
            name=self.name,
            available=True,
            message="Gemini API credentials configured and ready.",
            model=self.model_name
        )

    def generate_plan(self, user_prompt: str, system_instruction: str) -> Dict[str, Any]:
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured in environment variables.")

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=self.api_key)

            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                temperature=0.2,
            )

            # Generate content with configured model
            response = client.models.generate_content(
                model=self.model_name,
                contents=user_prompt,
                config=config,
            )

            if not response or not response.text:
                raise ValueError("Gemini returned an empty response.")

            parsed_data = self.extract_json_from_response(response.text)
            return parsed_data

        except Exception as e:
            err_msg = str(e)
            # Mask any accidental sensitive tokens
            if self.api_key and self.api_key in err_msg:
                err_msg = err_msg.replace(self.api_key, "[REDACTED_API_KEY]")

            if "429" in err_msg or "ResourceExhausted" in err_msg:
                logger.warning("Gemini rate limit or quota exceeded.")
                raise RuntimeError(f"Gemini quota exhausted / rate limit hit: {err_msg}")
            elif "401" in err_msg or "403" in err_msg or "API_KEY_INVALID" in err_msg:
                logger.error("Gemini authentication failure.")
                raise PermissionError(f"Gemini authentication failed: {err_msg}")
            elif "timeout" in err_msg.lower() or "deadline" in err_msg.lower():
                logger.warning(f"Gemini request timed out after {self.timeout_sec}s.")
                raise TimeoutError(f"Gemini request timed out: {err_msg}")
            else:
                logger.error(f"Gemini generation failure: {err_msg}")
                raise RuntimeError(f"Gemini provider error: {err_msg}")

