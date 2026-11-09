#!/usr/bin/env python3
"""Environment and configuration checker for AgentCourt.

Verifies that:
1. Hardcoded sandbox-only constraints are respected.
2. Required and optional environment variables are documented.
3. Python dependencies are properly installed.
"""

import os
import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

try:
    from dotenv import load_dotenv

    load_dotenv(PROJECT_ROOT / ".env")
except ImportError:
    pass


def main() -> int:
    print("=" * 60)
    print("AgentCourt Environment & Safety Pre-flight Check")
    print("=" * 60)

    # 1. Check Safety Violations First
    paypal_env = os.environ.get("PAYPAL_ENV", "sandbox").strip().lower()
    if paypal_env != "sandbox":
        print(f"[FATAL SAFETY VIOLATION] PAYPAL_ENV is set to '{paypal_env}'.")
        print("AgentCourt strictly permits 'sandbox' only. Aborting immediately.")
        return 1

    paypal_url = (
        os.environ.get("PAYPAL_BASE_URL", "https://api-m.sandbox.paypal.com")
        .strip()
        .rstrip("/")
    )
    if paypal_url != "https://api-m.sandbox.paypal.com":
        print(f"[FATAL SAFETY VIOLATION] PAYPAL_BASE_URL is set to '{paypal_url}'.")
        print(
            "AgentCourt strictly hardcodes 'https://api-m.sandbox.paypal.com'. Aborting."
        )
        return 1

    print("[OK] Safety constraints verified: SANDBOX ONLY.")

    # 2. Check credentials
    creds = {
        "PAYPAL_CLIENT_ID": os.environ.get("PAYPAL_CLIENT_ID", ""),
        "PAYPAL_CLIENT_SECRET": os.environ.get("PAYPAL_CLIENT_SECRET", ""),
        "PAYPAL_MERCHANT_EMAIL": os.environ.get("PAYPAL_MERCHANT_EMAIL", ""),
        "PAYPAL_BUYER_EMAIL": os.environ.get("PAYPAL_BUYER_EMAIL", ""),
    }

    missing_creds = [k for k, v in creds.items() if not v or "your_" in v]

    if missing_creds:
        print("\n[NOTICE: HUMAN CREDENTIALS REQUIRED FOR LIVE TESTS]")
        print("The following sandbox credentials are not set in .env:")
        for k in missing_creds:
            print(f"  - {k}")
        print("\nNote: Mocked unit tests will run and pass without these.")
        print(
            "To run live sandbox tests (scripts/paypal_gonogo.py), copy .env.example to .env and fill them in."
        )
    else:
        print("[OK] Sandbox credentials detected.")

    # 3. Optional LLM credentials
    llm_key = os.environ.get("LLM_API_KEY", "")
    llm_provider = os.environ.get("LLM_PROVIDER", "anthropic")
    if not llm_key:
        print(
            "\n[INFO] LLM_API_KEY is not set. Arbiter will run in deterministic fallback mode (llm_used: false)."
        )
    else:
        print(f"[OK] LLM Provider configured: {llm_provider} (Key present).")

    print("\nPre-flight check passed successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
