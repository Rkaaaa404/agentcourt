"""Case Registry and Case Management API endpoints."""

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


@router.get("")
async def list_cases() -> list[dict[str, Any]]:
    """List all cases with summary information for the dashboard and Bryntum timeline."""
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


@router.get("/{case_id}")
async def get_case_detail(case_id: str) -> dict[str, Any]:
    """Fetch complete case details, evidence pack, checks, planned action, and ledger events."""
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
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")

    if case.executed:
        raise HTTPException(status_code=400, detail="Action has already been executed for this case.")

    client = PayPalClient()
    executor = ActionExecutor(payments=client)

    try:
        result = await executor.execute(case.planned_action, approver=req.approver)
        case.executed = True
        case.execution_result = result
        case.status = "RESOLVED" if case.planned_action.action_type.value == "accept-claim" else "UNDER_REVIEW"
        return {
            "status": "SUCCESS",
            "case_id": case.case_id,
            "action_executed": case.planned_action.action_type.value,
            "result": result,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Execution error: {exc}")
    finally:
        await client.close()
