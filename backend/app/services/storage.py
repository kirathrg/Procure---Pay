"""Uploads receipt/invoice images to Supabase Storage using the service-role
key (server-side only — never exposed to the frontend). Returns a public URL
suitable for storing on the Receipt/Invoice row and displaying later."""

import uuid

from supabase import Client, create_client

from app.config import get_settings

settings = get_settings()

_client: Client | None = None


def _get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _client


def upload_image(bucket: str, content: bytes, content_type: str, extension: str) -> str:
    """Uploads `content` to `bucket` under a fresh random filename and
    returns its public URL."""
    path = f"{uuid.uuid4()}.{extension}"
    client = _get_client()
    client.storage.from_(bucket).upload(
        path, content, file_options={"content-type": content_type}
    )
    return client.storage.from_(bucket).get_public_url(path)
