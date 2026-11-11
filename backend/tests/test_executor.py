"""Unit tests for PlannedPayPalAction synthesis and ActionExecutor."""

from decimal import Decimal

import pytest
from agentcourt.arbiter.models import ArbiterVerdict, VerdictType
from agentcourt.executor import (
    ActionExecutor,
    ExecutionError,
    PlannedActionType,
    is_action_permitted,
    plan_action_for_verdict,
)
from agentcourt.payments.models import (
    AcceptClaimType,
    AdjudicationOutcome,
    CaptureResponse,
    DisputeCreateRequest,
    DisputeDetail,
    OfferType,
    OrderCreateRequest,
    OrderResponse,
    RequireEvidenceAction,
)
from agentcourt.payments.port import PaymentsPort


class MockExecutorPayments(PaymentsPort):
    def __init__(self):
        self.accepted_claims = []
        self.provided_evidences = []

    async def accept_dispute_claim(self, dispute_id: str, claim_type=AcceptClaimType.REFUND, amount=None, note=None):
        self.accepted_claims.append((dispute_id, claim_type, note))
        return {"status": "RESOLVED"}

    async def provide_dispute_evidence(self, dispute_id: str, evidence_type="OTHER", notes=""):
        self.provided_evidences.append((dispute_id, evidence_type, notes))
        return {"status": "UNDER_REVIEW"}

    async def make_dispute_offer(self, dispute_id: str, amount: Decimal, offer_type=OfferType.REFUND, note=""):
        return {"status": "SUCCESS"}

    async def create_order(self, request: OrderCreateRequest) -> OrderResponse:
        return OrderResponse(id="O-1", status="CREATED")

    async def patch_order_custom_id(self, order_id: str, custom_id: str) -> bool:
        return True

    async def capture_order(self, order_id: str) -> CaptureResponse:
        return CaptureResponse(id="C-1", status="COMPLETED")

    async def get_order(self, order_id: str) -> OrderResponse:
        return OrderResponse(id=order_id, status="CREATED")

    async def refund_capture(self, capture_id: str, amount=None, note=None):
        return {"status": "COMPLETED"}

    async def create_dispute(self, request: DisputeCreateRequest) -> DisputeDetail:
        return DisputeDetail(dispute_id="D-1", status="OPEN", reason="TEST")

    async def list_disputes(self, page_size: int = 20):
        return []

    async def get_dispute(self, dispute_id: str) -> DisputeDetail:
        return DisputeDetail(dispute_id=dispute_id, status="OPEN", reason="TEST")

    async def change_dispute_reason(self, dispute_id: str, reason: str, note: str):
        return DisputeDetail(dispute_id=dispute_id, status="OPEN", reason=reason)

    async def send_dispute_message(self, dispute_id: str, message: str):
        return {"status": "SUCCESS"}

    async def escalate_dispute(self, dispute_id: str, note: str):
        return {"status": "SUCCESS"}

    async def simulate_require_evidence(self, dispute_id: str, action: RequireEvidenceAction):
        return {"status": "SUCCESS"}

    async def simulate_adjudicate(self, dispute_id: str, outcome: AdjudicationOutcome):
        return {"status": "SUCCESS"}

    async def verify_webhook_signature(self, headers, body):
        return True


def test_plan_action_mapping():
    # 1. MERCHANT_AT_FAULT -> accept-claim
    v_merch = ArbiterVerdict(
        case_id="c_1",
        dispute_id="d_1",
        verdict=VerdictType.MERCHANT_AT_FAULT,
        summary="Spec mismatch",
        deterministic_checks=[],
    )
    p_merch = plan_action_for_verdict(v_merch, Decimal("89.00"))
    assert p_merch.action_type == PlannedActionType.ACCEPT_CLAIM
    assert "/accept-claim" in p_merch.api_path

    # 2. OPERATOR_AT_FAULT -> provide-evidence + operator liability
    v_op = ArbiterVerdict(
        case_id="c_2",
        dispute_id="d_2",
        verdict=VerdictType.OPERATOR_AT_FAULT,
        summary="C5 failed",
        deterministic_checks=[],
        failed_checks=["C5"],
    )
    p_op = plan_action_for_verdict(v_op, Decimal("110.00"))
    assert p_op.action_type == PlannedActionType.PROVIDE_EVIDENCE
    assert p_op.off_paypal_ledger_entry is not None
    assert p_op.off_paypal_ledger_entry["event"] == "OPERATOR_LIABILITY_RECORDED"

    # 3. WITHIN_MANDATE_REGRET -> make-offer goodwill refund
    v_reg = ArbiterVerdict(
        case_id="c_reg",
        dispute_id="d_reg",
        verdict=VerdictType.WITHIN_MANDATE_REGRET,
        summary="Suboptimal offer",
        deterministic_checks=[],
        regret_score=0.28,
        is_regret_flagged=True,
    )
    p_reg = plan_action_for_verdict(v_reg, Decimal("100.00"))
    assert p_reg.action_type == PlannedActionType.MAKE_OFFER
    assert "/make-offer" in p_reg.api_path
    assert p_reg.request_payload["offer_amount"]["value"] == "15.00"
    assert p_reg.off_paypal_ledger_entry["event"] == "AGENT_REGRET_RECORDED"

    # 4. NEEDS_HUMAN -> none
    v_human = ArbiterVerdict(
        case_id="c_3",
        dispute_id="d_3",
        verdict=VerdictType.NEEDS_HUMAN,
        summary="Unclear",
        deterministic_checks=[],
    )
    p_human = plan_action_for_verdict(v_human)
    assert p_human.action_type == PlannedActionType.NONE

    # 5. HATEOAS link & option check
    ok, _ = is_action_permitted(PlannedActionType.ACCEPT_CLAIM, allowed_links=["self", "accept_claim"])
    assert ok is True
    denied, msg = is_action_permitted(PlannedActionType.ACCEPT_CLAIM, allowed_links=["self", "send_message"])
    assert denied is False
    assert msg is not None


@pytest.mark.asyncio
async def test_action_executor_execution():
    mock_payments = MockExecutorPayments()
    executor = ActionExecutor(payments=mock_payments)

    v = ArbiterVerdict(
        case_id="case_exec_1",
        dispute_id="DISP-EXEC-1",
        verdict=VerdictType.MERCHANT_AT_FAULT,
        summary="Refund buyer",
        deterministic_checks=[],
    )
    planned = plan_action_for_verdict(v, Decimal("89.00"))

    # Execute
    res = await executor.execute(planned, approver="alice_merchant")
    assert res.get("status") == "RESOLVED"
    assert planned.executed is True
    assert len(mock_payments.accepted_claims) == 1

    # Disallow re-execution
    with pytest.raises(ExecutionError):
        await executor.execute(planned)

    # Disallow executing action of type NONE
    planned_none = plan_action_for_verdict(
        ArbiterVerdict(
            case_id="case_exec_none",
            dispute_id="D-NONE",
            verdict=VerdictType.NEEDS_HUMAN,
            summary="Unclear",
            deterministic_checks=[],
        )
    )
    with pytest.raises(ExecutionError):
        await executor.execute(planned_none)
