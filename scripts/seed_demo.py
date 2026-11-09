#!/usr/bin/env python3
"""Seed realistic demo scenarios for AgentCourt.

Generates the 3 hackathon flagship scenarios (S1, S2, S3) with complete
cryptographic mandates, candidate traces, arbiter verdicts, and timeline records.
"""

import json
import sys
import time
from decimal import Decimal
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from agentcourt.agent.catalog import CatalogItem
from agentcourt.agent.scoring import (
    SelectionPolicy,
    evaluate_catalog_and_select,
)
from agentcourt.api.cases import CaseRecord, register_case
from agentcourt.arbiter import ArbiterEngine, EvidencePack
from agentcourt.executor import plan_action_for_verdict
from agentcourt.ledger import LedgerEventType, default_ledger
from agentcourt.mandate.crypto import generate_keypair
from agentcourt.mandate.models import (
    CartItem,
    CartMandate,
    IntentMandate,
    SignedMandatePack,
    UserConstraints,
)

CASES_FILE = PROJECT_ROOT / "data" / "demo_cases.json"


def build_scenario_s1() -> CaseRecord:
    """S1: Merchant at fault (listing claims 8 ports, delivery inspection finds 6 ports)."""
    now = int(time.time())
    buyer_priv, buyer_pub = generate_keypair()
    agent_priv, agent_pub = generate_keypair()

    constraints = UserConstraints(
        category="USB-C docking station",
        min_ports=8,
        has_hdmi_4k=True,
        max_spend=Decimal("120.00"),
        allowed_merchants=["voltport-simulated"],
    )

    intent = IntentMandate(
        id="im_s1_voltport",
        user_request="USB-C docking station, at least 8 ports, HDMI 4K output, max total USD 120, from VoltPort",
        constraints=constraints,
        spend_cap=Decimal("120.00"),
        allowed_merchants=["voltport-simulated"],
        public_key=buyer_pub,
    )
    intent.sign(buyer_priv)

    cart_item = CartItem(
        item_id="item-vp-401",
        title="VoltPort 8-in-1 Aluminum Docking Station",
        price=Decimal("95.00"),
        currency="USD",
        attributes={
            "item_id": "item-vp-401",
            "merchant_id": "voltport-simulated",
            "title": "VoltPort 8-in-1 Aluminum Docking Station",
            "ports_count": 8,
            "has_hdmi_4k": True,
            "power_delivery_watts": 85,
            "description": "Promised specs: 8 physical ports including HDMI 4K and 85W PD pass-through.",
        },
    )

    cart = CartMandate(
        id="cm_s1_voltport",
        intent_hash=intent.hash(),
        merchant_id="voltport-simulated",
        items=[cart_item],
        total_amount=Decimal("95.00"),
        currency="USD",
        public_key=agent_pub,
    )
    cart.sign(agent_priv)

    pack = SignedMandatePack(intent=intent, cart=cart)
    order_id = "ORDER-SANDBOX-S1-VP"
    binding = pack.compute_order_binding(order_id)

    delivery_report = {
        "status": "inspected",
        "item_serial": "VP-SN-882190",
        "ports_count": 6,  # Defect: physical warehouse intake found only 6 ports!
        "has_hdmi_4k": True,
        "power_delivery_watts": 85,
        "inspection_notes": "Physical unit received has only 6 ports (lacks 2 USB-A ports claimed on packaging).",
    }

    candidates = [
        CatalogItem(
            id="item-vp-401",
            merchant_id="voltport-simulated",
            merchant_name="VoltPort Electronics",
            merchant_rating=3.9,
            title="VoltPort 8-in-1 Aluminum Dock",
            price=Decimal("95.00"),
            ports_count=8,
            has_hdmi_4k=True,
            power_delivery_watts=85,
        )
    ]
    _, trace = evaluate_catalog_and_select(candidates, constraints, policy=SelectionPolicy.OPTIMAL)

    evidence_pack = EvidencePack(
        case_id="case-s1-merchant-breach",
        dispute_id="PP-D-1001-SANDBOX",
        dispute_reason="MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
        disputed_amount=Decimal("95.00"),
        mandate_pack=pack,
        paypal_order_id=order_id,
        paypal_capture_id="CAPTURE-SANDBOX-S1-001",
        captured_amount=Decimal("95.00"),
        captured_custom_id=binding,
        merchant_listing=cart_item.attributes,
        delivery_report=delivery_report,
        candidate_trace=trace,
        creation_time=now - 86400 * 2,
    )

    # Adjudicate
    engine = ArbiterEngine()
    import asyncio

    verdict = asyncio.run(engine.adjudicate(evidence_pack))
    planned = plan_action_for_verdict(verdict, Decimal("95.00"))

    due_date = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now + 86400 * 5))

    return CaseRecord(
        case_id="case-s1-merchant-breach",
        dispute_id="PP-D-1001-SANDBOX",
        status="WAITING_FOR_SELLER_RESPONSE",
        lifecycle_stage="INQUIRY",
        disputed_amount=Decimal("95.00"),
        currency="USD",
        seller_response_due_date=due_date,
        evidence_pack=evidence_pack,
        verdict=verdict,
        planned_action=planned,
        created_at=now - 86400 * 2,
        executed=False,
    )


