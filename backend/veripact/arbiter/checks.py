"""Pure-function deterministic liability checks (C1 - C7 and Regret).

Pure functions: zero network access, completely deterministic.
"""

from decimal import Decimal
from typing import Any, Optional

from veripact.agent.scoring import CandidateTrace
from veripact.arbiter.models import CheckStatus, DeterministicCheckResult
from veripact.mandate.crypto import compute_order_binding
from veripact.mandate.models import SignedMandatePack, UserConstraints


def check_c1_signatures(pack: SignedMandatePack) -> DeterministicCheckResult:
    """C1: Signature validity of both IntentMandate and CartMandate."""
    intent_valid = pack.intent.is_valid_signature()
    cart_valid = pack.cart.is_valid_signature()

    if intent_valid and cart_valid:
        return DeterministicCheckResult(
            check_id="C1",
            name="Signature Validity",
            status=CheckStatus.PASS,
            details="Both IntentMandate and CartMandate have valid Ed25519 cryptographic signatures.",
        )

    failed = []
    if not intent_valid:
        failed.append("IntentMandate signature invalid or tampered")
    if not cart_valid:
        failed.append("CartMandate signature invalid or tampered")

    return DeterministicCheckResult(
        check_id="C1",
        name="Signature Validity",
        status=CheckStatus.FAIL,
        details="Signature verification failed.",
        failure_reason="; ".join(failed),
    )


def check_c2_expiry(pack: SignedMandatePack, reference_time: Optional[int] = None) -> DeterministicCheckResult:
    """C2: Mandate not expired at purchase/evaluation time."""
    ref = reference_time or pack.cart.created_at
    if not pack.intent.is_expired(ref):
        return DeterministicCheckResult(
            check_id="C2",
            name="Mandate Expiry",
            status=CheckStatus.PASS,
            details=f"Mandate was active at reference time (expires_at={pack.intent.expires_at}, ref={ref}).",
        )

    return DeterministicCheckResult(
        check_id="C2",
        name="Mandate Expiry",
        status=CheckStatus.FAIL,
        details="IntentMandate expired before cart commitment.",
        failure_reason=f"Mandate expired at timestamp {pack.intent.expires_at} (reference time {ref}).",
    )


def check_c3_intent_link(pack: SignedMandatePack) -> DeterministicCheckResult:
    """C3: CartMandate references the governing IntentMandate canonical hash."""
    computed_intent_hash = pack.intent.hash()
    referenced_hash = pack.cart.intent_hash

    if referenced_hash == computed_intent_hash:
        return DeterministicCheckResult(
            check_id="C3",
            name="Intent Hash Linkage",
            status=CheckStatus.PASS,
            details=f"CartMandate securely links to IntentMandate hash: {computed_intent_hash[:16]}...",
        )

    return DeterministicCheckResult(
        check_id="C3",
        name="Intent Hash Linkage",
        status=CheckStatus.FAIL,
        details="CartMandate does not reference the governing IntentMandate hash.",
        failure_reason=f"Expected {computed_intent_hash}, found {referenced_hash}",
    )


def check_c4_order_binding(
    pack: SignedMandatePack,
    paypal_order_id: str,
    captured_custom_id: Optional[str],
) -> DeterministicCheckResult:
    """C4: order_binding equals the value found in PayPal order/capture custom_id.

    Catches replay of a valid signed mandate onto another order.
    """
    if not captured_custom_id:
        return DeterministicCheckResult(
            check_id="C4",
            name="Order Binding (Anti-Replay)",
            status=CheckStatus.FAIL,
            details="PayPal transaction missing custom_id binding.",
            failure_reason="Captured PayPal transaction has no custom_id; unable to bind mandate to payment.",
        )

    # Definitive binding: sha256(intent_hash || cart_hash || paypal_order_id)
    definitive = pack.compute_order_binding(paypal_order_id)

    # Provisional binding: sha256(intent_hash || cart_hash || nonce)
    provisional = compute_order_binding(pack.intent.hash(), pack.cart.hash(), pack.intent.nonce)

    if captured_custom_id in (definitive, provisional):
        return DeterministicCheckResult(
            check_id="C4",
            name="Order Binding (Anti-Replay)",
            status=CheckStatus.PASS,
            details=f"Cryptographic order binding verified against custom_id ({captured_custom_id[:16]}...).",
        )

    return DeterministicCheckResult(
        check_id="C4",
        name="Order Binding (Anti-Replay)",
        status=CheckStatus.FAIL,
        details="Order binding mismatch. Mandate does not bind to this PayPal order.",
        failure_reason=f"Captured custom_id '{captured_custom_id[:16]}...' does not match expected binding '{definitive[:16]}...'.",
    )


