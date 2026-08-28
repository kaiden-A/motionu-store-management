import time
from typing import Any

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWK, PyJWKSet, get_unverified_header
from pydantic import BaseModel

from app.config import get_settings

bearer_scheme = HTTPBearer(auto_error=False)

JWKS_CACHE: dict[str, Any] = {"keys": None, "fetched_at": 0.0}
JWKS_TTL = 300  # seconds

USERINFO_CACHE: dict[str, tuple[float, str]] = {}
USERINFO_TTL = 900  # seconds

BACKFILLED_SUBS: set[str] = set()


class UserPrincipal(BaseModel):
    sub: str
    name: str
    email: str
    roles: list[str]

    @property
    def is_admin(self) -> bool:
        admin = set(get_settings().admin_roles)
        return bool(set(self.roles) & admin)


def _fetch_jwks() -> dict[str, Any]:
    settings = get_settings()
    now = time.time()
    cached = JWKS_CACHE["keys"]
    if cached is not None and now - JWKS_CACHE["fetched_at"] < JWKS_TTL:
        return cached
    with httpx.Client(timeout=10) as client:
        resp = client.get(settings.zitadel_jwks_uri)
        resp.raise_for_status()
        data = resp.json()
    JWKS_CACHE["keys"] = data
    JWKS_CACHE["fetched_at"] = now
    return data


def _extract_roles(claims: dict[str, Any]) -> list[str]:
    """Read roles from Zitadel claims (project roles and org roles shapes)."""
    roles: set[str] = set()

    project_roles = claims.get("urn:zitadel:iam:org:project:roles") or {}
    for role, mapping in project_roles.items():
        if isinstance(mapping, dict) and mapping:
            roles.add(role)

    org_roles = claims.get("urn:zitadel:iam:org:roles") or {}
    for role, mapping in org_roles.items():
        if isinstance(mapping, dict) and mapping:
            roles.add(role)

    groups = claims.get("groups")
    if isinstance(groups, list):
        roles.update(str(g) for g in groups)

    return sorted(roles)


def _resolve_signing_key(jwks: PyJWKSet, token: str) -> PyJWK:
    header = get_unverified_header(token)
    kid = header.get("kid")
    if kid:
        for key in jwks:
            if key.key_id == kid:
                return key
        raise jwt.InvalidTokenError(f"No key in JWKS matches kid {kid!r}")
    return next(iter(jwks))


def _resolve_display_name(access_token: str, sub: str, claims: dict[str, Any]) -> str:
    """Best-effort display name from claims, then Zitadel userinfo (cached by sub)."""
    name = claims.get("name") or claims.get("preferred_username") or ""
    if name:
        return name

    settings = get_settings()
    now = time.time()
    cached = USERINFO_CACHE.get(sub)
    if cached and now - cached[0] < USERINFO_TTL:
        return cached[1]

    resolved = ""
    try:
        resp = httpx.get(
            f"{settings.issuer}/oidc/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        resolved = data.get("name") or data.get("preferred_username") or ""
    except Exception:
        resolved = ""

    USERINFO_CACHE[sub] = (now, resolved)
    return resolved


def _backfill_name(sub: str, name: str) -> None:
    """Fill in empty seller/organizer names recorded before userinfo resolution existed."""
    from sqlalchemy import text

    from app.database import SessionLocal

    try:
        with SessionLocal() as db:
            db.execute(
                text(
                    "UPDATE transactions SET seller_name = :name "
                    "WHERE seller_sub = :sub AND seller_name = ''"
                ),
                {"name": name, "sub": sub},
            )
            db.execute(
                text(
                    "UPDATE events SET created_by_name = :name "
                    "WHERE created_by_sub = :sub AND created_by_name = ''"
                ),
                {"name": name, "sub": sub},
            )
            db.commit()
    except Exception:
        pass  # backfill is best-effort and must never break requests


def verify_token(token: str) -> UserPrincipal:
    settings = get_settings()
    try:
        jwks = PyJWKSet.from_dict(_fetch_jwks())
        payload = jwt.decode(
            token,
            _resolve_signing_key(jwks, token),
            algorithms=["RS256", "RS384", "RS512", "ES256", "ES384", "ES512", "EdDSA"],
            issuer=settings.issuer,
            audience=settings.zitadel_audience,
            options={"verify_exp": True},
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        ) from exc

    roles = _extract_roles(payload)
    if not (set(roles) & set(settings.zitadel_required_role)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not have a required role",
        )

    sub = payload.get("sub", "")
    name = _resolve_display_name(token, sub, payload)
    if name and sub and sub not in BACKFILLED_SUBS:
        _backfill_name(sub, name)
        BACKFILLED_SUBS.add(sub)

    return UserPrincipal(
        sub=sub,
        name=name,
        email=payload.get("email", ""),
        roles=roles,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> UserPrincipal:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )
    return verify_token(credentials.credentials)


def require_admin(user: UserPrincipal = Depends(get_current_user)) -> UserPrincipal:
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return user
