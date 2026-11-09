"""Unit tests for PayPalClient with mocked HTTP endpoints via respx."""

from decimal import Decimal

import pytest
import respx
from agentcourt.config import Settings
from agentcourt.payments import (
    AcceptClaimType,
    AdjudicationOutcome,
    DisputeCreateRequest,
    DisputeReason,
    OfferType,
    OrderCreateRequest,
    PayPalAPIError,
    PayPalClient,
    RequireEvidenceAction,
)

BASE = "https://api-m.sandbox.paypal.com"


@pytest.fixture
def mock_settings():
    return Settings(
        PAYPAL_ENV="sandbox",
        PAYPAL_BASE_URL=BASE,
        PAYPAL_CLIENT_ID="mock_cid",
        PAYPAL_CLIENT_SECRET="mock_secret",
        PAYPAL_MERCHANT_EMAIL="merchant@sandbox.paypal.com",
        PAYPAL_BUYER_EMAIL="buyer@sandbox.paypal.com",
        PAYPAL_WEBHOOK_ID="WH-12345",
    )


@pytest.fixture
def paypal_client(mock_settings):
    return PayPalClient(config=mock_settings)


@pytest.mark.asyncio
async def test_oauth_caching(paypal_client):
    with respx.mock(base_url=BASE, assert_all_called=False) as respx_mock:
        token_route = respx_mock.post("/v1/oauth2/token").respond(
            200,
            json={"access_token": "ACCESS_TOKEN_1", "expires_in": 3600},
            headers={"PayPal-Debug-Id": "dbg_token_123"},
        )

        token1 = await paypal_client.get_access_token()
        assert token1 == "ACCESS_TOKEN_1"
        assert token_route.call_count == 1

        # Second call should use cache
        token2 = await paypal_client.get_access_token()
        assert token2 == "ACCESS_TOKEN_1"
        assert token_route.call_count == 1

        # Force refresh should make another network call
        respx_mock.post("/v1/oauth2/token").respond(
            200,
            json={"access_token": "ACCESS_TOKEN_2", "expires_in": 3600},
        )
        token3 = await paypal_client.get_access_token(force_refresh=True)
        assert token3 == "ACCESS_TOKEN_2"


@pytest.mark.asyncio
async def test_create_order(paypal_client):
    with respx.mock(base_url=BASE, assert_all_called=False) as respx_mock:
        respx_mock.post("/v1/oauth2/token").respond(
            200, json={"access_token": "ACCESS_TOKEN", "expires_in": 3600}
        )
        respx_mock.post("/v2/checkout/orders").respond(
            201,
            json={
                "id": "ORDER-999",
                "status": "CREATED",
                "links": [
                    {
                        "href": "https://sandbox.paypal.com/checkoutnow?token=ORDER-999",
                        "rel": "approve",
                        "method": "GET",
                    },
                    {
                        "href": "https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER-999",
                        "rel": "self",
                        "method": "GET",
                    },
                ],
            },
        )

        req = OrderCreateRequest(
            amount=Decimal("110.00"),
            currency="USD",
            item_name="USB-C Docking Station",
            custom_id="test_binding_hash_123",
        )
        order = await paypal_client.create_order(req)
        assert order.id == "ORDER-999"
        assert order.status == "CREATED"
        assert order.custom_id == "test_binding_hash_123"
        assert (
            order.approval_url
            == "https://sandbox.paypal.com/checkoutnow?token=ORDER-999"
        )


@pytest.mark.asyncio
async def test_capture_order(paypal_client):
    with respx.mock(base_url=BASE, assert_all_called=False) as respx_mock:
        respx_mock.post("/v1/oauth2/token").respond(
            200, json={"access_token": "ACCESS_TOKEN", "expires_in": 3600}
        )
        respx_mock.post("/v2/checkout/orders/ORDER-999/capture").respond(
            201,
            json={
                "id": "ORDER-999",
                "status": "COMPLETED",
                "purchase_units": [
                    {
                        "payments": {
                            "captures": [
                                {
                                    "id": "CAPTURE-111",
                                    "status": "COMPLETED",
                                    "custom_id": "test_binding_hash_123",
                                    "amount": {
                                        "currency_code": "USD",
                                        "value": "110.00",
                                    },
                                }
                            ]
                        }
                    }
                ],
            },
        )

        capture = await paypal_client.capture_order("ORDER-999")
        assert capture.id == "CAPTURE-111"
        assert capture.status == "COMPLETED"
        assert capture.custom_id == "test_binding_hash_123"
        assert capture.amount.value == "110.00"