def build_scenario_s2() -> CaseRecord:
    """S2: Operator at fault (Price drift: Cart total was $89, captured amount was $119)."""
    now = int(time.time())
    buyer_priv, buyer_pub = generate_keypair()
    agent_priv, agent_pub = generate_keypair()

    constraints = UserConstraints(
        category="USB-C docking station",
        min_ports=8,
        has_hdmi_4k=True,
        max_spend=Decimal("120.00"),
        allowed_merchants=["dockcraft-simulated"],
    )

    intent = IntentMandate(
        id="im_s2_price_drift",
        user_request="USB-C docking station, 8+ ports, 4K HDMI, max $120",
        constraints=constraints,
        spend_cap=Decimal("120.00"),
        allowed_merchants=["dockcraft-simulated"],
        public_key=buyer_pub,
    )
    intent.sign(buyer_priv)

    cart_item = CartItem(
        item_id="item-dc-101",
        title="DockCraft Pro 10-in-1 USB-C Hub",
        price=Decimal("89.00"),
        currency="USD",
        attributes={
            "item_id": "item-dc-101",
            "merchant_id": "dockcraft-simulated",
            "title": "DockCraft Pro 10-in-1 USB-C Hub",
            "ports_count": 10,
            "has_hdmi_4k": True,
            "power_delivery_watts": 100,
        },
    )

    cart = CartMandate(
        id="cm_s2_price_drift",
        intent_hash=intent.hash(),
        merchant_id="dockcraft-simulated",
        items=[cart_item],
        total_amount=Decimal("89.00"),  # Signed cart total is $89.00!
        currency="USD",
        public_key=agent_pub,
    )
    cart.sign(agent_priv)

    pack = SignedMandatePack(intent=intent, cart=cart)
    order_id = "ORDER-SANDBOX-S2-DC"
    binding = pack.compute_order_binding(order_id)

    delivery_report = {
        "status": "inspected",
        "item_serial": "DC-PRO-99120",
        "ports_count": 10,
        "has_hdmi_4k": True,
        "power_delivery_watts": 100,
        "inspection_notes": "Unit verified in perfect condition with 10 operational ports and 4K display.",
    }

    candidates = [
        CatalogItem(
            id="item-dc-101",
            merchant_id="dockcraft-simulated",
            merchant_name="DockCraft",
            merchant_rating=4.8,
            title="DockCraft Pro 10-in-1",
            price=Decimal("89.00"),
            ports_count=10,
            has_hdmi_4k=True,
            power_delivery_watts=100,
        )
    ]
    _, trace = evaluate_catalog_and_select(candidates, constraints, policy=SelectionPolicy.OPTIMAL)

    evidence_pack = EvidencePack(
        case_id="case-s2-operator-price-drift",
        dispute_id="PP-D-1002-SANDBOX",
        dispute_reason="CREDIT_NOT_PROCESSED",
        disputed_amount=Decimal("119.00"),
        mandate_pack=pack,
        paypal_order_id=order_id,
        paypal_capture_id="CAPTURE-SANDBOX-S2-002",
        captured_amount=Decimal("119.00"),  # Drift: $119 captured instead of $89!
        captured_custom_id=binding,
        merchant_listing=cart_item.attributes,
        delivery_report=delivery_report,
        candidate_trace=trace,
        creation_time=now - 86400 * 1,
    )

    engine = ArbiterEngine()
    import asyncio

    verdict = asyncio.run(engine.adjudicate(evidence_pack))
    planned = plan_action_for_verdict(verdict, Decimal("119.00"))

    due_date = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now + 86400 * 7))

    return CaseRecord(
        case_id="case-s2-operator-price-drift",
        dispute_id="PP-D-1002-SANDBOX",
        status="WAITING_FOR_SELLER_RESPONSE",
        lifecycle_stage="INQUIRY",
        disputed_amount=Decimal("119.00"),
        currency="USD",
        seller_response_due_date=due_date,
        evidence_pack=evidence_pack,
        verdict=verdict,
        planned_action=planned,
        created_at=now - 86400 * 1,
        executed=False,
    )


