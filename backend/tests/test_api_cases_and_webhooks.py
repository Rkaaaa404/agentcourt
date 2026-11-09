"""Unit tests for FastAPI endpoints: cases, webhooks, and purchases."""

import time
from decimal import Decimal

import pytest
from agentcourt.api.cases import CaseRecord, register_case
from agentcourt.api.main import app
from agentcourt.arbiter import ArbiterVerdict, EvidencePack, VerdictType
from agentcourt.executor import plan_action_for_verdict
from httpx import ASGITransport, AsyncClient

from eval.scenarios import _create_base_pack


@pytest.fixture
def sample_case():
    pack, trace, binding = _create_base_pack()
    ep = EvidencePack(
        case_id="case_api_1",
        dispute_id="DISP-API-1",
        dispute_reason="MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
        disputed_amount=Decimal("89.00"),
        mandate_pack=pack,
        paypal_order_id="ORDER-API-1",
        captured_amount=Decimal("89.00"),
        captured_custom_id=binding,
        merchant_listing={"ports_count": 10},
        delivery_report={"ports_count": 10},
        candidate_trace=trace,
    )
    v = ArbiterVerdict(
        case_id="case_api_1",
        dispute_id="DISP-API-1",
        verdict=VerdictType.NO_FAULT,
        summary="No fault detected",
        deterministic_checks=[],
    )
    planned = plan_action_for_verdict(v, Decimal("89.00"))

    record = CaseRecord(
        case_id="case_api_1",
        dispute_id="DISP-API-1",
        status="OPEN",
        lifecycle_stage="INQUIRY",
        disputed_amount=Decimal("89.00"),
        currency="USD",
        seller_response_due_date="2026-11-20T12:00:00Z",
        evidence_pack=ep,
        verdict=v,
        planned_action=planned,
        created_at=int(time.time()),
    )
    register_case(record)
    return record


@pytest.mark.asyncio
async def test_cases_endpoints(sample_case):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Healthz
        r_health = await ac.get("/healthz")
        assert r_health.status_code == 200
        assert r_health.json()["status"] == "healthy"

        # 2. List cases
        r_list = await ac.get("/api/cases")
        assert r_list.status_code == 200
        cases = r_list.json()
        assert any(c["case_id"] == "case_api_1" for c in cases)

        # 3. Case detail
        r_detail = await ac.get("/api/cases/case_api_1")
        assert r_detail.status_code == 200
        detail = r_detail.json()
        assert detail["case"]["case_id"] == "case_api_1"
        assert "ledger_events" in detail

        # 4. Eval results endpoint
        r_eval = await ac.get("/api/eval/results")
        assert r_eval.status_code == 200
        eval_data = r_eval.json()
        assert eval_data.get("accuracy_pct") == 100.0


@pytest.mark.asyncio
async def test_webhooks_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "event_type": "CUSTOMER.DISPUTE.CREATED",
            "resource": {
                "dispute_id": "DISP-WH-1",
                "status": "OPEN",
            },
        }
        res = await ac.post("/api/webhooks/paypal", json=payload)
        assert res.status_code == 200
        assert res.text == "Webhook processed successfully"
