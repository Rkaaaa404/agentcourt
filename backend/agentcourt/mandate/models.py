"""Pydantic models for AP2-inspired Intent and Cart Mandates."""

import time
import uuid
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, Field

from agentcourt.mandate.crypto import (
    canonical_hash,
    compute_order_binding,
    sign_payload,
    verify_signature,
)


class UserConstraints(BaseModel):
    """Structured constraints extracted from the natural language prompt."""

    category: str = "USB-C docking station"
    min_ports: int = 8
    has_hdmi_4k: bool = True
    max_spend: Decimal = Field(default=Decimal("120.00"))
    currency: str = "USD"
    allowed_merchants: list[str] = Field(
        default_factory=lambda: [
            "dockcraft-simulated",
            "nexusgear-simulated",
            "ankerlink-simulated",
            "voltport-simulated",
        ]
    )
    required_features: list[str] = Field(default_factory=list)


class CartItem(BaseModel):
    """Specific line item selected for purchase."""

    item_id: str
    title: str
    price: Decimal
    currency: str = "USD"
    attributes: dict[str, Any] = Field(default_factory=dict)


class IntentMandate(BaseModel):
    """Cryptographic authorization from buyer defining what the agent is permitted to buy."""

    id: str = Field(default_factory=lambda: f"im_{uuid.uuid4().hex[:12]}")
    user_request: str
    constraints: UserConstraints
    spend_cap: Decimal
    allowed_merchants: list[str]
    expires_at: int = Field(
        default_factory=lambda: int(time.time()) + 3600,
        description="Unix timestamp after which mandate is expired (default 1 hour)",
    )
    nonce: str = Field(default_factory=lambda: uuid.uuid4().hex)
    public_key: str = ""
    signature: str = ""

    def unsigned_dict(self) -> dict[str, Any]:
        """Dictionary of fields covered by the cryptographic signature."""
        return {
            "id": self.id,
            "user_request": self.user_request,
            "constraints": {
                "category": self.constraints.category,
                "min_ports": self.constraints.min_ports,
                "has_hdmi_4k": self.constraints.has_hdmi_4k,
                "max_spend": f"{self.constraints.max_spend:.2f}",
                "currency": self.constraints.currency,
                "allowed_merchants": sorted(self.constraints.allowed_merchants),
                "required_features": sorted(self.constraints.required_features),
            },
            "spend_cap": f"{self.spend_cap:.2f}",
            "allowed_merchants": sorted(self.allowed_merchants),
            "expires_at": self.expires_at,
            "nonce": self.nonce,
            "public_key": self.public_key,
        }

    def hash(self) -> str:
        """Compute SHA-256 canonical hash of the unsigned intent mandate."""
        return canonical_hash(self.unsigned_dict())

    def sign(self, private_key_hex: str) -> None:
        """Sign the unsigned mandate with the given Ed25519 private key."""
        self.signature = sign_payload(private_key_hex, self.unsigned_dict())

    def is_valid_signature(self) -> bool:
        """Verify the Ed25519 signature."""
        if not self.signature or not self.public_key:
            return False
        return verify_signature(self.public_key, self.unsigned_dict(), self.signature)

    def is_expired(self, current_time: Optional[int] = None) -> bool:
        """Check whether current time exceeds expiry timestamp."""
        now = current_time if current_time is not None else int(time.time())
        return now > self.expires_at


class CartMandate(BaseModel):
    """Cryptographic commitment by agent specifying the exact item and price, tied to the Intent."""

    id: str = Field(default_factory=lambda: f"cm_{uuid.uuid4().hex[:12]}")
    intent_hash: str = Field(description="SHA-256 hash of the governing IntentMandate")
    merchant_id: str
    items: list[CartItem]
    total_amount: Decimal
    currency: str = "USD"
    created_at: int = Field(default_factory=lambda: int(time.time()))
    public_key: str = ""
    signature: str = ""

    def unsigned_dict(self) -> dict[str, Any]:
        """Dictionary of fields covered by the cryptographic signature."""
        return {
            "id": self.id,
            "intent_hash": self.intent_hash,
            "merchant_id": self.merchant_id,
            "items": [
                {
                    "item_id": item.item_id,
                    "title": item.title,
                    "price": f"{item.price:.2f}",
                    "currency": item.currency,
                    "attributes": item.attributes,
                }
                for item in self.items
            ],
            "total_amount": f"{self.total_amount:.2f}",
            "currency": self.currency,
            "created_at": self.created_at,
            "public_key": self.public_key,
        }

    def hash(self) -> str:
        """Compute SHA-256 canonical hash of the unsigned cart mandate."""
        return canonical_hash(self.unsigned_dict())

    def sign(self, private_key_hex: str) -> None:
        """Sign the unsigned cart mandate with the given Ed25519 private key."""
        self.signature = sign_payload(private_key_hex, self.unsigned_dict())

    def is_valid_signature(self) -> bool:
        """Verify the Ed25519 signature."""
        if not self.signature or not self.public_key:
            return False
        return verify_signature(self.public_key, self.unsigned_dict(), self.signature)


class SignedMandatePack(BaseModel):
    """Complete bundle containing IntentMandate and CartMandate."""

    intent: IntentMandate
    cart: CartMandate

    def compute_order_binding(self, paypal_order_id: str) -> str:
        """Calculate order_binding = sha256(intent_hash || cart_hash || paypal_order_id)."""
        return compute_order_binding(
            intent_hash=self.intent.hash(),
            cart_hash=self.cart.hash(),
            paypal_order_id=paypal_order_id,
        )
