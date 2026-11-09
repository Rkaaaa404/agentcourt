"""Action Planner: translates an ArbiterVerdict into an explicit, transparent PlannedPayPalAction."""

from decimal import Decimal
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

from agentcourt.arbiter.models import ArbiterVerdict, VerdictType
from agentcourt.payments.models import AcceptClaimType


class PlannedActionType(str, Enum):
    ACCEPT_CLAIM = "accept-claim"
    PROVIDE_EVIDENCE = "provide-evidence"
    MAKE_OFFER = "make-offer"
    NONE = "none"


class PlannedPayPalAction(BaseModel):
    """Explicit preview of the PayPal Disputes API call to be made."""

    case_id: str
    dispute_id: str
    action_type: PlannedActionType
    http_method: str = "POST"
    api_path: str
    request_payload: dict[str, Any] = Field(default_factory=dict)
    rationale: str
    off_paypal_ledger_entry: Optional[dict[str, Any]] = None
    requires_human_approval: bool = True
    executed: bool = False
    execution_result: Optional[dict[str, Any]] = None


def plan_action_for_verdict(
    verdict: ArbiterVerdict,
    dispute_amount: Optional[Decimal] = None,
) -> PlannedPayPalAction:
    """Map liability verdict to a concrete PlannedPayPalAction preview."""
    dispute_id = verdict.dispute_id
    amt = dispute_amount or Decimal("0.00")

    if verdict.verdict == VerdictType.MERCHANT_AT_FAULT:
        payload = {
            "accept_claim_type": AcceptClaimType.REFUND.value,
            "note": f"AgentCourt Auto-Resolution: Merchant accepting buyer claim. Reason: {verdict.summary}",
        }
        return PlannedPayPalAction(
            case_id=verdict.case_id,
            dispute_id=dispute_id,
            action_type=PlannedActionType.ACCEPT_CLAIM,
            http_method="POST",
            api_path=f"/v1/customer/disputes/{dispute_id}/accept-claim",
            request_payload=payload,
            rationale="Delivery report contradicted listing specifications. Full refund recommended for buyer.",
            off_paypal_ledger_entry=None,
        )

    elif verdict.verdict == VerdictType.OPERATOR_AT_FAULT:
        notes = (
            f"AgentCourt Mandate Defense: Merchant delivered faithfully to the signed cart. "
            f"Dispute stems from an Agent Operator mandate violation ({', '.join(verdict.failed_checks)}). "
            f"Cryptographic evidence pack attached."
        )
        payload = {
            "evidences": [
                {
                    "evidence_type": "OTHER",
                    "notes": notes,
                }
            ]
        }
        return PlannedPayPalAction(
            case_id=verdict.case_id,
            dispute_id=dispute_id,
            action_type=PlannedActionType.PROVIDE_EVIDENCE,
            http_method="POST",
            api_path=f"/v1/customer/disputes/{dispute_id}/provide-evidence",
            request_payload=payload,
            rationale="Agent acted outside buyer authorization. Defend merchant and attribute liability to operator.",
            off_paypal_ledger_entry={
                "event": "OPERATOR_LIABILITY_RECORDED",
                "failed_checks": verdict.failed_checks,
                "amount": f"{amt:.2f}",
            },
        )

    elif verdict.verdict == VerdictType.WITHIN_MANDATE_REGRET:
        notes = (
            f"AgentCourt Review: Transaction complied with authorized mandate. "
            f"Buyer regret detected ({verdict.regret_score:.1%} suboptimal index). "
            f"Merchant fulfilled signed agreement."
        )
        payload = {
            "evidences": [
                {
                    "evidence_type": "OTHER",
                    "notes": notes,
                }
            ]
        }
        return PlannedPayPalAction(
            case_id=verdict.case_id,
            dispute_id=dispute_id,
            action_type=PlannedActionType.PROVIDE_EVIDENCE,
            http_method="POST",
            api_path=f"/v1/customer/disputes/{dispute_id}/provide-evidence",
            request_payload=payload,
            rationale="Mandate was respected. Merchant defends dispute with signed mandate and candidate trace.",
            off_paypal_ledger_entry={
                "event": "AGENT_REGRET_RECORDED",
                "regret_score": verdict.regret_score,
            },
        )

    elif verdict.verdict == VerdictType.NO_FAULT:
        notes = (
            "AgentCourt Defense: Mandate fully complied with and delivery inspection verified against listing. "
            "No defect found."
        )
        payload = {
            "evidences": [
                {
                    "evidence_type": "OTHER",
                    "notes": notes,
                }
            ]
        }
        return PlannedPayPalAction(
            case_id=verdict.case_id,
            dispute_id=dispute_id,
            action_type=PlannedActionType.PROVIDE_EVIDENCE,
            http_method="POST",
            api_path=f"/v1/customer/disputes/{dispute_id}/provide-evidence",
            request_payload=payload,
            rationale="No fault detected. Submit complete mandate pack in defense of merchant.",
            off_paypal_ledger_entry=None,
        )

    else:  # NEEDS_HUMAN
        return PlannedPayPalAction(
            case_id=verdict.case_id,
            dispute_id=dispute_id,
            action_type=PlannedActionType.NONE,
            http_method="NONE",
            api_path="NONE",
            request_payload={},
            rationale="Insufficient evidence or ambiguous delivery inspection. Manual human operator review required.",
            off_paypal_ledger_entry=None,
            requires_human_approval=True,
        )
