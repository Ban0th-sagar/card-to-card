from functools import lru_cache
from decimal import Decimal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str = Field(min_length=32)
    app_env: str = "development"
    frontend_url: str = "http://localhost:5173"
    card_to_card_fee_percent: Decimal = Field(
        default=Decimal("1.25"),
        ge=0,
        le=100,
        max_digits=5,
        decimal_places=2,
        allow_inf_nan=False,
    )
    card_to_card_demo_limit: Decimal = Field(
        default=Decimal("25000"),
        gt=0,
        max_digits=14,
        decimal_places=2,
        allow_inf_nan=False,
    )
    route_quote_expiry_seconds: int = Field(default=300, ge=1, le=86400)
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")


@lru_cache
def settings():
    return Settings()
