"""PaymentsPort interface defining the abstraction boundary for all payment operations.

Decouples the arbiter and executor from direct PayPal API dependencies,
allowing clean testing and fallback settlement via the Refunds API.
"""

from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Any

from veripact.payments.models import (
    AcceptClaimType,
    AdjudicationOutcome,
    CaptureResponse,
    DisputeCreateRequest,
    DisputeDetail,
    OfferType,
    OrderCreateRequest,
    OrderResponse,
    RequireEvidenceAction,
)


class PaymentsPort(ABC):
    """Port interface for all payment and dispute operations."""

    @abstractmethod
    async def create_order(self, request: OrderCreateRequest) -> OrderResponse:
        """Create a PayPal order with CAPTURE intent and custom_id binding."""

    @abstractmethod
    async def capture_order(self, order_id: str) -> CaptureResponse:
        """Capture an approved PayPal order."""

    @abstractmethod
    async def get_order(self, order_id: str) -> OrderResponse:
        """Fetch details of an order."""

    @abstractmethod
    async def patch_order_custom_id(self, order_id: str, custom_id: str) -> bool:
        """Update the custom_id binding on an existing PayPal order."""

    @abstractmethod
    async def refund_capture(
        self,
        capture_id: str,
        amount: Decimal | None = None,
        note: str | None = None,
    ) -> dict[str, Any]:
        """Issue a refund against a captured payment."""

    @abstractmethod
    async def create_dispute(self, request: DisputeCreateRequest) -> DisputeDetail:
        """Buyer-side simulation: create a customer dispute in the sandbox."""

    @abstractmethod
    async def list_disputes(self, page_size: int = 20) -> list[DisputeDetail]:
        """List customer disputes from the sandbox."""

    @abstractmethod
    async def get_dispute(self, dispute_id: str) -> DisputeDetail:
        """Fetch latest details, status, allowed response options, and HATEOAS links for a dispute."""

    @abstractmethod
    async def change_dispute_reason(
        self,
        dispute_id: str,
        reason: str,
        note: str,
    ) -> DisputeDetail:
        """Change the reason of an active sandbox dispute."""

    @abstractmethod
    async def send_dispute_message(self, dispute_id: str, message: str) -> dict[str, Any]:
        """Send a message to the other party in a dispute."""

    @abstractmethod
    async def make_dispute_offer(
        self,
        dispute_id: str,
        amount: Decimal,
        offer_type: OfferType = OfferType.REFUND,
        note: str = "",
    ) -> dict[str, Any]:
        """Merchant action: make a settlement offer."""

    @abstractmethod
    async def accept_dispute_claim(
        self,
        dispute_id: str,
        claim_type: AcceptClaimType = AcceptClaimType.REFUND,
        amount: Decimal | None = None,
        note: str | None = None,
    ) -> dict[str, Any]:
        """Merchant action: accept buyer's claim and refund."""

    @abstractmethod
    async def escalate_dispute(self, dispute_id: str, note: str) -> dict[str, Any]:
        """Escalate dispute to PayPal for review."""

    @abstractmethod
    async def provide_dispute_evidence(
        self,
        dispute_id: str,
        evidence_type: str = "OTHER",
        notes: str = "",
    ) -> dict[str, Any]:
        """Merchant action: submit evidence pack to defend dispute."""

    @abstractmethod
    async def simulate_require_evidence(
        self,
        dispute_id: str,
        action: RequireEvidenceAction = RequireEvidenceAction.SELLER_EVIDENCE,
    ) -> dict[str, Any]:
        """Sandbox-only simulation: trigger state transition to require evidence."""

    @abstractmethod
    async def simulate_adjudicate(
        self,
        dispute_id: str,
        outcome: AdjudicationOutcome = AdjudicationOutcome.SELLER_FAVOR,
    ) -> dict[str, Any]:
        """Sandbox-only simulation: resolve dispute in seller or buyer favor."""

    @abstractmethod
    async def verify_webhook_signature(
        self,
        headers: dict[str, str],
        body: bytes,
    ) -> bool:
        """Verify authenticity of an incoming PayPal webhook notification."""
