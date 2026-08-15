"""Speech-to-text for the requisition chat's voice input, via Deepgram
(Nova-3). Same "not configured yet" pattern as services/email.py (Resend)
and services/razorpay_service.py — a missing key is a real, expected state
before a real key is added, not a bug.
"""

from deepgram import DeepgramClient

from app.config import get_settings

settings = get_settings()


class SttNotConfiguredError(Exception):
    """Raised when DEEPGRAM_API_KEY is unset — expected until a real key is
    added to backend/.env."""


def transcribe_audio(audio_bytes: bytes, filename: str) -> str:
    """Synchronous SDK call — callers on the async request path must run
    this via run_in_threadpool, same pattern as the other sync-library calls
    in this app (see services/email.py, services/razorpay_service.py)."""
    if not settings.deepgram_api_key:
        raise SttNotConfiguredError(
            "Voice input isn't configured yet — add DEEPGRAM_API_KEY to backend/.env "
            "(from the Deepgram console)."
        )
    client = DeepgramClient(api_key=settings.deepgram_api_key)
    response = client.listen.v1.media.transcribe_file(
        request=audio_bytes,
        model="nova-3",
        smart_format=True,
        punctuate=True,
    )
    alternatives = response.results.channels[0].alternatives
    if not alternatives:
        return ""
    return (alternatives[0].transcript or "").strip()
