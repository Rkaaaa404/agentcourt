"""PayPal Sandbox REST API Client implementing PaymentsPort.

Strictly bound to https://api-m.sandbox.paypal.com with OAuth caching,
exponential backoff retries, PayPal-Debug-Id logging, and idempotency keys.
"""

import asyncio
import base64
import json
import logging
import time
import uuid
from decimal import Decimal
from typing import Any

import httpx

from agentcourt.config import SANDBOX_URL, Settings, settings
from agentcourt.payments.models import (
    AcceptClaimType,
    AdjudicationOutcome,
    CaptureResponse,
    DisputeCreateRequest,
    DisputeDetail,
    HATEOASLink,
    Money,
    OfferType,
    OrderCreateRequest,
    OrderResponse,
    RequireEvidenceAction,
)
from agentcourt.payments.port import PaymentsPort

logger = logging.getLogger("agentcourt.payments")


class PayPalAPIError(Exception):
    """Exception raised when PayPal returns an error response."""

    def __init__(
        self,
        message: str,
        status_code: int = 0,
        debug_id: str | None = None,
        details: Any = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.debug_id = debug_id
        self.details = details

    def __str__(self) -> str:
        dbg = f" [PayPal-Debug-Id: {self.debug_id}]" if self.debug_id else ""
        return f"{super().__str__()} (status={self.status_code}){dbg}"


def _base64url_encode(data: bytes) -> str:
    """Encode bytes using base64url encoding without padding."""
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def create_auth_assertion(client_id: str, email: str) -> str:
    """Generate unsigned JWT for PayPal-Auth-Assertion header.

    Format: base64url(header) + "." + base64url(payload) + "." (trailing dot, unsigned).
    """
    header = {"alg": "none", "typ": "JWT"}
    payload = {"iss": client_id, "email": email}

    header_bytes = json.dumps(header, separators=(",", ":")).encode("utf-8")
    payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")

    return f"{_base64url_encode(header_bytes)}.{_base64url_encode(payload_bytes)}."


class PayPalClient(PaymentsPort):
    """Production-grade client for the PayPal Sandbox REST API."""

    def __init__(
        self,
        config: Settings | None = None,
        client: httpx.AsyncClient | None = None,
    ):
        self.config = config or settings

        # Fail-safe sandbox constraint check
        if (
            self.config.PAYPAL_ENV != "sandbox"
            or self.config.PAYPAL_BASE_URL.rstrip("/") != SANDBOX_URL
        ):
            raise RuntimeError(
                f"SAFETY SHUTDOWN: PayPalClient initialized with illegal URL/ENV "
                f"({self.config.PAYPAL_ENV}, {self.config.PAYPAL_BASE_URL}). "
                f"Only '{SANDBOX_URL}' is permitted."
            )

        self.base_url = SANDBOX_URL
        self._client = client
        self._access_token: str | None = None
        self._token_expires_at: float = 0.0
        self._token_lock = asyncio.Lock()

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=httpx.Timeout(20.0, connect=10.0),
            )
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def get_access_token(self, force_refresh: bool = False) -> str:
        """Fetch and cache OAuth access token using client credentials."""
        now = time.time()
        if (
            not force_refresh
            and self._access_token
            and now < (self._token_expires_at - 60)
        ):
            return self._access_token

        async with self._token_lock:
            # Recheck inside lock
            if (
                not force_refresh
                and self._access_token
                and time.time() < (self._token_expires_at - 60)
            ):
                return self._access_token

            client = await self._get_client()
            auth = (self.config.PAYPAL_CLIENT_ID, self.config.PAYPAL_CLIENT_SECRET)
            data = {"grant_type": "client_credentials"}
            headers = {"Accept": "application/json", "Accept-Language": "en_US"}

            logger.info(
                "Requesting new PayPal OAuth token from %s/v1/oauth2/token",
                self.base_url,
            )
            response = await client.post(
                "/v1/oauth2/token",
                data=data,
                auth=auth,
                headers=headers,
            )

            debug_id = response.headers.get("PayPal-Debug-Id")
            if response.status_code != 200:
                logger.error(
                    "OAuth token request failed with status %d, Debug-Id: %s, body: %s",
                    response.status_code,
                    debug_id,
                    response.text,
                )
                raise PayPalAPIError(
                    f"OAuth authentication failed: {response.text}",
                    status_code=response.status_code,
                    debug_id=debug_id,
                )

            res_data = response.json()
            self._access_token = res_data["access_token"]
            expires_in = res_data.get("expires_in", 3600)
            self._token_expires_at = time.time() + float(expires_in)
            logger.info(
                "Acquired PayPal OAuth token, expires in %d seconds", expires_in
            )
            return self._access_token

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json_data: Any = None,
        files: dict[str, Any] | None = None,
        data: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        buyer_assertion_email: str | None = None,
        idempotency_key: str | None = None,
        retries: int = 3,
    ) -> httpx.Response:
        """Execute HTTP request with authentication, retries, and debug logging."""
        token = await self.get_access_token()
        req_headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "PayPal-Request-Id": idempotency_key or str(uuid.uuid4()),
        }

        if buyer_assertion_email:
            req_headers["PayPal-Auth-Assertion"] = create_auth_assertion(
                client_id=self.config.PAYPAL_CLIENT_ID,
                email=buyer_assertion_email,
            )

        if headers:
            req_headers.update(headers)

        client = await self._get_client()

        last_error = None
        for attempt in range(1, retries + 1):
            try:
                response = await client.request(
                    method=method,
                    url=path,
                    json=json_data,
                    files=files,
                    data=data,
                    headers=req_headers,
                )
                debug_id = response.headers.get("PayPal-Debug-Id")

                if response.status_code in (200, 201, 202, 204):
                    return response

                # Token expired retry
                if response.status_code == 401 and attempt < retries:
                    logger.warning(
                        "Received 401 Unauthorized. Refreshing token and retrying..."
                    )
                    token = await self.get_access_token(force_refresh=True)
                    req_headers["Authorization"] = f"Bearer {token}"
                    continue

                # Server error retry with backoff
                if response.status_code in (500, 502, 503, 504) and attempt < retries:
                    wait_time = 0.5 * (2 ** (attempt - 1))
                    logger.warning(
                        "PayPal 5xx error (status %d, Debug-Id: %s). Retrying in %.2fs (attempt %d/%d)...",
                        response.status_code,
                        debug_id,
                        wait_time,
                        attempt,
                        retries,
                    )
                    await asyncio.sleep(wait_time)
                    continue

                # Other HTTP errors
                logger.error(
                    "PayPal API error: %s %s returned %d (Debug-Id: %s): %s",
                    method,
                    path,
                    response.status_code,
                    debug_id,
                    response.text,
                )
                try:
                    error_details = response.json()
                except Exception:  # noqa: BLE001
                    error_details = response.text

                raise PayPalAPIError(
                    f"PayPal API error: {response.status_code} {response.text}",
                    status_code=response.status_code,
                    debug_id=debug_id,
                    details=error_details,
                )

            except (httpx.ConnectError, httpx.TimeoutException) as exc:
                last_error = exc
                if attempt < retries:
                    wait_time = 0.5 * (2 ** (attempt - 1))
                    logger.warning(
                        "Network error: %s. Retrying in %.2fs...", exc, wait_time
                    )
                    await asyncio.sleep(wait_time)
                    continue
                raise PayPalAPIError(f"Network error contacting PayPal: {exc}") from exc

        if last_error:
            raise PayPalAPIError(f"Request failed after retries: {last_error}")

        raise PayPalAPIError("Unexpected end of request loop")

    # -------------------------------------------------------------------------
    # Orders v2
    # -------------------------------------------------------------------------

    async def create_order(self, request: OrderCreateRequest) -> OrderResponse:
        """Create a PayPal order with CAPTURE intent and custom_id binding."""
        payload = {
            "intent": "CAPTURE",
            "purchase_units": [
                {
                    "custom_id": request.custom_id,
                    "description": request.item_name,
                    "amount": {
                        "currency_code": request.currency,
                        "value": f"{request.amount:.2f}",
                    },
                }
            ],
            "application_context": {
                "return_url": request.return_url,
                "cancel_url": request.cancel_url,
                "user_action": "PAY_NOW",
            },
        }

        resp = await self._request("POST", "/v2/checkout/orders", json_data=payload)
        data = resp.json()

        approval_url = None
        for link in data.get("links", []):
            if link.get("rel") == "approve":
                approval_url = link.get("href")
                break

        return OrderResponse(
            id=data["id"],
            status=data.get("status", "CREATED"),
            custom_id=request.custom_id,
            approval_url=approval_url,
            raw_response=data,
        )

    async def capture_order(self, order_id: str) -> CaptureResponse:
        """Capture an approved PayPal order."""
        resp = await self._request("POST", f"/v2/checkout/orders/{order_id}/capture")
        data = resp.json()

        capture_id = ""
        custom_id = None
        amount = None

        purchase_units = data.get("purchase_units", [])
        if purchase_units:
            pu = purchase_units[0]
            payments = pu.get("payments", {})
            captures = payments.get("captures", [])
            if captures:
                c = captures[0]
                capture_id = c.get("id", "")
                custom_id = c.get("custom_id")
                amt_data = c.get("amount", {})
                if amt_data:
                    amount = Money(
                        currency_code=amt_data.get("currency_code", "USD"),
                        value=amt_data.get("value", "0.00"),
                    )

        return CaptureResponse(
            id=capture_id or data.get("id", ""),
            status=data.get("status", "COMPLETED"),
            order_id=order_id,
            custom_id=custom_id,
            amount=amount,
            raw_response=data,
        )

    async def get_order(self, order_id: str) -> OrderResponse:
        """Fetch details of an order."""
        resp = await self._request("GET", f"/v2/checkout/orders/{order_id}")
        data = resp.json()

        approval_url = None
        custom_id = None
        for link in data.get("links", []):
            if link.get("rel") == "approve":
                approval_url = link.get("href")
                break

        purchase_units = data.get("purchase_units", [])
        if purchase_units:
            custom_id = purchase_units[0].get("custom_id")

        return OrderResponse(
            id=data["id"],
            status=data.get("status", "CREATED"),
            custom_id=custom_id,
            approval_url=approval_url,
            raw_response=data,
        )

    async def refund_capture(
        self,
        capture_id: str,
        amount: Decimal | None = None,
        note: str | None = None,
    ) -> dict[str, Any]:
        """Issue a refund against a captured payment."""
        payload: dict[str, Any] = {}
        if amount is not None:
            payload["amount"] = {"value": f"{amount:.2f}", "currency_code": "USD"}
        if note:
            payload["note_to_payer"] = note

        resp = await self._request(
            "POST",
            f"/v2/payments/captures/{capture_id}/refund",
            json_data=payload if payload else None,
        )
        return resp.json() if resp.status_code != 204 else {"status": "COMPLETED"}

    # -------------------------------------------------------------------------
    # Disputes API (Sandbox Customer Disputes)
    # -------------------------------------------------------------------------

    async def create_dispute(self, request: DisputeCreateRequest) -> DisputeDetail:
        """Simulate buyer creating a customer dispute in the sandbox.

        Uses multipart form with 'input' json part and PayPal-Auth-Assertion header.
        """
        buyer_email = self.config.PAYPAL_BUYER_EMAIL
        if not buyer_email:
            raise ValueError(
                "PAYPAL_BUYER_EMAIL is required to simulate buyer dispute creation."
            )

        body = {
            "disputed_transactions": [
                {"buyer_transaction_id": request.buyer_transaction_id}
            ],
            "reason": request.reason.value,
            "dispute_amount": {
                "currency_code": request.currency,
                "value": f"{request.amount:.2f}",
            },
            "extensions": {
                "merchant_contacted": True,
                "merchant_contacted_outcome": "NO_RESPONSE",
                "merchandize_dispute_properties": {"issue_type": "PRODUCT"},
            },
        }

        # Multipart form with one part named 'input' containing application/json
        files = {"input": (None, json.dumps(body), "application/json")}

        resp = await self._request(
            "POST",
            "/v1/customer/disputes",
            files=files,
            buyer_assertion_email=buyer_email,
        )
        data = resp.json()

        # The response gives dispute_id or links
        dispute_id = data.get("dispute_id") or data.get("id") or ""
        return (
            await self.get_dispute(dispute_id)
            if dispute_id
            else DisputeDetail(
                dispute_id="pending",
                status="OPEN",
                reason=request.reason.value,
                raw_response=data,
            )
        )

    async def get_dispute(self, dispute_id: str) -> DisputeDetail:
        """Fetch dispute details, status, lifecycle stage, and HATEOAS links."""
        resp = await self._request("GET", f"/v1/customer/disputes/{dispute_id}")
        data = resp.json()

        amt = None
        if "dispute_amount" in data:
            amt = Money(
                currency_code=data["dispute_amount"].get("currency_code", "USD"),
                value=data["dispute_amount"].get("value", "0.00"),
            )

        links = [
            HATEOASLink(
                href=item["href"],
                rel=item["rel"],
                method=item.get("method", "GET"),
            )
            for item in data.get("links", [])
        ]

        return DisputeDetail(
            dispute_id=data.get("dispute_id", dispute_id),
            status=data.get("status", "OPEN"),
            dispute_life_cycle_stage=data.get("dispute_life_cycle_stage"),
            reason=data.get("reason", ""),
            dispute_amount=amt,
            seller_response_due_date=data.get("seller_response_due_date"),
            allowed_response_options=data.get("allowed_response_options", []),
            evidences=data.get("evidences", []),
            links=links,
            raw_response=data,
        )

    async def change_dispute_reason(
        self,
        dispute_id: str,
        reason: str,
        note: str,
    ) -> DisputeDetail:
        """Change the reason of a dispute (sandbox buyer simulation)."""
        buyer_email = self.config.PAYPAL_BUYER_EMAIL
        body = {
            "reason": reason,
            "note": note,
        }
        files = {"input": (None, json.dumps(body), "application/json")}

        await self._request(
            "POST",
            f"/v1/customer/disputes/{dispute_id}/change-reason",
            files=files,
            buyer_assertion_email=buyer_email,
        )
        return await self.get_dispute(dispute_id)

    async def send_dispute_message(
        self, dispute_id: str, message: str
    ) -> dict[str, Any]:
        """Send a message on the dispute thread."""
        resp = await self._request(
            "POST",
            f"/v1/customer/disputes/{dispute_id}/send-message",
            json_data={"message": message},
        )
        return resp.json() if resp.status_code != 204 else {"status": "SUCCESS"}

    async def make_dispute_offer(
        self,
        dispute_id: str,
        amount: Decimal,
        offer_type: OfferType = OfferType.REFUND,
        note: str = "",
    ) -> dict[str, Any]:
        """Merchant action: make settlement offer."""
        payload = {
            "offer_amount": {
                "currency_code": "USD",
                "value": f"{amount:.2f}",
            },
            "offer_type": offer_type.value,
            "note": note,
        }
        resp = await self._request(
            "POST",
            f"/v1/customer/disputes/{dispute_id}/make-offer",
            json_data=payload,
        )
        return resp.json() if resp.status_code != 204 else {"status": "SUCCESS"}

    async def accept_dispute_claim(
        self,
        dispute_id: str,
        claim_type: AcceptClaimType = AcceptClaimType.REFUND,
        amount: Decimal | None = None,
        note: str | None = None,
    ) -> dict[str, Any]:
        """Merchant action: accept claim and refund."""
        payload: dict[str, Any] = {
            "accept_claim_type": claim_type.value,
        }
        if note:
            payload["note"] = note
        if claim_type == AcceptClaimType.PARTIAL_REFUND and amount is not None:
            payload["refund_amount"] = {
                "currency_code": "USD",
                "value": f"{amount:.2f}",
            }

        resp = await self._request(
            "POST",
            f"/v1/customer/disputes/{dispute_id}/accept-claim",
            json_data=payload,
        )
        return resp.json() if resp.status_code != 204 else {"status": "SUCCESS"}

    async def escalate_dispute(self, dispute_id: str, note: str) -> dict[str, Any]:
        """Merchant or buyer action: escalate to PayPal claim."""
        resp = await self._request(
            "POST",
            f"/v1/customer/disputes/{dispute_id}/escalate",
            json_data={"note": note},
        )
        return resp.json() if resp.status_code != 204 else {"status": "SUCCESS"}

    async def provide_dispute_evidence(
        self,
        dispute_id: str,
        evidence_type: str = "OTHER",
        notes: str = "",
    ) -> dict[str, Any]:
        """Merchant action: submit evidence pack."""
        body = {
            "evidences": [
                {
                    "evidence_type": evidence_type,
                    "notes": notes,
                }
            ]
        }
        files = {"input": (None, json.dumps(body), "application/json")}
        resp = await self._request(
            "POST",
            f"/v1/customer/disputes/{dispute_id}/provide-evidence",
            files=files,
        )
        return resp.json() if resp.status_code != 204 else {"status": "SUCCESS"}

    # -------------------------------------------------------------------------
    # Sandbox-only simulations
    # -------------------------------------------------------------------------

    async def simulate_require_evidence(
        self,
        dispute_id: str,
        action: RequireEvidenceAction = RequireEvidenceAction.SELLER_EVIDENCE,
    ) -> dict[str, Any]:
        """Sandbox simulation: trigger requirement for evidence."""
        resp = await self._request(
            "POST",
            f"/v1/customer/disputes/{dispute_id}/require-evidence",
            json_data={"action": action.value},
        )
        return resp.json() if resp.status_code != 204 else {"status": "SUCCESS"}

    async def simulate_adjudicate(
        self,
        dispute_id: str,
        outcome: AdjudicationOutcome = AdjudicationOutcome.SELLER_FAVOR,
    ) -> dict[str, Any]:
        """Sandbox simulation: resolve dispute in seller or buyer favor."""
        resp = await self._request(
            "POST",
            f"/v1/customer/disputes/{dispute_id}/adjudicate",
            json_data={"adjudication_outcome": outcome.value},
        )
        return resp.json() if resp.status_code != 204 else {"status": "SUCCESS"}

    # -------------------------------------------------------------------------
    # Webhooks
    # -------------------------------------------------------------------------

    async def verify_webhook_signature(
        self,
        headers: dict[str, str],
        body: bytes,
    ) -> bool:
        """Verify webhook signature via PayPal's verify-webhook-signature endpoint."""
        webhook_id = self.config.PAYPAL_WEBHOOK_ID
        if not webhook_id:
            logger.warning(
                "PAYPAL_WEBHOOK_ID is not configured. Webhook signature cannot be verified."
            )
            return False

        # Extract normalized headers (PayPal headers can be lower or title case)
        header_map = {k.lower(): v for k, v in headers.items()}

        auth_algo = header_map.get("paypal-auth-algo")
        cert_url = header_map.get("paypal-cert-url")
        transmission_id = header_map.get("paypal-transmission-id")
        transmission_sig = header_map.get("paypal-transmission-sig")
        transmission_time = header_map.get("paypal-transmission-time")

        if not all(
            [auth_algo, cert_url, transmission_id, transmission_sig, transmission_time]
        ):
            logger.warning(
                "Missing required PayPal webhook headers for signature verification."
            )
            return False

        try:
            event_body = json.loads(body.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            logger.error(
                "Failed to parse webhook JSON body for signature verification: %s", exc
            )
            return False

        payload = {
            "auth_algo": auth_algo,
            "cert_url": cert_url,
            "transmission_id": transmission_id,
            "transmission_sig": transmission_sig,
            "transmission_time": transmission_time,
            "webhook_id": webhook_id,
            "webhook_event": event_body,
        }

        try:
            resp = await self._request(
                "POST",
                "/v1/notifications/verify-webhook-signature",
                json_data=payload,
            )
            data = resp.json()
            return data.get("verification_status") == "SUCCESS"
        except (PayPalAPIError, httpx.HTTPError) as exc:
            logger.error("Webhook verification request failed: %s", exc)
            return False
