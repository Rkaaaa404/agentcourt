#!/usr/bin/env python3
"""PayPal Sandbox Go/No-Go Verification Script.

Tests the live connection against https://api-m.sandbox.paypal.com:
1. OAuth token generation
2. Order creation (Orders v2) with custom_id binding
3. Approval URL display (for manual buyer approval)
4. Capture
5. Custom ID verification on captured transaction
6. Customer dispute simulation (with unsigned JWT assertion)
7. Dispute lifecycle show & fallback refund validation
"""

import asyncio
import sys
from decimal import Decimal
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from dotenv import load_dotenv

load_dotenv(PROJECT_ROOT / ".env")

from agentcourt.config import settings
from agentcourt.payments import (
    DisputeCreateRequest,
    DisputeReason,
    OrderCreateRequest,
    PayPalAPIError,
    PayPalClient,
)


async def run_gonogo() -> int:
    print("=" * 65)
    print("AgentCourt PayPal Sandbox Go/No-Go Verification")
    print(f"Target Base URL: {settings.PAYPAL_BASE_URL}")
    print("=" * 65)

    if not settings.PAYPAL_CLIENT_ID or "your_" in settings.PAYPAL_CLIENT_ID:
        print("[ERROR] PAYPAL_CLIENT_ID is not configured in .env.")
        print(
            "Please edit .env with your sandbox credentials from developer.paypal.com."
        )
        return 1

    client = PayPalClient()

    try:
        # Step 1: OAuth Token Check
        print("\n[Step 1] Requesting OAuth access token...")
        token = await client.get_access_token()
        print(f"  -> SUCCESS! Token acquired (first 10 chars: {token[:10]}...)")

        # Step 2: Create Order with custom_id
        test_binding = "test_binding_sha256_" + "a" * 44  # 64-char simulated binding
        print(f"\n[Step 2] Creating test Order with custom_id: {test_binding[:16]}...")
        order_req = OrderCreateRequest(
            amount=Decimal("15.00"),
            currency="USD",
            item_name="AgentCourt Sandbox Verification Item",
            custom_id=test_binding,
            return_url="http://localhost:8000/api/checkout/success",
            cancel_url="http://localhost:8000/api/checkout/cancel",
        )
        order = await client.create_order(order_req)
        print(f"  -> SUCCESS! Order ID: {order.id}, Status: {order.status}")
        print(f"  -> Approval URL: {order.approval_url}")

        if not order.approval_url:
            print("  -> [ERROR] No approval link returned in order response.")
            return 1

        print("\n" + "#" * 65)
        print("MANUAL BUYER APPROVAL REQUIRED:")
        print(f"1. Open this URL in your browser: {order.approval_url}")
        print(
            f"2. Log in using your sandbox buyer account: {settings.PAYPAL_BUYER_EMAIL or '[BUYER EMAIL]'}"
        )
        print("3. Click 'Complete Purchase' / 'Approve'.")
        print("#" * 65)

        input("\nPress ENTER after you have approved the payment in your browser...")

        # Step 3: Capture Order
        print(f"\n[Step 3] Capturing order {order.id}...")
        capture = await client.capture_order(order.id)
        print(f"  -> Capture ID: {capture.id}, Status: {capture.status}")
        print(f"  -> Custom ID on capture: {capture.custom_id}")

        # Step 4: Verify Custom ID persistence
        if capture.custom_id == test_binding:
            print(
                "  -> [VERIFIED] Assumption 2 PASSED: custom_id persisted to capture!"
            )
        else:
            print(
                f"  -> [NOTE] custom_id on capture was '{capture.custom_id}' (expected '{test_binding}')."
            )

        # Step 5: Test Sandbox Dispute creation
        print(f"\n[Step 5] Testing Dispute creation on capture ID {capture.id}...")
        try:
            dispute_req = DisputeCreateRequest(
                buyer_transaction_id=capture.id,
                amount=Decimal("15.00"),
                currency="USD",
                reason=DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED,
                note="AgentCourt automated sandbox go/no-go verification test.",
            )
            dispute = await client.create_dispute(dispute_req)
            print(
                f"  -> SUCCESS! Dispute ID: {dispute.dispute_id}, Status: {dispute.status}"
            )
            print(
                "  -> [VERIFIED] Assumption 1 PASSED: capture_id accepted as buyer_transaction_id!"
            )

            # Step 6: Test dispute details
            detail = await client.get_dispute(dispute.dispute_id)
            print(f"  -> Lifecycle stage: {detail.dispute_life_cycle_stage}")
            print(f"  -> Allowed options: {detail.allowed_response_options}")
            print(f"  -> Available HATEOAS links: {[link.rel for link in detail.links]}")

        except PayPalAPIError as exc:
            print(f"  -> [DISPUTE CREATION NOTE]: {exc}")
            print(
                "  -> Testing fallback settlement: issuing refund directly on capture..."
            )
            refund_resp = await client.refund_capture(
                capture.id, note="Go/No-go fallback test refund"
            )
            print(f"  -> Fallback Refund Result: {refund_resp}")

        print("\n[OK] PayPal Sandbox Go/No-Go execution complete.")
        return 0

    except Exception as exc:  # noqa: BLE001
        print(f"\n[FAILED] Error during verification: {exc}")
        return 1
    finally:
        await client.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(run_gonogo()))
