"""API routes for autonomous shopping agent execution and evaluation results."""

import json
from pathlib import Path
from typing import Any

from agentcourt.agent import SelectionPolicy, ShoppingAgent
from agentcourt.payments import PayPalClient
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

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
        return {
            "order_id": res.order.id,
            "status": res.order.status,
            "approval_url": res.order.approval_url,
            "order_binding": res.order_binding,
            "custom_id": res.order.custom_id,
            "chosen_item": {
                "title": res.cart.items[0].title if res.cart.items else "",
                "price": f"{res.cart.total_amount:.2f}",
                "merchant_id": res.cart.merchant_id,
            },
            "intent": res.intent.model_dump(),
            "cart": res.cart.model_dump(),
            "candidate_trace": res.candidate_trace.model_dump(),
            "llm_used": res.llm_used,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Purchase flow failed: {exc}")
    finally:
        await client.close()


@router.get("/eval/results")
async def get_eval_results() -> dict[str, Any]:
    """Fetch latest results from the offline evaluation harness."""
    if not EVAL_RESULTS_FILE.exists():
        return {"status": "pending", "message": "Evaluation harness has not been run yet."}

    with open(EVAL_RESULTS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)
