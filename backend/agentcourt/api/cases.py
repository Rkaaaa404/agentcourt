"""Case Registry and Case Management API endpoints, including Bryntum Scheduler timeline feed."""

import logging
import time
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional

from agentcourt.api.store import default_store
from agentcourt.arbiter import ArbiterEngine, ArbiterVerdict, EvidencePack
from agentcourt.executor import ActionExecutor, PlannedPayPalAction, is_action_permitted, plan_action_for_verdict
from agentcourt.ledger import LedgerEventType, default_ledger
from agentcourt.payments import DisputeCreateRequest, DisputeDetail, DisputeReason, PayPalAPIError, PayPalClient
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger("agentcourt.api.cases")
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
    allowed_links: list[str] = Field(default_factory=list)
    allowed_response_options: list[str] = Field(default_factory=list)
    source_mode: str = "SIMULATED_FIXTURE"
    evidence_pack: EvidencePack
    verdict: ArbiterVerdict
    planned_action: PlannedPayPalAction
    created_at: int
    executed: bool = False
    execution_mode: Optional[str] = None
    execution_result: Optional[dict[str, Any]] = None


# In-memory case registry (synchronized with SQLite store and ledger)
CASES_REGISTRY: dict[str, CaseRecord] = {}


def register_case(record: CaseRecord) -> None:
    """Store or update a case in the in-memory registry and persist to SQLite."""
    CASES_REGISTRY[record.case_id] = record
    default_store.save_case(
        case_id=record.case_id,
        dispute_id=record.dispute_id,
        record_dict=record.model_dump(mode="json"),
    )


def get_case(case_id: str) -> Optional[CaseRecord]:
    """Retrieve case by ID or dispute_id."""
    if case_id in CASES_REGISTRY:
        return CASES_REGISTRY[case_id]
    for c in CASES_REGISTRY.values():
        if c.dispute_id == case_id:
            return c
    return None


def ensure_seeded_if_empty() -> None:
    """Restore cases from SQLite store, or auto-seed demo cases if store is empty."""
    if CASES_REGISTRY:
        return

    stored = default_store.load_all_cases()
    if stored:
        for item in stored:
            try:
                rec = CaseRecord.model_validate(item)
                CASES_REGISTRY[rec.case_id] = rec
            except Exception as exc:  # noqa: BLE001
                logger.warning("Skipping invalid stored case record: %s", exc)
        if CASES_REGISTRY:
            return

    from scripts.seed_demo import seed_all_cases

    seed_all_cases()


def _parse_iso_timestamp(iso_str: Optional[str], fallback_ts: int) -> int:
    """Parse ISO-8601 timestamp into UTC epoch seconds, returning fallback_ts if invalid."""
    if not iso_str:
        return fallback_ts
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp())
    except ValueError:
        return fallback_ts


def _format_bryntum_date(ts: int) -> str:
    """Format epoch seconds as UTC ISO-8601 string for Bryntum Scheduler."""
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


