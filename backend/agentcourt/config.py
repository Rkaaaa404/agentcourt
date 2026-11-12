"""Configuration module for AgentCourt.

Enforces strictly sandbox-only PayPal execution and immutable safety rules.
"""

import os
from decimal import Decimal
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

SANDBOX_URL = "https://api-m.sandbox.paypal.com"


class Settings(BaseSettings):
    """Application settings with strict validation."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # PayPal Sandbox Configuration
    PAYPAL_ENV: Literal["sandbox"] = Field(
        default="sandbox",
        description="PayPal environment. MUST be 'sandbox'. Refuses to run otherwise.",
    )
    PAYPAL_BASE_URL: str = Field(
        default=SANDBOX_URL,
        description="Base URL for PayPal API. Hard-coded to sandbox endpoint.",
    )
    PAYPAL_CLIENT_ID: str = Field(default="", description="Sandbox OAuth Client ID")
    PAYPAL_CLIENT_SECRET: str = Field(default="", description="Sandbox OAuth Client Secret")
    PAYPAL_MERCHANT_EMAIL: str = Field(default="", description="Sandbox Merchant Business Email")
    PAYPAL_BUYER_EMAIL: str = Field(default="", description="Sandbox Buyer Email")
    PAYPAL_BUYER_PASSWORD: str = Field(default="", description="Sandbox Buyer Password")
    PAYPAL_WEBHOOK_ID: str = Field(default="", description="Sandbox Registered Webhook ID")

    # Service & Database
    PORT: int = Field(default=8000, description="Web server port")
    HOST: str = Field(default="0.0.0.0", description="Web server host")
    APP_URL: str = Field(default="http://localhost:8000", description="Public or local base URL")
    DATABASE_URL: str = Field(default="sqlite:///./agentcourt.db", description="Database connection string")
    LEDGER_DB_PATH: str = Field(
        default="./data/ledger.db",
        description="SQLite file path for the append-only cryptographic ledger",
    )

    # LLM Settings (Pluggable: Anthropic or OpenAI-compatible)
    LLM_PROVIDER: str = Field(default="anthropic", description="LLM provider: anthropic or openai")
    LLM_MODEL: str = Field(default="claude-sonnet-5-5", description="Model identifier")
    LLM_API_KEY: str = Field(default="", description="API key for chosen LLM provider")

    # Decision thresholds
    REGRET_THRESHOLD: Decimal = Field(default=Decimal("0.15"), description="Regret trigger threshold")

    @field_validator("PAYPAL_ENV")
    @classmethod
    def validate_sandbox_env(cls, v: str) -> str:
        if v.lower() != "sandbox":
            raise ValueError(
                f"SAFETY VIOLATION: PAYPAL_ENV is set to '{v}'. "
                f"AgentCourt STRICTLY permits 'sandbox' only. No live payments allowed."
            )
        return "sandbox"

    @field_validator("PAYPAL_BASE_URL")
    @classmethod
    def validate_sandbox_url(cls, v: str) -> str:
        if v.rstrip("/") != SANDBOX_URL:
            raise ValueError(
                f"SAFETY VIOLATION: PAYPAL_BASE_URL is '{v}'. "
                f"AgentCourt is hard-coded to '{SANDBOX_URL}'. "
                f"Refusing to start against any non-sandbox endpoint."
            )
        return SANDBOX_URL

    @model_validator(mode="after")
    def resolve_render_external_url(self) -> "Settings":
        """Auto-use Render's injected RENDER_EXTERNAL_URL when APP_URL is left at localhost default."""
        render_url = os.environ.get("RENDER_EXTERNAL_URL", "").strip().rstrip("/")
        if self.APP_URL == "http://localhost:8000" and render_url:
            self.APP_URL = render_url
        return self


settings = Settings()
