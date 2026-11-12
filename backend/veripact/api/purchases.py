"""API routes for autonomous shopping agent execution, PayPal order capture, and evaluation results."""

import json
import logging
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from veripact.agent import SelectionPolicy, ShoppingAgent
from veripact.api.store import default_store
from veripact.ledger import LedgerEventType, default_ledger
from veripact.payments import PayPalAPIError, PayPalClient
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

logger = logging.getLogger("veripact.api.purchases")
router = APIRouter(prefix="/api", tags=["agent"])

EVAL_RESULTS_FILE = Path(__file__).resolve().parent.parent.parent.parent / "eval" / "results.json"


class PurchaseRequest(BaseModel):
    user_request: str = Field(
        default="USB-C docking station, at least 8 ports, HDMI 4K output, max total USD 120, from a listed merchant."
    )
    policy: SelectionPolicy = SelectionPolicy.OPTIMAL


@router.post("/purchase")
async def trigger_purchase(req: PurchaseRequest) -> dict[str, Any]:
    """Execute autonomous agent shopping flow and return purchase plan with PayPal approval link."""
    client = PayPalClient()
    agent = ShoppingAgent(payments=client, default_policy=req.policy)

    try:
        res = await agent.execute_purchase(user_request=req.user_request, policy=req.policy)
        payload = {
            "order_id": res.order.id,
            "status": res.order.status,
            "approval_url": res.order.approval_url,
            "order_binding": res.order_binding,
            "custom_id": res.order.custom_id,
            "chosen_item": {
                "title": res.cart.items[0].title if res.cart.items else "",
                "price": f"{res.cart.total_amount:.2f}",
                "merchant_id": res.cart.merchant_id,
                "attributes": res.cart.items[0].attributes if res.cart.items else {},
            },
            "intent": res.intent.model_dump(mode="json"),
            "cart": res.cart.model_dump(mode="json"),
            "mandate_pack": res.mandate_pack.model_dump(mode="json"),
            "candidate_trace": res.candidate_trace.model_dump(mode="json"),
            "llm_used": res.llm_used,
            "capture_id": None,
            "binding_verified": False,
        }
        default_store.save_purchase(
            order_id=res.order.id,
            purchase_dict=payload,
            custom_id=res.order.custom_id,
            status=res.order.status,
        )
        return payload
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Purchase flow failed: {exc}")
    finally:
        await client.close()


async def _capture_and_record(order_id: str) -> dict[str, Any]:
    """Capture an approved PayPal Sandbox order, verify custom_id binding, and record to ledger."""
    saved = default_store.get_purchase(order_id) or {}
    expected_binding = saved.get("order_binding") or saved.get("custom_id")

    client = PayPalClient()
    try:
        capture = await client.capture_order(order_id)
        captured_custom_id = capture.custom_id
        # Fallback: inspect order details if capture payload omitted custom_id
        if not captured_custom_id:
            try:
                order_info = await client.get_order(order_id)
                captured_custom_id = order_info.custom_id
            except PayPalAPIError:
                pass

        binding_verified = bool(expected_binding and captured_custom_id == expected_binding)
        amt_str = capture.amount.value if capture.amount else saved.get("chosen_item", {}).get("price", "0.00")
        curr_str = capture.amount.currency_code if capture.amount else "USD"

        default_ledger.append(
            event_type=LedgerEventType.ORDER_CAPTURED,
            payload={
                "order_id": order_id,
                "capture_id": capture.id,
                "status": capture.status,
                "captured_custom_id": captured_custom_id,
                "expected_binding": expected_binding,
                "binding_verified": binding_verified,
                "amount": amt_str,
                "currency": curr_str,
            },
        )

        updated = {
            **saved,
            "order_id": order_id,
            "capture_id": capture.id,
            "status": capture.status,
            "captured_custom_id": captured_custom_id,
            "binding_verified": binding_verified,
            "captured_amount": amt_str,
            "currency": curr_str,
        }
        default_store.save_purchase(
            order_id=order_id,
            purchase_dict=updated,
            custom_id=captured_custom_id or expected_binding,
            capture_id=capture.id,
            status=capture.status,
        )
        return updated
    finally:
        await client.close()


@router.post("/orders/{order_id}/capture")
async def capture_paypal_order(order_id: str) -> dict[str, Any]:
    """Capture an approved PayPal Sandbox order and verify custom_id mandate binding."""
    try:
        return await _capture_and_record(order_id)
    except PayPalAPIError as exc:
        raise HTTPException(
            status_code=exc.status_code if 400 <= exc.status_code < 500 else 502,
            detail=f"PayPal order capture failed: {exc}",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Capture error: {exc}")


@router.get("/orders/{order_id}")
async def get_order_status(order_id: str) -> dict[str, Any]:
    """Retrieve stored purchase/mandate/capture state for an order."""
    saved = default_store.get_purchase(order_id)
    if saved:
        return saved

    client = PayPalClient()
    try:
        order = await client.get_order(order_id)
        return {
            "order_id": order.id,
            "status": order.status,
            "custom_id": order.custom_id,
            "approval_url": order.approval_url,
        }
    except PayPalAPIError as exc:
        raise HTTPException(status_code=404, detail=f"Order '{order_id}' not found: {exc}")
    finally:
        await client.close()


@router.get("/checkout/success")
async def checkout_success_callback(
    token: str = Query(..., description="PayPal order ID returned after buyer approval"),
    payer_id: str | None = Query(None, alias="PayerID"),
    response_format: str | None = Query(None, alias="format"),
) -> Any:
    """Handle PayPal buyer approval redirect: capture order and return to UI."""
    try:
        result = await _capture_and_record(token)
        if response_format == "json":
            return {"checkout": "success", "payer_id": payer_id, **result}
        qs = urlencode({"tab": "purchase", "order_id": token, "checkout": "success"})
        return RedirectResponse(url=f"/?{qs}", status_code=302)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Checkout return capture error for %s: %s", token, exc)
        if response_format == "json":
            raise HTTPException(status_code=400, detail=f"Capture after approval failed: {exc}")
        qs = urlencode({"tab": "purchase", "order_id": token, "checkout": "capture_error", "msg": str(exc)[:180]})
        return RedirectResponse(url=f"/?{qs}", status_code=302)


@router.get("/checkout/cancel")
async def checkout_cancel_callback(
    token: str | None = Query(None, description="Cancelled PayPal order ID"),
    response_format: str | None = Query(None, alias="format"),
) -> Any:
    """Handle PayPal buyer cancellation redirect and record cancelled status."""
    if token:
        saved = default_store.get_purchase(token) or {"order_id": token}
        saved["status"] = "CANCELLED_BY_BUYER"
        default_store.save_purchase(
            order_id=token,
            purchase_dict=saved,
            custom_id=saved.get("custom_id"),
            status="CANCELLED_BY_BUYER",
        )
    if response_format == "json":
        return {"checkout": "cancelled", "order_id": token, "status": "CANCELLED_BY_BUYER"}
    qs = urlencode({"tab": "purchase", "order_id": token or "", "checkout": "cancelled"})
    return RedirectResponse(url=f"/?{qs}", status_code=302)


@router.get("/eval/results")
async def get_eval_results() -> dict[str, Any]:
    """Fetch latest results from the offline evaluation harness."""
    if not EVAL_RESULTS_FILE.exists():
        return {"status": "pending", "message": "Evaluation harness has not been run yet."}

    with open(EVAL_RESULTS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)