@pytest.mark.asyncio
async def test_create_and_get_dispute(paypal_client):
    with respx.mock(base_url=BASE, assert_all_called=False) as respx_mock:
        respx_mock.post("/v1/oauth2/token").respond(
            200, json={"access_token": "ACCESS_TOKEN", "expires_in": 3600}
        )
        # Mock dispute creation
        respx_mock.post("/v1/customer/disputes").respond(
            201,
            json={"dispute_id": "DISPUTE-888", "status": "OPEN"},
        )
        # Mock dispute details
        respx_mock.get("/v1/customer/disputes/DISPUTE-888").respond(
            200,
            json={
                "dispute_id": "DISPUTE-888",
                "status": "WAITING_FOR_SELLER_RESPONSE",
                "dispute_life_cycle_stage": "INQUIRY",
                "reason": "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
                "dispute_amount": {"currency_code": "USD", "value": "110.00"},
                "seller_response_due_date": "2026-11-20T12:00:00Z",
                "allowed_response_options": [
                    "ACCEPT_CLAIM",
                    "MAKE_OFFER",
                    "PROVIDE_EVIDENCE",
                ],
                "links": [
                    {
                        "href": f"{BASE}/v1/customer/disputes/DISPUTE-888/accept-claim",
                        "rel": "accept_claim",
                        "method": "POST",
                    },
                    {
                        "href": f"{BASE}/v1/customer/disputes/DISPUTE-888/make-offer",
                        "rel": "make_offer",
                        "method": "POST",
                    },
                    {
                        "href": f"{BASE}/v1/customer/disputes/DISPUTE-888/provide-evidence",
                        "rel": "provide_evidence",
                        "method": "POST",
                    },
                ],
            },
        )

        req = DisputeCreateRequest(
            buyer_transaction_id="CAPTURE-111",
            amount=Decimal("110.00"),
            currency="USD",
            reason=DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED,
        )
        dispute = await paypal_client.create_dispute(req)
        assert dispute.dispute_id == "DISPUTE-888"
        assert dispute.status == "WAITING_FOR_SELLER_RESPONSE"
        assert dispute.dispute_life_cycle_stage == "INQUIRY"
        assert dispute.has_link("accept_claim")
        assert dispute.has_link("provide_evidence")


@pytest.mark.asyncio
async def test_dispute_merchant_actions(paypal_client):
    with respx.mock(base_url=BASE, assert_all_called=False) as respx_mock:
        respx_mock.post("/v1/oauth2/token").respond(
            200, json={"access_token": "ACCESS_TOKEN", "expires_in": 3600}
        )

        # accept-claim
        respx_mock.post("/v1/customer/disputes/DISPUTE-888/accept-claim").respond(
            200, json={"dispute_id": "DISPUTE-888", "status": "RESOLVED"}
        )
        res_accept = await paypal_client.accept_dispute_claim(
            "DISPUTE-888",
            claim_type=AcceptClaimType.REFUND,
            note="Accepting claim per mandate review.",
        )
        assert res_accept.get("status") == "RESOLVED"

        # provide-evidence
        respx_mock.post("/v1/customer/disputes/DISPUTE-888/provide-evidence").respond(
            200, json={"dispute_id": "DISPUTE-888", "status": "UNDER_REVIEW"}
        )
        res_ev = await paypal_client.provide_dispute_evidence(
            "DISPUTE-888",
            evidence_type="OTHER",
            notes="Signed mandate evidence pack attached.",
        )
        assert res_ev.get("status") == "UNDER_REVIEW"

        # make-offer
        respx_mock.post("/v1/customer/disputes/DISPUTE-888/make-offer").respond(
            200,
            json={"dispute_id": "DISPUTE-888", "status": "WAITING_FOR_BUYER_RESPONSE"},
        )
        res_offer = await paypal_client.make_dispute_offer(
            "DISPUTE-888",
            amount=Decimal("20.00"),
            offer_type=OfferType.REFUND,
            note="Goodwill price adjustment offer.",
        )
        assert res_offer.get("status") == "WAITING_FOR_BUYER_RESPONSE"


