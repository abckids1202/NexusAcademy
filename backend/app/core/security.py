from __future__ import annotations

from datetime import datetime, timedelta, timezone
from hashlib import pbkdf2_hmac
from hmac import compare_digest
from secrets import token_hex
import base64
import json
import uuid

from app.core.config import settings

def hash_password(password: str) -> str:
    salt = token_hex(16)
    digest = pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
    return f"pbkdf2_sha256${salt}${base64.b64encode(digest).decode()}"

def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt, encoded = stored.split("$", 2)
    except ValueError:
        return False
    digest = pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
    return compare_digest(base64.b64encode(digest).decode(), encoded)

def create_token(subject: str, token_type: str, minutes: int | None = None, days: int | None = None) -> str:
    exp = datetime.now(timezone.utc) + (timedelta(days=days) if days else timedelta(minutes=minutes or 30))
    payload = {"sub": subject, "typ": token_type, "exp": int(exp.timestamp()), "jti": str(uuid.uuid4())}
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    signature = pbkdf2_hmac("sha256", body.encode(), settings.jwt_secret.encode(), 2_000)
    return f"{body}.{base64.urlsafe_b64encode(signature).decode().rstrip('=')}"

def decode_token(token: str, expected_type: str) -> dict:
    try:
        body, signature = token.split(".", 1)
        expected = base64.urlsafe_b64encode(pbkdf2_hmac("sha256", body.encode(), settings.jwt_secret.encode(), 2_000)).decode().rstrip("=")
        if not compare_digest(signature, expected):
            raise ValueError("bad signature")
        payload = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
    except Exception as exc:
        raise ValueError("invalid token") from exc
    if payload.get("typ") != expected_type or payload.get("exp", 0) < int(datetime.now(timezone.utc).timestamp()):
        raise ValueError("expired token")
    return payload
