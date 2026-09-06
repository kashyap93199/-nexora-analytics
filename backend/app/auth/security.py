"""Password hashing and JWT token creation/validation."""

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import settings

TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8"), bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)
    ).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def utcnow() -> datetime:
    """Naive UTC timestamp, matching the naive DateTime columns used by the ORM.

    Kept here (instead of ``datetime.UTC``) so the backend runs on Python 3.10,
    which the README documents as the minimum supported version.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _create_token(subject: str, token_type: str, expires_delta: timedelta, extra: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: int, organization_id: int | None = None) -> str:
    """Access token bound to the workspace the user is currently working in.

    ``org`` lets one user belong to several organizations and switch between
    them; requests are scoped to the organization named in the token.
    """
    extra = {"org": organization_id} if organization_id is not None else None
    return _create_token(
        str(user_id), TOKEN_TYPE_ACCESS, timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES), extra
    )


def create_refresh_token(user_id: int, organization_id: int | None = None) -> str:
    extra = {"org": organization_id} if organization_id is not None else None
    return _create_token(
        str(user_id), TOKEN_TYPE_REFRESH, timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS), extra
    )


def decode_token(token: str, expected_type: str | None = None) -> dict:
    """Decode and validate a JWT. Raises jwt.PyJWTError on failure."""
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    if expected_type and payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(f"Expected token type '{expected_type}'")
    return payload