def build_scenario_s3() -> CaseRecord:
    """S3: Agent regret (suboptimal choice: agent took first acceptable offer while better one existed)."""
    now = int(time.time())
    buyer_priv, buyer_pub = generate_keypair()
    agent_priv, agent_pub = generate_keypair()

    constraints = UserConstraints(
        category="USB-C docking station",
        min_ports=8,
        has_hdmi_4k=True,
        max_spend=Decimal("120.00"),
        allowed_merchants=["dockcraft-simulated", "nexusgear-simulated"],
    )

    intent = IntentMandate(
        id="im_s3_regret",
        user_request="USB-C docking station, at least 8 ports, HDMI 4K output, max total USD 120",
        constraints=constraints,
        spend_cap=Decimal("120.00"),
        allowed_merchants=constraints.allowed_merchants,
        public_key=buyer_pub,
    )
    intent.sign(buyer_priv)

    # NexusGear 8-port at $115 was chosen by naive FIRST_ACCEPTABLE policy
    cart_item = CartItem(
        item_id="item-ng-201",
        title="Nexus 8-Port Universal USB-C Dock",
        price=Decimal("115.00"),
        currency="USD",
        attributes={
            "item_id": "item-ng-201",
            "merchant_id": "nexusgear-simulated",
            "title": "Nexus 8-Port Universal USB-C Dock",
            "ports_count": 8,
            "has_hdmi_4k": True,
            "power_delivery_watts": 85,
        },
    )

    cart = CartMandate(
        id="cm_s3_regret",
        intent_hash=intent.hash(),
        merchant_id="nexusgear-simulated",
        items=[cart_item],
        total_amount=Decimal("115.00"),
        currency="USD",
        public_key=agent_pub,
    )
    cart.sign(agent_priv)

    pack = SignedMandatePack(intent=intent, cart=cart)
    order_id = "ORDER-SANDBOX-S3-NG"
    binding = pack.compute_order_binding(order_id)

    delivery_report = {
        "status": "inspected",
        "item_serial": "NG-8P-4401",
        "ports_count": 8,
        "has_hdmi_4k": True,
        "power_delivery_watts": 85,
        "inspection_notes": "Unit verified: 8 ports, 4K HDMI active.",
    }

    candidates = [
        CatalogItem(
            id="item-ng-201",
            merchant_id="nexusgear-simulated",
            merchant_name="NexusGear Direct",
            merchant_rating=4.5,
            title="Nexus 8-Port Universal USB-C Dock",
            price=Decimal("115.00"),
            ports_count=8,
            has_hdmi_4k=True,
            power_delivery_watts=85,
        ),
        CatalogItem(
            id="item-dc-101",
            merchant_id="dockcraft-simulated",
            merchant_name="DockCraft Labs",
            merchant_rating=4.8,
            title="DockCraft Pro 10-in-1 USB-C Hub",
            price=Decimal("89.00"),
            ports_count=10,
            has_hdmi_4k=True,
            power_delivery_watts=100,
        ),
    ]
    _, trace = evaluate_catalog_and_select(candidates, constraints, policy=SelectionPolicy.FIRST_ACCEPTABLE)

    evidence_pack = EvidencePack(
        case_id="case-s3-agent-regret",
        dispute_id="PP-D-1003-SANDBOX",
        dispute_reason="OTHER",
        disputed_amount=Decimal("115.00"),
        mandate_pack=pack,
        paypal_order_id=order_id,
        paypal_capture_id="CAPTURE-SANDBOX-S3-003",
        captured_amount=Decimal("115.00"),
        captured_custom_id=binding,
        merchant_listing=cart_item.attributes,
        delivery_report=delivery_report,
        candidate_trace=trace,
        creation_time=now - 86400 * 3,
    )

    engine = ArbiterEngine()
    import asyncio

    verdict = asyncio.run(engine.adjudicate(evidence_pack))
    planned = plan_action_for_verdict(verdict, Decimal("115.00"))

    due_date = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now + 86400 * 9))

    return CaseRecord(
        case_id="case-s3-agent-regret",
        dispute_id="PP-D-1003-SANDBOX",
        status="WAITING_FOR_SELLER_RESPONSE",
        lifecycle_stage="INQUIRY",
        disputed_amount=Decimal("115.00"),
        currency="USD",
        seller_response_due_date=due_date,
        evidence_pack=evidence_pack,
        verdict=verdict,
        planned_action=planned,
        created_at=now - 86400 * 3,
        executed=False,
    )


def seed_all_cases() -> list[CaseRecord]:
    """Register all 3 flagship scenarios in memory and save to JSON."""
    c1 = build_scenario_s1()
    c2 = build_scenario_s2()
    c3 = build_scenario_s3()

    cases = [c1, c2, c3]
    for c in cases:
        register_case(c)
        default_ledger.append(
            event_type=LedgerEventType.DISPUTE_OPENED,
            payload={
                "dispute_id": c.dispute_id,
                "reason": c.evidence_pack.dispute_reason,
                "amount": f"{c.disputed_amount:.2f}",
                "verdict": c.verdict.verdict.value,
            },
            case_id=c.case_id,
        )

    # Persist JSON dump for cold boots
    CASES_FILE.parent.mkdir(parents=True, exist_ok=True)
    serialized = [c.model_dump(mode="json") for c in cases]
    with open(CASES_FILE, "w", encoding="utf-8") as f:
        json.dump(serialized, f, indent=2)

    return cases


def main() -> int:
    print("=" * 60)
    print("AgentCourt Demo Seeding Script")
    print("=" * 60)
    cases = seed_all_cases()
    for c in cases:
        print(f"[SEEDED] {c.case_id} ({c.dispute_id}) -> Verdict: {c.verdict.verdict.value}")
    print(f"\nSuccessfully seeded {len(cases)} cases to {CASES_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

