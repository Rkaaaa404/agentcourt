"""Tests for the ShoppingAgent orchestration and PayPal order integration."""

from decimal import Decimal

import pytest
from agentcourt.agent import SelectionPolicy, ShoppingAgent
from agentcourt.ledger import default_ledger
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


class MockPayments(PaymentsPort):
    def __init__(self):
        self.created_orders = []
        self.patched_custom_ids = {}

    async def create_order(self, request: OrderCreateRequest) -> OrderResponse:
        order_id = f"ORDER-{len(self.created_orders) + 1}"
        self.created_orders.append((order_id, request))
        return OrderResponse(
            id=order_id,
            status="CREATED",
            custom_id=request.custom_id,
            approval_url=f"https://sandbox.paypal.com/checkoutnow?token={order_id}",
        )

    async def patch_order_custom_id(self, order_id: str, custom_id: str) -> bool:
        self.patched_custom_ids[order_id] = custom_id
        return True

    async def capture_order(self, order_id: str) -> CaptureResponse:
        return CaptureResponse(id="CAPTURE-999", status="COMPLETED")

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

    async def make_dispute_offer(self, dispute_id: str, amount: Decimal, offer_type: OfferType, note: str):
        return {"status": "SUCCESS"}

    async def accept_dispute_claim(self, dispute_id: str, claim_type: AcceptClaimType, amount=None, note=None):
        return {"status": "SUCCESS"}

    async def escalate_dispute(self, dispute_id: str, note: str):
        return {"status": "SUCCESS"}

    async def provide_dispute_evidence(self, dispute_id: str, evidence_type: str, notes: str):
        return {"status": "SUCCESS"}

    async def simulate_require_evidence(self, dispute_id: str, action: RequireEvidenceAction):
        return {"status": "SUCCESS"}

    async def simulate_adjudicate(self, dispute_id: str, outcome: AdjudicationOutcome):
        return {"status": "SUCCESS"}

    async def verify_webhook_signature(self, headers, body):
        return True


@pytest.mark.asyncio
async def test_shopping_agent_purchase_flow():
    mock_payments = MockPayments()
    agent = ShoppingAgent(payments=mock_payments)

    prompt = "USB-C docking station, at least 8 ports, HDMI 4K output, max total USD 120"
    res = await agent.execute_purchase(user_request=prompt, policy=SelectionPolicy.OPTIMAL)

    # 1. Check Intent Mandate
    assert res.intent.is_valid_signature() is True
    assert res.intent.constraints.min_ports == 8
    assert res.intent.spend_cap == Decimal("120.00")

    # 2. Check Cart Mandate
    assert res.cart.is_valid_signature() is True
    assert res.cart.intent_hash == res.intent.hash()
    assert res.cart.total_amount <= Decimal("120.00")

    # 3. Check PayPal Order & Custom ID Binding
    assert res.order.id.startswith("ORDER-")
    assert res.order.approval_url is not None
    assert len(res.order_binding) == 64
    assert mock_payments.patched_custom_ids[res.order.id] == res.order_binding

    # 4. Check Candidate Trace
    assert len(res.candidate_trace.evaluated_candidates) >= 4
    assert res.candidate_trace.chosen_candidate is not None
    assert res.candidate_trace.chosen_candidate.item_id == "item-dc-101"

    # 5. Check Ledger Integrity
    is_ledger_intact, err = default_ledger.verify_integrity()
    assert is_ledger_intact is True
    assert err is None
