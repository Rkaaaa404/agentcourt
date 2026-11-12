"""Action Planner: translates an ArbiterVerdict into an explicit, transparent PlannedPayPalAction."""

from decimal import Decimal
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

from veripact.arbiter.models import ArbiterVerdict, VerdictType
from veripact.payments.models import AcceptClaimType


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
            "note": f"Veripact Auto-Resolution: Merchant accepting buyer claim. Reason: {verdict.summary}",
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
            f"Veripact Mandate Defense: Merchant delivered faithfully to the signed cart. "
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
        goodwill_offer = (amt * Decimal("0.15")).quantize(Decimal("0.01"))
        if amt > Decimal("0.00") and goodwill_offer < Decimal("5.00"):
            goodwill_offer = min(amt, Decimal("5.00"))
        note = (
            f"Veripact Goodwill Remedy: Transaction complied with authorized mandate, "
            f"but agent regret index reached {verdict.regret_score:.1%}. "
            f"Offering proportional goodwill refund of ${goodwill_offer:.2f} USD."
        )
        payload = {
            "offer_amount": {
                "currency_code": "USD",
                "value": f"{goodwill_offer:.2f}",
            },
            "offer_type": "REFUND",
            "note": note,
        }
        return PlannedPayPalAction(
            case_id=verdict.case_id,
            dispute_id=dispute_id,
            action_type=PlannedActionType.MAKE_OFFER,
            http_method="POST",
            api_path=f"/v1/customer/disputes/{dispute_id}/make-offer",
            request_payload=payload,
            rationale=(
                "Mandate was respected, but agent selected a suboptimal offer. "
                "Propose proportional goodwill partial refund via make-offer without penalizing merchant."
            ),
            off_paypal_ledger_entry={
                "event": "AGENT_REGRET_RECORDED",
                "regret_score": verdict.regret_score,
                "goodwill_offer_amount": f"{goodwill_offer:.2f}",
            },
        )

    elif verdict.verdict == VerdictType.NO_FAULT:
        notes = (
            "Veripact Defense: Mandate fully complied with and delivery inspection verified against listing. "
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


def is_action_permitted(
    action_type: PlannedActionType,
    allowed_links: list[str] | None = None,
    allowed_response_options: list[str] | None = None,
) -> tuple[bool, str | None]:
    """Check whether a planned PayPal Disputes action is permitted by HATEOAS links/options.

    When PayPal has not supplied links/options (e.g. local simulated fixture), returns (True, None).
    """
    if action_type == PlannedActionType.NONE:
        return False, "Action type NONE requires manual human review."

    links = {link.lower() for link in (allowed_links or [])}
    options = {opt.upper() for opt in (allowed_response_options or [])}

    if not links and not options:
        return True, None

    rel_map = {
        PlannedActionType.ACCEPT_CLAIM: ("accept_claim", "accept-claim", "ACCEPT_CLAIM"),
        PlannedActionType.PROVIDE_EVIDENCE: ("provide_evidence", "provide-evidence", "PROVIDE_EVIDENCE"),
        PlannedActionType.MAKE_OFFER: ("make_offer", "make-offer", "MAKE_OFFER"),
    }
    expected = rel_map.get(action_type, ())
    if any(r in links for r in expected[:2]) or any(o in options for o in expected[2:]):
        return True, None

    return (
        False,
        f"PayPal dispute stage does not permit '{action_type.value}' (links={sorted(links)}, options={sorted(options)}).",
    )