async def ingest_paypal_dispute(
    dispute_id: str,
    *,
    status: str = "OPEN",
    lifecycle_stage: Optional[str] = None,
    reason: str = "OTHER",
    amount: Decimal = Decimal("95.00"),
    currency: str = "USD",
    seller_response_due_date: Optional[str] = None,
    allowed_links: Optional[list[str]] = None,
    allowed_response_options: Optional[list[str]] = None,
    order_id: Optional[str] = None,
    capture_id: Optional[str] = None,
    custom_id: Optional[str] = None,
    source_mode: str = "PAYPAL_SANDBOX",
    inspection_notes: Optional[str] = None,
) -> CaseRecord:
    """Create or update a CaseRecord from a PayPal dispute (webhook, sync, or simulator)."""
    ensure_seeded_if_empty()
    existing = get_case(dispute_id)
    if existing:
        existing.status = status or existing.status
        if lifecycle_stage:
            existing.lifecycle_stage = lifecycle_stage
        if seller_response_due_date:
            existing.seller_response_due_date = seller_response_due_date
        if allowed_links is not None:
            existing.allowed_links = allowed_links
        if allowed_response_options is not None:
            existing.allowed_response_options = allowed_response_options
        register_case(existing)
        return existing

    # Correlate with a real stored purchase if custom_id or order_id matches
    purchase = None
    if order_id:
        purchase = default_store.get_purchase(order_id)
    if not purchase and custom_id:
        purchase = default_store.find_purchase_by_custom_id(custom_id)

    now = int(time.time())
    case_id = f"case-{dispute_id.lower().replace('_', '-')}"

    if purchase and purchase.get("mandate_pack"):
        from agentcourt.agent.scoring import CandidateTrace
        from agentcourt.mandate.models import SignedMandatePack

        pack = SignedMandatePack.model_validate(purchase["mandate_pack"])
        trace = (
            CandidateTrace.model_validate(purchase["candidate_trace"])
            if purchase.get("candidate_trace")
            else None
        )
        resolved_order_id = purchase.get("order_id") or order_id or f"ORDER-{dispute_id}"
        resolved_binding = purchase.get("captured_custom_id") or purchase.get("order_binding") or custom_id
        listing = purchase.get("chosen_item", {}).get("attributes") or {"ports_count": 8, "has_hdmi_4k": True}
        resolved_capture_id = capture_id or purchase.get("capture_id")
    else:
        from eval.scenarios import _create_base_pack

        resolved_order_id = order_id or f"ORDER-{dispute_id}"
        pack, trace, resolved_binding = _create_base_pack(order_id=resolved_order_id, item_price=amount)
        listing = {"ports_count": 8, "has_hdmi_4k": True}
        resolved_capture_id = capture_id

    notes = inspection_notes or f"PayPal dispute ingested ({reason})."
    ports_delivered = 6 if "6" in notes else listing.get("ports_count", 8)
    delivery_report = {
        "status": "inspected",
        "ports_count": ports_delivered,
        "has_hdmi_4k": False if "missing required 4k" in notes.lower() else listing.get("has_hdmi_4k", True),
        "inspection_notes": notes,
    }

    ep = EvidencePack(
        case_id=case_id,
        dispute_id=dispute_id,
        dispute_reason=reason,
        disputed_amount=amount,
        currency=currency,
        mandate_pack=pack,
        paypal_order_id=resolved_order_id,
        paypal_capture_id=resolved_capture_id,
        captured_amount=amount,
        captured_custom_id=resolved_binding,
        merchant_listing=listing,
        delivery_report=delivery_report,
        candidate_trace=trace,
        creation_time=now,
    )

    engine = ArbiterEngine()
    verdict = await engine.adjudicate(ep)
    planned = plan_action_for_verdict(verdict, amount)

    due_date = seller_response_due_date or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now + 86400 * 5))

    record = CaseRecord(
        case_id=case_id,
        dispute_id=dispute_id,
        status=status or "WAITING_FOR_SELLER_RESPONSE",
        lifecycle_stage=lifecycle_stage or "INQUIRY",
        disputed_amount=amount,
        currency=currency,
        seller_response_due_date=due_date,
        allowed_links=allowed_links or [],
        allowed_response_options=allowed_response_options or [],
        source_mode=source_mode,
        evidence_pack=ep,
        verdict=verdict,
        planned_action=planned,
        created_at=now,
        executed=False,
    )
    register_case(record)

    default_ledger.append(
        event_type=LedgerEventType.DISPUTE_OPENED,
        payload={
            "dispute_id": dispute_id,
            "reason": reason,
            "amount": f"{amount:.2f}",
            "verdict": verdict.verdict.value,
            "source_mode": source_mode,
        },
        case_id=case_id,
    )
    return record


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
                "source_mode": c.source_mode,
                "verdict": c.verdict.verdict.value,
                "verdict_summary": c.verdict.summary,
                "action_type": c.planned_action.action_type.value,
                "executed": c.executed,
                "execution_mode": c.execution_mode,
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


