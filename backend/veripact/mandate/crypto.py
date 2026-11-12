"""Cryptographic utilities for canonical JSON serialization, SHA-256 hashing, and Ed25519 signatures."""

import hashlib
import json
from decimal import Decimal
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric import ed25519


def _json_default(obj: Any) -> Any:
    """Format non-standard types deterministically for canonical serialization."""
    if isinstance(obj, Decimal):
        return f"{obj:.2f}"
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def canonical_json_bytes(data: Any) -> bytes:
    """Serialize data into canonical JSON bytes.

    Features:
    - Keys recursively sorted alphabetically
    - Strict delimiter formatting with zero extraneous whitespace
    - UTF-8 encoded
    - Decimals formatted as fixed 2-place strings
    """
    return json.dumps(
        data,
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
        default=_json_default,
    ).encode("utf-8")


def canonical_json_str(data: Any) -> str:
    """Return UTF-8 decoded canonical JSON string."""
    return canonical_json_bytes(data).decode("utf-8")


def sha256_hex(data_bytes: bytes) -> str:
    """Calculate 64-character lowercase hexadecimal SHA-256 hash."""
    return hashlib.sha256(data_bytes).hexdigest()


def canonical_hash(data: Any) -> str:
    """Compute the SHA-256 hash of canonical JSON-serialized data."""
    return sha256_hex(canonical_json_bytes(data))


def generate_keypair() -> tuple[str, str]:
    """Generate a new Ed25519 keypair, returned as (private_key_hex, public_key_hex)."""
    private_key = ed25519.Ed25519PrivateKey.generate()
    private_bytes = private_key.private_bytes_raw()
    public_bytes = private_key.public_key().public_bytes_raw()
    return private_bytes.hex(), public_bytes.hex()


def sign_payload(private_key_hex: str, payload: Any) -> str:
    """Sign a canonical JSON payload with an Ed25519 private key.

    Returns the signature as a lowercase hexadecimal string.
    """
    private_bytes = bytes.fromhex(private_key_hex)
    private_key = ed25519.Ed25519PrivateKey.from_private_bytes(private_bytes)
    data_to_sign = canonical_json_bytes(payload)
    sig_bytes = private_key.sign(data_to_sign)
    return sig_bytes.hex()


def verify_signature(public_key_hex: str, payload: Any, signature_hex: str) -> bool:
    """Verify an Ed25519 signature against canonical JSON payload.

    Returns True if valid, False otherwise.
    """
    try:
        public_bytes = bytes.fromhex(public_key_hex)
        sig_bytes = bytes.fromhex(signature_hex)
        public_key = ed25519.Ed25519PublicKey.from_public_bytes(public_bytes)
        data_to_verify = canonical_json_bytes(payload)
        public_key.verify(sig_bytes, data_to_verify)
        return True
    except (InvalidSignature, ValueError, TypeError):
        return False


def compute_order_binding(intent_hash: str, cart_hash: str, paypal_order_id: str) -> str:
    """Compute cryptographic order binding string.

    order_binding = sha256(intent_hash || cart_hash || paypal_order_id)
    Produces a 64-character hex string embedded in PayPal purchase_units[0].custom_id.
    """
    raw = f"{intent_hash}{cart_hash}{paypal_order_id}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()
