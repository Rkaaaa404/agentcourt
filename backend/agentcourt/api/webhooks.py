"""PayPal Webhook receiver with cryptographic verification, deduplication, and dispute reconciliation."""

import json
import logging
from decimal import Decimal
from typing import Any

from agentcourt.api.cases import ingest_paypal_dispute
from agentcourt.api.store import default_store
from agentcourt.config import settings
from agentcourt.payments import PayPalAPIError, PayPalClient
from fastapi import APIRouter, Header, HTTPException, Request, Response

logger = logging.getLogger("agentcourt.api.webhooks")
router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.get("/events")
async def list_webhook_events(limit: int = 20) -> dict[str, Any]:
    """List recently received PayPal webhook events for operational visibility."""
    return {"events": default_store.list_webhook_events(limit=limit)}


@router.post("/paypal")
async def handle_paypal_webhook(
    request: Request,
    paypal_transmission_id: str | None = Header(None, alias="paypal-transmission-id"),
    paypal_transmission_sig: str | None = Header(None, alias="paypal-transmission-sig"),
) -> Response:
    """Ingest PayPal webhook events (disputes & captures).

    Verifies signature via PayPal's verify-webhook-signature API, deduplicates by event ID,
    reconciles authoritative dispute details via GET /v1/customer/disputes/{id},
    and updates CaseRegistry + Bryntum timeline state.
    """
    body_bytes = await request.body()
    headers_dict = dict(request.headers)

    try:
        event: dict[str, Any] = json.loads(body_bytes.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON webhook payload: {exc}")

    client = PayPalClient()
    verified = False
    try:
        has_sig_headers = bool(paypal_transmission_id and paypal_transmission_sig)
        if has_sig_headers:
            verified = await client.verify_webhook_signature(headers_dict, body_bytes)
            if not verified:
                logger.warning("PayPal webhook signature verification failed.")
                raise HTTPException(status_code=400, detail="Invalid webhook signature")
        elif settings.PAYPAL_WEBHOOK_ID:
            logger.warning("Rejected unsigned webhook because PAYPAL_WEBHOOK_ID is configured.")
            raise HTTPException(status_code=400, detail="Missing required PayPal webhook transmission headers")
        else:
            logger.info("Received unsigned webhook in local test mode (PAYPAL_WEBHOOK_ID unset).")

        event_id = str(event.get("id") or "")
        event_type = str(event.get("event_type") or "")
        resource = event.get("resource", {}) or {}

        # Deduplicate repeated deliveries (PayPal retries up to 25 times over 3 days)
        if event_id and not default_store.record_webhook_event(event_id, event_type, verified):
            logger.info("Ignoring duplicate PayPal webhook event: %s (%s)", event_id, event_type)
            return Response(status_code=200, content="Webhook duplicate ignored")

        if event_type in (
            "CUSTOMER.DISPUTE.CREATED",
            "CUSTOMER.DISPUTE.UPDATED",
            "CUSTOMER.DISPUTE.RESOLVED",
        ):
            dispute_id = str(resource.get("dispute_id") or resource.get("id") or "")
            if dispute_id:
                # Reconcile authoritative state from PayPal when available
                due_date = resource.get("seller_response_due_date")
                status = str(resource.get("status") or "OPEN")
                stage = resource.get("dispute_life_cycle_stage")
                reason = str(resource.get("reason") or "OTHER")
                amt_obj = resource.get("dispute_amount") or {}
                amt_val = Decimal(str(amt_obj.get("value", "95.00")))
                curr = str(amt_obj.get("currency_code", "USD"))
                links = [lnk.get("rel", "") for lnk in resource.get("links", []) if lnk.get("rel")]
                options = resource.get("allowed_response_options") or []
                tx_list = resource.get("disputed_transactions") or []
                custom_id = tx_list[0].get("custom") if tx_list else None
                capture_id = tx_list[0].get("seller_transaction_id") if tx_list else None

                if verified:
                    try:
                        detail = await client.get_dispute(dispute_id)
                        status = detail.status
                        stage = detail.dispute_life_cycle_stage
                        reason = detail.reason or reason
                        due_date = detail.seller_response_due_date or due_date
                        if detail.dispute_amount:
                            amt_val = detail.dispute_amount.to_decimal()
                            curr = detail.dispute_amount.currency_code
                        links = [lnk.rel for lnk in detail.links]
                        options = detail.allowed_response_options or options
                    except PayPalAPIError as exc:
                        logger.info("Using webhook resource payload for %s (get_dispute skipped: %s)", dispute_id, exc)

                await ingest_paypal_dispute(
                    dispute_id,
                    status=status,
                    lifecycle_stage=stage,
                    reason=reason,
                    amount=amt_val,
                    currency=curr,
                    seller_response_due_date=due_date,
                    allowed_links=links,
                    allowed_response_options=options,
                    capture_id=capture_id,
                    custom_id=custom_id,
                    source_mode="PAYPAL_SANDBOX" if verified else "SIMULATED_FIXTURE",
                )
                logger.info("Reconciled dispute %s from webhook %s", dispute_id, event_type)

        elif event_type in ("PAYMENT.CAPTURE.COMPLETED", "PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED"):
            capture_id = resource.get("id")
            logger.info("Received payment capture lifecycle webhook %s for capture %s", event_type, capture_id)

        return Response(status_code=200, content="Webhook processed successfully")
    finally:
        await client.close()
