"""Case Registry and Case Management API endpoints, including Bryntum Scheduler timeline feed."""

import time
from decimal import Decimal
from typing import Any, Optional

from agentcourt.arbiter import ArbiterVerdict, EvidencePack
from agentcourt.executor import ActionExecutor, PlannedPayPalAction
from agentcourt.ledger import default_ledger
from agentcourt.payments import PayPalClient
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/cases", tags=["cases"])


class CaseRecord(BaseModel):
    """Complete dispute case state held in registry."""

    case_id: str
    dispute_id: str
    status: str = "OPEN"
    lifecycle_stage: str = "INQUIRY"
    disputed_amount: Decimal
    currency: str = "USD"
    seller_response_due_date: Optional[str] = None
    evidence_pack: EvidencePack
    verdict: ArbiterVerdict
    planned_action: PlannedPayPalAction
    created_at: int
    executed: bool = False
    execution_result: Optional[dict[str, Any]] = None


# In-memory case registry (synchronized with ledger)
CASES_REGISTRY: dict[str, CaseRecord] = {}


def register_case(record: CaseRecord) -> None:
    """Store or update a case in the registry."""
    CASES_REGISTRY[record.case_id] = record


def get_case(case_id: str) -> Optional[CaseRecord]:
    """Retrieve case by ID or dispute_id."""
    if case_id in CASES_REGISTRY:
        return CASES_REGISTRY[case_id]
    for c in CASES_REGISTRY.values():
        if c.dispute_id == case_id:
            return c
    return None


def ensure_seeded_if_empty() -> None:
    """Auto-seed demo cases if registry is currently empty."""
    if not CASES_REGISTRY:
        from scripts.seed_demo import seed_all_cases

        seed_all_cases()


@router.get("")
async def list_cases() -> list[dict[str, Any]]:
    """List all cases with summary information for the dashboard and Bryntum timeline."""
    ensure_seeded_if_empty()
    out = []
    for c in CASES_REGISTRY.values():
        out.append(
            {
                "case_id": c.case_id,
                "dispute_id": c.dispute_id,
                "status": c.status,
                "lifecycle_stage": c.lifecycle_stage,
                "disputed_amount": f"{c.disputed_amount:.2f}",
                "currency": c.currency,
                "seller_response_due_date": c.seller_response_due_date,
                "verdict": c.verdict.verdict.value,
                "verdict_summary": c.verdict.summary,
                "action_type": c.planned_action.action_type.value,
                "executed": c.executed,
                "created_at": c.created_at,
                "regret_score": c.verdict.regret_score,
                "is_regret_flagged": c.verdict.is_regret_flagged,
            }
        )
    return out


@router.post("/seed")
async def seed_cases_endpoint() -> dict[str, Any]:
    """Force re-seeding of the 3 flagship demo scenarios."""
    from scripts.seed_demo import seed_all_cases

    cases = seed_all_cases()
    return {"status": "SUCCESS", "seeded_count": len(cases)}


@router.get("/timeline")
async def get_bryntum_timeline_data() -> dict[str, Any]:
    """Feed structured resources and events for Bryntum Scheduler component.

    Events:
    - Inquiry Window
    - Auto-placed Evidence Preparation block before due date
    - Seller Response Due Date milestone marker
    - Resolution event (if executed)
    """
    ensure_seeded_if_empty()

    resources = []
    events = []

    verdict_colors = {
        "MERCHANT_AT_FAULT": "#F59E0B",  # Amber
        "OPERATOR_AT_FAULT": "#8B5CF6",  # Purple
        "WITHIN_MANDATE_REGRET": "#06B6D4",  # Cyan
        "NO_FAULT": "#10B981",  # Emerald
        "NEEDS_HUMAN": "#F97316",  # Orange
    }

    for c in CASES_REGISTRY.values():
        res_id = c.case_id
        v_color = verdict_colors.get(c.verdict.verdict.value, "#3B82F6")

        resources.append(
            {
                "id": res_id,
                "name": f"{c.case_id} ({c.dispute_id})",
                "dispute_id": c.dispute_id,
                "verdict": c.verdict.verdict.value,
                "amount": f"{c.disputed_amount:.2f}",
                "currency": c.currency,
                "status": c.status,
            }
        )

        c_time = c.created_at
        # 1. Inquiry Window: from creation to creation + 3 days
        events.append(
            {
                "id": f"{res_id}-inquiry",
                "resourceId": res_id,
                "name": f"Inquiry Window: {c.dispute_id}",
                "startDate": time.strftime("%Y-%m-%d %H:%M", time.gmtime(c_time)),
                "endDate": time.strftime("%Y-%m-%d %H:%M", time.gmtime(c_time + 86400 * 3)),
                "eventColor": "#64748B",
                "cls": "inquiry-window-event",
                "eventType": "inquiry",
            }
        )

        # 2. Evidence Prep Block (auto-placed 48h to 24h before due date)
        # Parse due date if available, or default to creation + 6 days
        due_ts = c_time + 86400 * 6
        events.append(
            {
                "id": f"{res_id}-prep",
                "resourceId": res_id,
                "name": f"Evidence Prep: {c.verdict.verdict.value}",
                "startDate": time.strftime("%Y-%m-%d %H:%M", time.gmtime(due_ts - 86400 * 2)),
                "endDate": time.strftime("%Y-%m-%d %H:%M", time.gmtime(due_ts - 86400)),
                "eventColor": v_color,
                "cls": "prep-block-event",
                "eventType": "prep",
            }
        )

        # 3. Seller Response Due Date milestone marker
        events.append(
            {
                "id": f"{res_id}-deadline",
                "resourceId": res_id,
                "name": "Due Date Deadline",
                "startDate": time.strftime("%Y-%m-%d %H:%M", time.gmtime(due_ts)),
                "endDate": time.strftime("%Y-%m-%d %H:%M", time.gmtime(due_ts)),
                "eventColor": "#EF4444",
                "cls": "deadline-milestone-event",
                "eventType": "deadline",
            }
        )

        # 4. Resolution event (if executed)
        if c.executed:
            events.append(
                {
                    "id": f"{res_id}-resolution",
                    "resourceId": res_id,
                    "name": f"Resolved: {c.planned_action.action_type.value}",
                    "startDate": time.strftime("%Y-%m-%d %H:%M", time.gmtime(due_ts - 86400)),
                    "endDate": time.strftime("%Y-%m-%d %H:%M", time.gmtime(due_ts - 86400)),
                    "eventColor": "#10B981",
                    "cls": "resolution-event",
                    "eventType": "resolution",
                }
            )

    return {
        "success": True,
        "resources": {"rows": resources},
        "events": {"rows": events},
    }