@router.post("/sync-paypal")
async def sync_paypal_disputes() -> dict[str, Any]:
    """Pull active disputes from PayPal Sandbox Disputes API and correlate with AgentCourt cases."""
    ensure_seeded_if_empty()
    client = PayPalClient()
    try:
        disputes: list[DisputeDetail] = await client.list_disputes(page_size=20)
        synced_ids: list[str] = []
        for d in disputes:
            amt = d.dispute_amount.to_decimal() if d.dispute_amount else Decimal("0.00")
            curr = d.dispute_amount.currency_code if d.dispute_amount else "USD"
            links = [link.rel for link in d.links]
            tx_list = d.raw_response.get("disputed_transactions", [])
            custom_id = tx_list[0].get("custom") if tx_list else None
            capture_id = tx_list[0].get("seller_transaction_id") if tx_list else None

            rec = await ingest_paypal_dispute(
                d.dispute_id,
                status=d.status,
                lifecycle_stage=d.dispute_life_cycle_stage,
                reason=d.reason or "OTHER",
                amount=amt,
                currency=curr,
                seller_response_due_date=d.seller_response_due_date,
                allowed_links=links,
                allowed_response_options=d.allowed_response_options or [],
                capture_id=capture_id,
                custom_id=custom_id,
                source_mode="PAYPAL_SANDBOX",
            )
            synced_ids.append(rec.case_id)

        return {"status": "SUCCESS", "synced_count": len(synced_ids), "case_ids": synced_ids}
    except PayPalAPIError as exc:
        raise HTTPException(
            status_code=exc.status_code if 400 <= exc.status_code < 500 else 502,
            detail=f"PayPal Sandbox sync failed: {exc}",
        )
    finally:
        await client.close()


@router.get("/ledger/verify")
async def verify_ledger_integrity() -> dict[str, Any]:
    """Verify SHA-256 hash chain integrity across the entire append-only ledger."""
    intact, error_reason = default_ledger.verify_integrity()
    entries = default_ledger.get_entries()
    return {
        "intact": intact,
        "error": error_reason,
        "total_entries": len(entries),
        "latest_hash": entries[-1].entry_hash if entries else None,
    }