@pytest.mark.asyncio
async def test_dispute_simulations(paypal_client):
    with respx.mock(base_url=BASE, assert_all_called=False) as respx_mock:
        respx_mock.post("/v1/oauth2/token").respond(
            200, json={"access_token": "ACCESS_TOKEN", "expires_in": 3600}
        )

        # require-evidence
        respx_mock.post("/v1/customer/disputes/DISPUTE-888/require-evidence").respond(
            200,
            json={"dispute_id": "DISPUTE-888", "status": "WAITING_FOR_SELLER_RESPONSE"},
        )
        r1 = await paypal_client.simulate_require_evidence(
            "DISPUTE-888", RequireEvidenceAction.SELLER_EVIDENCE
        )
        assert r1.get("status") == "WAITING_FOR_SELLER_RESPONSE"

        # adjudicate
        respx_mock.post("/v1/customer/disputes/DISPUTE-888/adjudicate").respond(
            200,
            json={"dispute_id": "DISPUTE-888", "adjudication_outcome": "SELLER_FAVOR"},
        )
        r2 = await paypal_client.simulate_adjudicate(
            "DISPUTE-888", AdjudicationOutcome.SELLER_FAVOR
        )
        assert r2.get("adjudication_outcome") == "SELLER_FAVOR"


@pytest.mark.asyncio
async def test_refund_capture_fallback(paypal_client):
    with respx.mock(base_url=BASE, assert_all_called=False) as respx_mock:
        respx_mock.post("/v1/oauth2/token").respond(
            200, json={"access_token": "ACCESS_TOKEN", "expires_in": 3600}
        )
        respx_mock.post("/v2/payments/captures/CAPTURE-111/refund").respond(
            201, json={"id": "REFUND-777", "status": "COMPLETED"}
        )

        res = await paypal_client.refund_capture(
            "CAPTURE-111", amount=Decimal("110.00"), note="Full fallback refund"
        )
        assert res["id"] == "REFUND-777"
        assert res["status"] == "COMPLETED"


@pytest.mark.asyncio
async def test_webhook_verification(paypal_client):
    with respx.mock(base_url=BASE, assert_all_called=False) as respx_mock:
        respx_mock.post("/v1/oauth2/token").respond(
            200, json={"access_token": "ACCESS_TOKEN", "expires_in": 3600}
        )
        respx_mock.post("/v1/notifications/verify-webhook-signature").respond(
            200, json={"verification_status": "SUCCESS"}
        )

        headers = {
            "paypal-auth-algo": "SHA256withRSA",
            "paypal-cert-url": "https://api.sandbox.paypal.com/cert.pem",
            "paypal-transmission-id": "trans-123",
            "paypal-transmission-sig": "sig-abc",
            "paypal-transmission-time": "2026-11-09T12:00:00Z",
        }
        body = b'{"event_type": "CUSTOMER.DISPUTE.CREATED"}'
        verified = await paypal_client.verify_webhook_signature(headers, body)
        assert verified is True


@pytest.mark.asyncio
async def test_paypal_api_error_debug_id(paypal_client):
    with respx.mock(base_url=BASE, assert_all_called=False) as respx_mock:
        respx_mock.post("/v1/oauth2/token").respond(
            200, json={"access_token": "ACCESS_TOKEN", "expires_in": 3600}
        )
        respx_mock.get("/v2/checkout/orders/ORDER-FAIL").respond(
            404,
            json={"name": "RESOURCE_NOT_FOUND", "message": "Order not found"},
            headers={"PayPal-Debug-Id": "dbg_error_xyz_99"},
        )

        with pytest.raises(PayPalAPIError) as exc_info:
            await paypal_client.get_order("ORDER-FAIL")

        err = exc_info.value
        assert err.status_code == 404
        assert err.debug_id == "dbg_error_xyz_99"
        assert "PayPal-Debug-Id: dbg_error_xyz_99" in str(err)
