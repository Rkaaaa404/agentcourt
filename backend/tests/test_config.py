"""Tests for configuration and sandbox-only safety constraints."""

import pytest
from agentcourt.config import SANDBOX_URL, Settings
from pydantic import ValidationError


def test_config_sandbox_default():
    s = Settings(PAYPAL_ENV="sandbox", PAYPAL_BASE_URL=SANDBOX_URL)
    assert s.PAYPAL_ENV == "sandbox"
    assert s.PAYPAL_BASE_URL == SANDBOX_URL


def test_config_rejects_production_env():
    with pytest.raises(ValidationError) as exc:
        Settings(PAYPAL_ENV="production")  # type: ignore
    assert "SAFETY VIOLATION" in str(exc.value) or "Input should be 'sandbox'" in str(exc.value)


def test_config_rejects_live_url():
    with pytest.raises(ValidationError) as exc:
        Settings(PAYPAL_BASE_URL="https://api-m.paypal.com")
    assert "SAFETY VIOLATION" in str(exc.value)