@router.get("/timeline")
async def get_bryntum_timeline_data() -> dict[str, Any]:
    """Feed structured resources, events, and time range for Bryntum Scheduler component."""
    ensure_seeded_if_empty()

    resources = []
    events = []
    min_ts: Optional[int] = None
    max_ts: Optional[int] = None

    verdict_colors = {
        "MERCHANT_AT_FAULT": "#F59E0B",
        "OPERATOR_AT_FAULT": "#8B5CF6",
        "WITHIN_MANDATE_REGRET": "#06B6D4",
        "NO_FAULT": "#10B981",
        "NEEDS_HUMAN": "#F97316",
    }

    for c in CASES_REGISTRY.values():
        res_id = c.case_id
        v_color = verdict_colors.get(c.verdict.verdict.value, "#3B82F6")

        resources.append(
            {
                "id": res_id,
                "name": f"{c.case_id}",
                "dispute_id": c.dispute_id,
                "verdict": c.verdict.verdict.value,
                "amount": f"${c.disputed_amount:.2f} {c.currency}",
                "currency": c.currency,
                "status": c.status,
                "source_mode": c.source_mode,
            }
        )

        c_time = c.created_at
        due_ts = _parse_iso_timestamp(c.seller_response_due_date, c_time + 86400 * 6)
        if due_ts <= c_time + 86400:
            due_ts = c_time + 86400 * 5

        inquiry_end_ts = min(c_time + 86400 * 3, due_ts - 86400 * 2)
        if inquiry_end_ts <= c_time:
            inquiry_end_ts = c_time + 86400

        prep_start_ts = max(inquiry_end_ts, due_ts - 86400 * 2)
        prep_end_ts = max(prep_start_ts + 43200, due_ts - 43200)

        min_ts = c_time if min_ts is None else min(min_ts, c_time)
        max_ts = due_ts if max_ts is None else max(max_ts, due_ts)

        # 1. Inquiry Window
        events.append(
            {
                "id": f"{res_id}-inquiry",
                "resourceId": res_id,
                "name": f"Inquiry: {c.dispute_id}",
                "startDate": _format_bryntum_date(c_time),
                "endDate": _format_bryntum_date(inquiry_end_ts),
                "eventColor": "slate",
                "style": "background-color:#334155;border-color:#64748B;color:#F8FAFC;",
                "cls": "inquiry-window-event",
                "eventType": "inquiry",
                "verdict": c.verdict.verdict.value,
                "disputeId": c.dispute_id,
                "lifecycleStage": c.lifecycle_stage,
            }
        )

        # 2. Evidence Prep Block before actual seller_response_due_date
        events.append(
            {
                "id": f"{res_id}-prep",
                "resourceId": res_id,
                "name": f"Arbiter Prep: {c.verdict.verdict.value}",
                "startDate": _format_bryntum_date(prep_start_ts),
                "endDate": _format_bryntum_date(prep_end_ts),
                "style": f"background-color:{v_color};border-color:{v_color};color:#0F172A;font-weight:600;",
                "cls": "prep-block-event",
                "eventType": "prep",
                "verdict": c.verdict.verdict.value,
                "disputeId": c.dispute_id,
                "lifecycleStage": c.lifecycle_stage,
            }
        )

        # 3. Seller Response Due Date milestone marker (duration 0 => milestone in Bryntum)
        events.append(
            {
                "id": f"{res_id}-deadline",
                "resourceId": res_id,
                "name": "Seller Response Due",
                "startDate": _format_bryntum_date(due_ts),
                "endDate": _format_bryntum_date(due_ts),
                "style": "background-color:#EF4444;border-color:#FCA5A5;color:#FFFFFF;",
                "cls": "deadline-milestone-event",
                "eventType": "deadline",
                "verdict": c.verdict.verdict.value,
                "disputeId": c.dispute_id,
                "lifecycleStage": c.lifecycle_stage,
            }
        )

        # 4. Resolution event (if executed)
        if c.executed:
            res_start = max(prep_end_ts, due_ts - 86400)
            events.append(
                {
                    "id": f"{res_id}-resolution",
                    "resourceId": res_id,
                    "name": f"Executed: {c.planned_action.action_type.value}",
                    "startDate": _format_bryntum_date(res_start),
                    "endDate": _format_bryntum_date(res_start + 43200),
                    "style": "background-color:#10B981;border-color:#34D399;color:#052E16;font-weight:600;",
                    "cls": "resolution-event",
                    "eventType": "resolution",
                    "verdict": c.verdict.verdict.value,
                    "disputeId": c.dispute_id,
                    "lifecycleStage": c.lifecycle_stage,
                }
            )

    now = int(time.time())
    start_bound = _format_bryntum_date((min_ts or now) - 43200)
    end_bound = _format_bryntum_date((max_ts or (now + 86400 * 7)) + 86400)

    return {
        "success": True,
        "startDate": start_bound,
        "endDate": end_bound,
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

    permitted, reason = is_action_permitted(
        case.planned_action.action_type,
        allowed_links=case.allowed_links,
        allowed_response_options=case.allowed_response_options,
    )
    if not permitted:
        raise HTTPException(status_code=409, detail=reason or "Planned action is not permitted by PayPal dispute stage.")

    client = PayPalClient()
    executor = ActionExecutor(payments=client)

    try:
        execution_mode = "paypal_sandbox"
        is_simulated_id = case.dispute_id.startswith("PP-D-")
        if is_simulated_id:
            # Local simulated dispute fixture: mark executed without misrepresenting a live PayPal call
            case.planned_action.executed = True
            execution_mode = "local_sandbox_fallback"
            result: dict[str, Any] = {
                "status": "RESOLVED" if case.planned_action.action_type.value == "accept-claim" else "UNDER_REVIEW",
                "execution_mode": execution_mode,
                "note": (
                    f"Simulated fixture dispute '{case.dispute_id}' settled locally. "
                    "Use a real PayPal Sandbox dispute ID to execute directly against api-m.sandbox.paypal.com."
                ),
            }
            default_ledger.append(
                event_type=LedgerEventType.ACTION_EXECUTED,
                payload={
                    "action_type": case.planned_action.action_type.value,
                    "api_path": case.planned_action.api_path,
                    "approver": req.approver,
                    "execution_mode": execution_mode,
                    "result": result,
                },
                case_id=case.case_id,
            )
        else:
            try:
                result = await executor.execute(case.planned_action, approver=req.approver)
                result = {**result, "execution_mode": execution_mode}
            except PayPalAPIError as exc:
                execution_mode = "local_sandbox_fallback"
                case.planned_action.executed = True
                result = {
                    "status": "UNDER_REVIEW",
                    "execution_mode": execution_mode,
                    "fallback_reason": str(exc),
                    "note": "PayPal Sandbox API rejected or gated this dispute action; recorded in local fallback ledger.",
                }
                default_ledger.append(
                    event_type=LedgerEventType.ACTION_EXECUTED,
                    payload={
                        "action_type": case.planned_action.action_type.value,
                        "api_path": case.planned_action.api_path,
                        "approver": req.approver,
                        "execution_mode": execution_mode,
                        "fallback_reason": str(exc),
                    },
                    case_id=case.case_id,
                )

        case.executed = True
        case.execution_mode = execution_mode
        case.execution_result = result
        case.status = "RESOLVED" if case.planned_action.action_type.value == "accept-claim" else "UNDER_REVIEW"
        register_case(case)

        return {
            "status": "SUCCESS",
            "case_id": case.case_id,
            "action_executed": case.planned_action.action_type.value,
            "execution_mode": execution_mode,
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
    use_live_sandbox: bool = False


@router.post("/simulate-buyer-dispute")
async def simulate_buyer_dispute_endpoint(req: SimulateDisputeRequest) -> dict[str, Any]:
    """Simulator endpoint to create a sandbox buyer dispute on any order (live attempt or labeled fixture)."""
    disp_id = f"PP-D-SIM-{int(time.time()) % 100000}"
    source_mode = "SIMULATED_FIXTURE"
    paypal_note: Optional[str] = None
    allowed_links: list[str] = []
    allowed_options: list[str] = []
    due_date: Optional[str] = None

    if req.use_live_sandbox and req.buyer_transaction_id:
        client = PayPalClient()
        try:
            try:
                reason_enum = DisputeReason(req.reason)
            except ValueError:
                reason_enum = DisputeReason.OTHER
            detail = await client.create_dispute(
                DisputeCreateRequest(
                    buyer_transaction_id=req.buyer_transaction_id,
                    amount=req.amount,
                    currency="USD",
                    reason=reason_enum,
                    note=req.inspection_notes,
                )
            )
            disp_id = detail.dispute_id
            source_mode = "PAYPAL_SANDBOX"
            allowed_links = [link.rel for link in detail.links]
            allowed_options = detail.allowed_response_options or []
            due_date = detail.seller_response_due_date
        except (PayPalAPIError, ValueError) as exc:
            paypal_note = f"Live PayPal dispute creation unavailable ({exc}); created labeled sandbox fixture instead."
            logger.info("Sandbox dispute creation fallback: %s", exc)
        finally:
            await client.close()

    record = await ingest_paypal_dispute(
        disp_id,
        status="WAITING_FOR_SELLER_RESPONSE",
        lifecycle_stage="INQUIRY",
        reason=req.reason,
        amount=req.amount,
        currency="USD",
        seller_response_due_date=due_date,
        allowed_links=allowed_links,
        allowed_response_options=allowed_options,
        order_id=req.order_id,
        capture_id=req.buyer_transaction_id,
        source_mode=source_mode,
        inspection_notes=req.inspection_notes,
    )

    return {
        "status": "SUCCESS",
        "case_id": record.case_id,
        "dispute_id": record.dispute_id,
        "source_mode": record.source_mode,
        "paypal_note": paypal_note,
        "verdict": record.verdict.verdict.value,
        "summary": record.verdict.summary,
    }


@router.post("/{case_id}/simulate-webhook-update")
async def simulate_webhook_deadline_shift(case_id: str) -> dict[str, Any]:
    """Simulate a PayPal CUSTOMER.DISPUTE.UPDATED webhook that escalates stage and shifts due date."""
    ensure_seeded_if_empty()
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")

    current_due = _parse_iso_timestamp(case.seller_response_due_date, case.created_at + 86400 * 6)
    new_due = max(case.created_at + 86400 * 3, current_due - 86400 * 2)
    new_due_iso = _format_bryntum_date(new_due)

    case.seller_response_due_date = new_due_iso
    case.lifecycle_stage = "CHARGEBACK" if case.lifecycle_stage == "INQUIRY" else "PRE_ARBITRATION"
    register_case(case)

    event_id = f"WH-SIM-{case.dispute_id}-{int(time.time())}"
    default_store.record_webhook_event(event_id, "CUSTOMER.DISPUTE.UPDATED", verified=False)
    default_ledger.append(
        event_type=LedgerEventType.DISPUTE_OPENED,
        payload={
            "webhook_event_id": event_id,
            "event_type": "CUSTOMER.DISPUTE.UPDATED",
            "lifecycle_stage": case.lifecycle_stage,
            "shifted_due_date": new_due_iso,
        },
        case_id=case.case_id,
    )

    return {
        "status": "SUCCESS",
        "case_id": case.case_id,
        "dispute_id": case.dispute_id,
        "lifecycle_stage": case.lifecycle_stage,
        "seller_response_due_date": new_due_iso,
        "webhook_event_id": event_id,
    }
