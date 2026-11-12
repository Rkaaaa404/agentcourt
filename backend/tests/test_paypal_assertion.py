"""Tests for PayPal Auth Assertion unsigned JWT generation."""

import base64
import json

from veripact.payments.paypal_client import create_auth_assertion


def test_create_auth_assertion():
    client_id = "test_client_id_123"
    buyer_email = "testbuyer@sandbox.paypal.com"

    assertion = create_auth_assertion(client_id, buyer_email)

    # Format: header.payload. (trailing dot, exactly 2 dots)
    parts = assertion.split(".")
    assert len(parts) == 3
    assert parts[2] == ""  # trailing empty signature

    # Decode header
    header_padded = parts[0] + "=" * (-len(parts[0]) % 4)
    header = json.loads(base64.urlsafe_b64decode(header_padded).decode())
    assert header == {"alg": "none", "typ": "JWT"}

    # Decode payload
    payload_padded = parts[1] + "=" * (-len(parts[1]) % 4)
    payload = json.loads(base64.urlsafe_b64decode(payload_padded).decode())
    assert payload == {"iss": client_id, "email": buyer_email}