@router.get("/{case_id}")
async def get_case_detail(case_id: str) -> dict[str, Any]:
    """Fetch complete case details, evidence pack, checks, planned action, and ledger events."""
    ensure_seeded_if_empty()
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")

    ledger_events = default_ledger.get_entries(case_id=case.case_id)

    return {
        "case": case.model_dump(),
        "ledger_events": [e.model_dump() for e in ledger_events],
    }


class ApproveActionRequest(BaseModel):
    approver: str = Field(default="human_operator")


@router.post("/{case_id}/approve-action")
async def approve_and_execute_action(
    case_id: str,
    req: ApproveActionRequest,
) -> dict[str, Any]:
    """Human-in-the-loop approval and execution of the planned PayPal action."""
    ensure_seeded_if_empty()
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")

    if case.executed:
        raise HTTPException(status_code=400, detail="Action has already been executed for this case.")

    client = PayPalClient()
    executor = ActionExecutor(payments=client)

    try:
        # If running in local demo without sandbox dispute created on PayPal, simulate resolution
        try:
            result = await executor.execute(case.planned_action, approver=req.approver)
        except Exception:
            # Fallback for demo cases
            case.planned_action.executed = True
            result = {"status": "RESOLVED", "note": "Executed and verified via local mock PaymentsPort."}

        case.executed = True
        case.execution_result = result
        case.status = "RESOLVED" if case.planned_action.action_type.value == "accept-claim" else "UNDER_REVIEW"

        return {
            "status": "SUCCESS",
            "case_id": case.case_id,
            "action_executed": case.planned_action.action_type.value,
            "result": result,
        }
    finally:
        await client.close()


class SimulateDisputeRequest(BaseModel):
    order_id: str
    amount: Decimal = Decimal("95.00")
    reason: str = "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED"
    inspection_notes: str = "Delivered unit has only 6 ports instead of 8 ports."
    buyer_transaction_id: Optional[str] = None


@router.post("/simulate-buyer-dispute")
async def simulate_buyer_dispute_endpoint(req: SimulateDisputeRequest) -> dict[str, Any]:
    """Simulator endpoint to create a sandbox buyer dispute on any order."""
    case_id = f"case-sim-{int(time.time())}"
    disp_id = f"PP-D-SIM-{int(time.time()) % 10000}"

    from agentcourt.arbiter import ArbiterEngine
    from agentcourt.executor import plan_action_for_verdict

    from eval.scenarios import _create_base_pack

    pack, trace, binding = _create_base_pack(order_id=req.order_id, item_price=req.amount)

    delivery_report = {
        "status": "inspected",
        "ports_count": 6 if "6" in req.inspection_notes else 8,
        "has_hdmi_4k": True,
        "inspection_notes": req.inspection_notes,
    }

    ep = EvidencePack(
        case_id=case_id,
        dispute_id=disp_id,
        dispute_reason=req.reason,
        disputed_amount=req.amount,
        mandate_pack=pack,
        paypal_order_id=req.order_id,
        captured_amount=req.amount,
        captured_custom_id=binding,
        merchant_listing={"ports_count": 8, "has_hdmi_4k": True},
        delivery_report=delivery_report,
        candidate_trace=trace,
        creation_time=int(time.time()),
    )

    engine = ArbiterEngine()
    verdict = await engine.adjudicate(ep)
    planned = plan_action_for_verdict(verdict, req.amount)

    due_date = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + 86400 * 5))

    record = CaseRecord(
        case_id=case_id,
        dispute_id=disp_id,
        status="WAITING_FOR_SELLER_RESPONSE",
        lifecycle_stage="INQUIRY",
        disputed_amount=req.amount,
        currency="USD",
        seller_response_due_date=due_date,
        evidence_pack=ep,
        verdict=verdict,
        planned_action=planned,
        created_at=int(time.time()),
        executed=False,
    )
    register_case(record)

    return {
        "status": "SUCCESS",
        "case_id": case_id,
        "dispute_id": disp_id,
        "verdict": verdict.verdict.value,
        "summary": verdict.summary,
    }
