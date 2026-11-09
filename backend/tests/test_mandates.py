"""Tests for IntentMandate, CartMandate, and SignedMandatePack."""

import time
from decimal import Decimal

from agentcourt.mandate.crypto import generate_keypair
from agentcourt.mandate.models import (
    CartItem,
    CartMandate,
    IntentMandate,
    SignedMandatePack,
    UserConstraints,
)


def test_intent_mandate_signing_and_verification():
    priv, pub = generate_keypair()
    constraints = UserConstraints(
        category="USB-C docking station",
        min_ports=8,
        has_hdmi_4k=True,
        max_spend=Decimal("120.00"),
    )

    intent = IntentMandate(
        user_request="Find USB-C docking station, 8+ ports, max $120",
        constraints=constraints,
        spend_cap=Decimal("120.00"),
        allowed_merchants=["dockcraft-simulated"],
        public_key=pub,
    )
    intent.sign(priv)

    assert intent.is_valid_signature() is True
    assert len(intent.hash()) == 64
    assert intent.is_expired() is False


def test_intent_mandate_expiry():
    priv, pub = generate_keypair()
    past_timestamp = int(time.time()) - 100
    intent = IntentMandate(
        user_request="Expired mandate test",
        constraints=UserConstraints(),
        spend_cap=Decimal("50.00"),
        allowed_merchants=["dockcraft-simulated"],
        expires_at=past_timestamp,
        public_key=pub,
    )
    assert intent.is_expired() is True


def test_cart_mandate_signing_and_link():
    intent_priv, intent_pub = generate_keypair()
    intent = IntentMandate(
        user_request="Test buy",
        constraints=UserConstraints(),
        spend_cap=Decimal("100.00"),
        allowed_merchants=["dockcraft-simulated"],
        public_key=intent_pub,
    )
    intent.sign(intent_priv)
    intent_hash = intent.hash()

    agent_priv, agent_pub = generate_keypair()
    cart_item = CartItem(
        item_id="item-dc-101",
        title="DockCraft Pro 10-in-1",
        price=Decimal("89.00"),
        currency="USD",
        attributes={"ports_count": 10},
    )

    cart = CartMandate(
        intent_hash=intent_hash,
        merchant_id="dockcraft-simulated",
        items=[cart_item],
        total_amount=Decimal("89.00"),
        currency="USD",
        public_key=agent_pub,
    )
    cart.sign(agent_priv)

    assert cart.is_valid_signature() is True
    assert cart.intent_hash == intent_hash

    pack = SignedMandatePack(intent=intent, cart=cart)
    binding = pack.compute_order_binding("ORDER-SANDBOX-777")
    assert len(binding) == 64
