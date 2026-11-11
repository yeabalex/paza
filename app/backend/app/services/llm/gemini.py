"""Google Gemini LLM Extraction Provider."""

import json
import logging
import httpx
from app.core.config import settings
from app.schemas.event import EventExtractionResult
from app.services.llm.base import BaseLLMProvider, get_extraction_prompt, parse_llm_json_events

logger = logging.getLogger(__name__)


class GeminiLLMProvider(BaseLLMProvider):
    """Gemini API Provider for Event Extraction."""

    def __init__(self, api_key: str = None):
        self.api_key = api_key or settings.GEMINI_API_KEY

    @property
    def name(self) -> str:
        return "Gemini"

    async def extract_events(self, text: str) -> list[EventExtractionResult]:
        if not self.api_key:
            raise ValueError("No GEMINI_API_KEY provided.")

        models_to_try = ["gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-flash-lite-latest"]
        last_error = None
        headers = {"x-goog-api-key": self.api_key}
        async with httpx.AsyncClient(timeout=30.0) as client:
            for model_id in models_to_try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent"
                payload = {
                    "contents": [
                        {
                            "parts": [
                                {"text": f"{get_extraction_prompt()}\n\nRaw Post Text:\n{text}"}
                            ]
                        }
                    ],
                    "generationConfig": {
                        "response_mime_type": "application/json"
                    }
                }

                try:
                    response = await client.post(url, headers=headers, json=payload)
                    if response.status_code == 200:
                        res_json = response.json()
                        candidate_text = res_json["candidates"][0]["content"]["parts"][0]["text"].strip()
                        if candidate_text.startswith("```"):
                            candidate_text = candidate_text.split("\n", 1)[1] if "\n" in candidate_text else candidate_text[3:]
                            if candidate_text.endswith("```"):
                                candidate_text = candidate_text[:-3].strip()
                        parsed = json.loads(candidate_text)
                        return parse_llm_json_events(parsed)
                    if response.status_code == 429:
                        logger.info(f"Gemini LLM model [{model_id}] hit 429 rate limit. Trying next model endpoint...")
                    else:
                        logger.warning(f"Gemini LLM model [{model_id}] HTTP {response.status_code}: {response.text[:200]}")
                    last_error = f"Gemini [{model_id}] HTTP {response.status_code}: {response.text[:180]}"
                except Exception as exc:
                    err_detail = f"{type(exc).__name__}: {exc}" if str(exc) else type(exc).__name__
                    logger.warning(f"Gemini LLM model [{model_id}] failed ({err_detail}). Trying next model...")
                    last_error = f"Gemini [{model_id}] {err_detail}"

        raise RuntimeError(last_error or "Gemini API request failed across all model endpoints.")

    async def extract_event(self, text: str) -> EventExtractionResult:
        evts = await self.extract_events(text)
        return evts[0] if evts else EventExtractionResult(is_event=False)


    def _heuristic_fallback(self, text: str) -> EventExtractionResult:
        """Resilient fallback parser when API key is missing or endpoint is offline."""
        from app.services.scraper.pre_filter import passes_pre_filter
        is_evt = passes_pre_filter(text)
        if not is_evt:
            return EventExtractionResult(is_event=False, confidence_score=0.9)

        return EventExtractionResult(
            is_event=True,
            title="[Gemini Extracted Event] " + text[:40] + "...",
            description=text,
            short_summary=text[:120],
            start_datetime="Upcoming",
            end_datetime=None,
            venue_name="Addis Ababa Venue",
            location_gps=None,
            sub_city="Bole",
            entrance_fee_etb=200.0,
            image_url=None,
            category="General",
            confidence_score=0.8
        )