def check_c5_amounts(
    intent_spend_cap: Decimal,
    cart_total: Decimal,
    captured_amount: Decimal,
) -> DeterministicCheckResult:
    """C5: Captured amount <= intent spend cap AND equals cart total (catches price drift)."""
    if captured_amount > intent_spend_cap:
        return DeterministicCheckResult(
            check_id="C5",
            name="Price Drift & Spend Cap",
            status=CheckStatus.FAIL,
            details=f"Captured amount ${captured_amount:.2f} exceeds authorized spend cap ${intent_spend_cap:.2f}.",
            failure_reason=f"Spend cap breach: ${captured_amount:.2f} > ${intent_spend_cap:.2f}",
        )

    if captured_amount != cart_total:
        return DeterministicCheckResult(
            check_id="C5",
            name="Price Drift & Spend Cap",
            status=CheckStatus.FAIL,
            details=f"Captured amount ${captured_amount:.2f} differs from signed cart total ${cart_total:.2f}.",
            failure_reason=f"Price drift detected: captured ${captured_amount:.2f} != cart total ${cart_total:.2f}",
        )

    return DeterministicCheckResult(
        check_id="C5",
        name="Price Drift & Spend Cap",
        status=CheckStatus.PASS,
        details=f"Captured amount ${captured_amount:.2f} is within cap (${intent_spend_cap:.2f}) and equals cart total.",
    )


def check_c6_allowed_merchant(
    allowed_merchants: list[str],
    cart_merchant_id: str,
) -> DeterministicCheckResult:
    """C6: Merchant is in the allowed merchants list."""
    if not allowed_merchants or cart_merchant_id in allowed_merchants:
        return DeterministicCheckResult(
            check_id="C6",
            name="Allowed Merchant Enforcement",
            status=CheckStatus.PASS,
            details=f"Merchant '{cart_merchant_id}' is authorized in the IntentMandate.",
        )

    return DeterministicCheckResult(
        check_id="C6",
        name="Allowed Merchant Enforcement",
        status=CheckStatus.FAIL,
        details=f"Merchant '{cart_merchant_id}' is NOT in allowed merchants list.",
        failure_reason=f"Unauthorized merchant: '{cart_merchant_id}' not in {allowed_merchants}",
    )


def check_c7_cart_attributes(
    constraints: UserConstraints,
    cart_attributes: dict[str, Any],
) -> DeterministicCheckResult:
    """C7: Cart attributes satisfy the user's intent constraints."""
    failures = []

    ports_count = int(cart_attributes.get("ports_count", 0))
    if ports_count < constraints.min_ports:
        failures.append(f"Signed cart has {ports_count} ports, buyer required >= {constraints.min_ports}")

    has_hdmi_4k = bool(cart_attributes.get("has_hdmi_4k", False))
    if constraints.has_hdmi_4k and not has_hdmi_4k:
        failures.append("Signed cart lacks required 4K HDMI capability")

    if not failures:
        return DeterministicCheckResult(
            check_id="C7",
            name="Mandate Attribute Compliance",
            status=CheckStatus.PASS,
            details=f"Cart attributes fulfill all intent constraints (ports={ports_count}, 4K HDMI={has_hdmi_4k}).",
        )

    return DeterministicCheckResult(
        check_id="C7",
        name="Mandate Attribute Compliance",
        status=CheckStatus.FAIL,
        details="Cart attributes violate authorized intent constraints.",
        failure_reason="; ".join(failures),
    )


def check_regret(
    candidate_trace: Optional[CandidateTrace],
    regret_threshold: float = 0.15,
) -> tuple[float, bool, DeterministicCheckResult]:
    """Calculate and record candidate regret score from the trace."""
    if not candidate_trace or not candidate_trace.evaluated_candidates:
        return (
            0.0,
            False,
            DeterministicCheckResult(
                check_id="REGRET",
                name="Agent Regret Measure",
                status=CheckStatus.SKIP,
                details="No candidate trace available for regret computation.",
            ),
        )

    score = candidate_trace.regret_score
    is_flagged = score > regret_threshold

    if is_flagged:
        best_name = candidate_trace.best_candidate.title if candidate_trace.best_candidate else "alternative"
        chosen_name = candidate_trace.chosen_candidate.title if candidate_trace.chosen_candidate else "chosen item"
        return (
            score,
            True,
            DeterministicCheckResult(
                check_id="REGRET",
                name="Agent Regret Measure",
                status=CheckStatus.FAIL,
                details=f"Agent regret index is {score:.1%} (exceeds {regret_threshold:.1%}).",
                failure_reason=f"Suboptimal choice: agent chose '{chosen_name}' while superior option '{best_name}' was available.",
            ),
        )

    return (
        score,
        False,
        DeterministicCheckResult(
            check_id="REGRET",
            name="Agent Regret Measure",
            status=CheckStatus.PASS,
            details=f"Agent regret index is {score:.1%} (within acceptable tolerance {regret_threshold:.1%}).",
        ),
    )
