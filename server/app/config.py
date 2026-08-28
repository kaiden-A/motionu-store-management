from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode


class Settings(BaseSettings):
    database_url: str
    zitadel_issuer: str
    zitadel_jwks_uri: str
    zitadel_audience: str
    zitadel_required_role: Annotated[list[str], NoDecode] = ["member", "entrep", "mainboards", "super_admin"]
    admin_roles: Annotated[list[str], NoDecode] = ["entrep", "mainboards", "super_admin"]
    cors_origins: Annotated[list[str], NoDecode] = []
    email_api: str = ""
    api_key: str = ""
    email_from: str = "info@motionukict.com"
    form_api_key: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @field_validator("zitadel_required_role", "admin_roles", "cors_origins", mode="before")
    @classmethod
    def parse_role_list(cls, value):
        if isinstance(value, str):
            cleaned = value.strip()
            if cleaned.startswith("[") and cleaned.endswith("]"):
                cleaned = cleaned[1:-1]
            parts = [p.strip().strip('"').strip("'") for p in cleaned.split(",") if p.strip()]
            return parts
        return value

    @property
    def issuer(self) -> str:
        return self.zitadel_issuer.rstrip("/")


@lru_cache
def get_settings() -> Settings:
    return Settings()
