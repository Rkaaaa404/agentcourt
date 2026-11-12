"""Tests for canonical JSON serialization, hashing, and Ed25519 signing."""

from decimal import Decimal

from veripact.mandate.crypto import (
    canonical_hash,
    canonical_json_bytes,
    canonical_json_str,
    compute_order_binding,
    generate_keypair,
    sign_payload,
    verify_signature,
)


def test_canonical_json_key_order_invariance():
    """Verify that different key ordering produces identical canonical bytes."""
    dict1 = {"b": 2, "a": 1, "c": {"z": 26, "y": 25}}
    dict2 = {"a": 1, "c": {"y": 25, "z": 26}, "b": 2}

    assert canonical_json_bytes(dict1) == canonical_json_bytes(dict2)
    assert canonical_hash(dict1) == canonical_hash(dict2)


def test_canonical_json_decimal_formatting():
    """Verify Decimal formatting is normalized to 2 decimal places."""
    data = {"amount": Decimal("110.00"), "tax": Decimal("0.0")}
    canonical = canonical_json_str(data)
    assert canonical == '{"amount":"110.00","tax":"0.00"}'


def test_ed25519_sign_and_verify():
    """Verify valid signature returns True."""
    priv_hex, pub_hex = generate_keypair()
    payload = {"intent_id": "im_123", "spend_cap": "120.00", "currency": "USD"}

    sig_hex = sign_payload(priv_hex, payload)
    assert len(sig_hex) == 128  # 64-byte Ed25519 signature in hex
    assert verify_signature(pub_hex, payload, sig_hex) is True


def test_ed25519_tampered_payload_fails():
    """Verify changing payload fails signature check."""
    priv_hex, pub_hex = generate_keypair()
    payload = {"intent_id": "im_123", "spend_cap": "120.00"}
    sig_hex = sign_payload(priv_hex, payload)

    tampered_payload = {"intent_id": "im_123", "spend_cap": "999.00"}
    assert verify_signature(pub_hex, tampered_payload, sig_hex) is False


def test_ed25519_tampered_signature_fails():
    """Verify tampered signature returns False."""
    priv_hex, pub_hex = generate_keypair()
    payload = {"test": "data"}
    sig_hex = sign_payload(priv_hex, payload)

    tampered_sig = ("00" if sig_hex[:2] != "00" else "ff") + sig_hex[2:]
    assert verify_signature(pub_hex, payload, tampered_sig) is False


def test_order_binding_computation():
    """Verify order binding produces deterministic 64-char hex hash."""
    intent_hash = "a" * 64
    cart_hash = "b" * 64
    order_id = "ORDER-12345"

    binding1 = compute_order_binding(intent_hash, cart_hash, order_id)
    binding2 = compute_order_binding(intent_hash, cart_hash, order_id)

    assert binding1 == binding2
    assert len(binding1) == 64
    assert binding1 != compute_order_binding(intent_hash, cart_hash, "ORDER-DIFFERENT")
