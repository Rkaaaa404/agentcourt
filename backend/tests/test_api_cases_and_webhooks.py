"""Unit tests for FastAPI endpoints: cases, webhooks, and purchases."""

import time
from decimal import Decimal

import pytest
from veripact.api.cases import CaseRecord, register_case
from veripact.api.main import app
from veripact.arbiter import ArbiterVerdict, EvidencePack, VerdictType
from veripact.executor import plan_action_for_verdict
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

        # 4. Timeline endpoint uses seller_response_due_date
        r_timeline = await ac.get("/api/cases/timeline")
        assert r_timeline.status_code == 200
        tl = r_timeline.json()
        assert tl["success"] is True
        deadline_ev = next(e for e in tl["events"]["rows"] if e["id"] == "case_api_1-deadline")
        assert deadline_ev["startDate"] == "2026-11-20T12:00:00Z"

        # 5. Eval results endpoint
        r_eval = await ac.get("/api/eval/results")
        assert r_eval.status_code == 200
        eval_data = r_eval.json()
        assert eval_data.get("accuracy_pct") == 100.0


@pytest.mark.asyncio
async def test_webhooks_endpoint(monkeypatch):
    from veripact.config import settings

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        event_id = f"WH-EVT-{int(time.time() * 1000)}"
        payload = {
            "id": event_id,
            "event_type": "CUSTOMER.DISPUTE.CREATED",
            "resource": {
                "dispute_id": "DISP-WH-1",
                "status": "OPEN",
                "reason": "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
                "dispute_amount": {"currency_code": "USD", "value": "95.00"},
                "seller_response_due_date": "2026-11-25T10:00:00Z",
            },
        }

        # 1. Unsigned request rejected when PAYPAL_WEBHOOK_ID is configured
        monkeypatch.setattr(settings, "PAYPAL_WEBHOOK_ID", "WH-TEST-CONFIGURED")
        res_unsigned = await ac.post("/api/webhooks/paypal", json=payload)
        assert res_unsigned.status_code == 400

        # 2. Local dev mode (PAYPAL_WEBHOOK_ID unset) processes, deduplicates, and reconciles
        monkeypatch.setattr(settings, "PAYPAL_WEBHOOK_ID", "")
        res = await ac.post("/api/webhooks/paypal", json=payload)
        assert res.status_code == 200
        assert res.text == "Webhook processed successfully"

        # Duplicate event ID should be ignored cleanly
        res_dup = await ac.post("/api/webhooks/paypal", json=payload)
        assert res_dup.status_code == 200
        assert res_dup.text == "Webhook duplicate ignored"

        # Verify dispute was reconciled into Cases Registry
        r_case = await ac.get("/api/cases/DISP-WH-1")
        assert r_case.status_code == 200
        assert r_case.json()["case"]["dispute_id"] == "DISP-WH-1"


@pytest.mark.asyncio
async def test_checkout_cancel_callback():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/checkout/cancel?token=ORDER-CANCEL-TEST&format=json")
        assert res.status_code == 200
        data = res.json()
        assert data["checkout"] == "cancelled"
        assert data["status"] == "CANCELLED_BY_BUYER"


@pytest.mark.asyncio
async def test_seed_and_auto_seed_inside_event_loop(monkeypatch):
    from veripact.api import cases as cases_mod
    from veripact.api.store import default_store

    monkeypatch.setattr(default_store, "load_all_cases", lambda: [])
    cases_mod.CASES_REGISTRY.clear()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r_cases = await ac.get("/api/cases")
        assert r_cases.status_code == 200
        assert len(r_cases.json()) >= 3

        r_tl = await ac.get("/api/cases/timeline")
        assert r_tl.status_code == 200
        assert len(r_tl.json()["resources"]["rows"]) >= 3

        r_ledger = await ac.get("/api/cases/ledger/verify")
        assert r_ledger.status_code == 200
        assert r_ledger.json()["intact"] is True
        assert r_ledger.json()["total_entries"] >= 1

        r_wh = await ac.get("/api/webhooks/events")
        assert r_wh.status_code == 200
        assert "events" in r_wh.json()

        r_shift = await ac.post("/api/cases/case-s1-merchant-breach/simulate-webhook-update")
        assert r_shift.status_code == 200
        assert r_shift.json()["lifecycle_stage"] == "CHARGEBACK"
