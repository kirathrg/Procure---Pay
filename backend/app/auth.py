import uuid

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwk, jwt

from app.config import get_settings

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=False)

# Supabase now signs tokens with an asymmetric key (ES256) rather than the
# legacy shared HS256 secret. Verification uses the project's public JWKS
# endpoint, not SUPABASE_JWT_SECRET (kept in config for projects that still
# use the legacy symmetric secret, but this project's active signing key is
# ES256, confirmed via jwt.get_unverified_header() on a real issued token).
_jwks_cache: dict | None = None


async def _get_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache is None:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json", timeout=10)
            resp.raise_for_status()
            _jwks_cache = resp.json()
    return _jwks_cache


class CurrentUser:
    def __init__(self, id: uuid.UUID, email: str | None):
        self.id = id
        self.email = email


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing authorization header")

    token = credentials.credentials

    try:
        header = jwt.get_unverified_header(token)
        jwks = await _get_jwks()
        matching_key = next((k for k in jwks["keys"] if k["kid"] == header.get("kid")), None)
        if matching_key is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown signing key")

        public_key = jwk.construct(matching_key, algorithm=matching_key["alg"])
        payload = jwt.decode(
            token,
            public_key.to_pem().decode("utf-8"),
            algorithms=[matching_key["alg"]],
            audience="authenticated",
        )
    except JWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token") from exc

    subject = payload.get("sub")
    if subject is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token missing subject claim")

    return CurrentUser(id=uuid.UUID(subject), email=payload.get("email"))
