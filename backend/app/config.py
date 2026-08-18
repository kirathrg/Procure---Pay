from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_key: str
    supabase_jwt_secret: str
    database_url: str  # asyncpg connection string to Supabase Postgres

    # Groq (hosted LLM) — see app/services/gemini.py for why the module/class
    # names still say "gemini": routers import GeminiService/get_gemini_service
    # unchanged, only what's behind them changed, first to a local Ollama
    # model (to avoid the Gemini free-tier daily quota during development),
    # then to Groq's hosted API once the app needed to run on a server
    # without a GPU. Groq's free tier comfortably covers this app's usage —
    # a handful of short, human-paced calls per requisition/match/anomaly,
    # never bulk or scheduled.
    groq_api_key: str = ""
    gemini_chat_model: str = "openai/gpt-oss-20b"
    gemini_narrative_model: str = "openai/gpt-oss-20b"

    # Storage buckets
    receipts_bucket: str = "receipts"
    invoices_bucket: str = "invoices"

    # Resend (emailing POs to suppliers). Empty until a key is added to .env —
    # see services/email.py for how the missing-key case is handled.
    resend_api_key: str = ""
    resend_from_email: str = "onboarding@resend.dev"
    """Resend's shared sandbox sender — works with no domain verification, but
    can typically only deliver to the email address the Resend account signed
    up with until a real domain is verified in the Resend dashboard."""
    resend_test_redirect_email: str = ""
    """While set, every "email PO to supplier" send is redirected to this
    address instead of the supplier's real contact email — needed because the
    Resend sandbox can only deliver to the account owner's own inbox until a
    domain is verified, and the seeded suppliers all have fake @*.example
    addresses that would never be a real recipient anyway. The email body
    still names the supplier's actual (real-looking-but-unreachable) address
    so it's clear this was a redirected test send, not a real delivery. Unset
    this once a verified domain makes real supplier addresses deliverable."""

    # Razorpay (manager payment approval, test mode). Empty until real test
    # keys are added to .env — see services/razorpay_service.py for how the
    # missing-keys case is handled (same pattern as resend_api_key above).
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""

    # Deepgram (Nova-3 speech-to-text for the requisition chat's voice
    # input) — chosen over AssemblyAI for better accuracy on real-world
    # accented/noisy audio, and over Groq-hosted Whisper for lower latency
    # on short clips. Empty until a key is added — see services/stt.py.
    deepgram_api_key: str = ""

    # OCR.space (invoice field extraction) — swapped in from local PaddleOCR
    # so the backend fits a free-tier host's RAM/disk budget; also measured
    # faster end-to-end than local CPU inference. Empty until a key is
    # added — see services/ocr.py.
    ocr_space_api_key: str = ""

    # App
    cors_origins: str = "http://localhost:5173"


@lru_cache
def get_settings() -> Settings:
    return Settings()
