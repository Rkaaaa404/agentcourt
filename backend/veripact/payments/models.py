"""Data models for PayPal Orders, Disputes, Webhooks, and PaymentsPort."""

from decimal import Decimal
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class OrderIntent(str, Enum):
    CAPTURE = "CAPTURE"
    AUTHORIZE = "AUTHORIZE"


class OrderStatus(str, Enum):
    CREATED = "CREATED"
    SAVED = "SAVED"
    APPROVED = "APPROVED"
    VOIDED = "VOIDED"
    COMPLETED = "COMPLETED"
    PAYER_ACTION_REQUIRED = "PAYER_ACTION_REQUIRED"


class DisputeReason(str, Enum):
    MERCHANDISE_OR_SERVICE_NOT_RECEIVED = "MERCHANDISE_OR_SERVICE_NOT_RECEIVED"
    MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED = "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED"
    UNAUTHORISED = "UNAUTHORISED"
    CREDIT_NOT_PROCESSED = "CREDIT_NOT_PROCESSED"
    OTHER = "OTHER"


class DisputeStatus(str, Enum):
    OPEN = "OPEN"
    WAITING_FOR_SELLER_RESPONSE = "WAITING_FOR_SELLER_RESPONSE"
    WAITING_FOR_BUYER_RESPONSE = "WAITING_FOR_BUYER_RESPONSE"
    UNDER_REVIEW = "UNDER_REVIEW"
    RESOLVED = "RESOLVED"
    OTHER = "OTHER"


class OfferType(str, Enum):
    REFUND = "REFUND"
    REFUND_WITH_RETURN = "REFUND_WITH_RETURN"
    REFUND_WITH_REPLACEMENT = "REFUND_WITH_REPLACEMENT"
    REPLACEMENT_WITHOUT_REFUND = "REPLACEMENT_WITHOUT_REFUND"


class AcceptClaimType(str, Enum):
    REFUND = "REFUND"
    PARTIAL_REFUND = "PARTIAL_REFUND"
    REFUND_WITH_RETURN = "REFUND_WITH_RETURN"


class AdjudicationOutcome(str, Enum):
    SELLER_FAVOR = "SELLER_FAVOR"
    BUYER_FAVOR = "BUYER_FAVOR"


class RequireEvidenceAction(str, Enum):
    SELLER_EVIDENCE = "SELLER_EVIDENCE"
    BUYER_EVIDENCE = "BUYER_EVIDENCE"


class Money(BaseModel):
    currency_code: str = "USD"
    value: str

    @classmethod
    def from_decimal(cls, amount: Decimal, currency: str = "USD") -> "Money":
        return cls(currency_code=currency, value=f"{amount:.2f}")

    def to_decimal(self) -> Decimal:
        return Decimal(self.value)


class HATEOASLink(BaseModel):
    href: str
    rel: str
    method: str | None = "GET"


class OrderCreateRequest(BaseModel):
    amount: Decimal
    currency: str = "USD"
    item_name: str
    custom_id: str = Field(description="Order binding hash: sha256(intent_hash || cart_hash || order_id)")
    return_url: str | None = None
    cancel_url: str | None = None


class OrderResponse(BaseModel):
    id: str
    status: str
    custom_id: str | None = None
    approval_url: str | None = None
    raw_response: dict[str, Any] = Field(default_factory=dict)


class CaptureResponse(BaseModel):
    id: str
    status: str
    order_id: str | None = None
    custom_id: str | None = None
    amount: Money | None = None
    raw_response: dict[str, Any] = Field(default_factory=dict)


class DisputeCreateRequest(BaseModel):
    buyer_transaction_id: str
    amount: Decimal
    currency: str = "USD"
    reason: DisputeReason = DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED
    note: str | None = None


class DisputeDetail(BaseModel):
    dispute_id: str
    status: str
    dispute_life_cycle_stage: str | None = None
    reason: str
    dispute_amount: Money | None = None
    seller_response_due_date: str | None = None
    allowed_response_options: list[str] | None = None
    evidences: list[dict[str, Any]] | None = None
    links: list[HATEOASLink] = Field(default_factory=list)
    raw_response: dict[str, Any] = Field(default_factory=dict)

    def has_link(self, rel: str) -> bool:
        return any(link.rel.lower() == rel.lower() for link in self.links)

    def get_link(self, rel: str) -> HATEOASLink | None:
        for link in self.links:
            if link.rel.lower() == rel.lower():
                return link
        return None


class WebhookVerifyRequest(BaseModel):
    auth_algo: str
    cert_url: str
    transmission_id: str
    transmission_sig: str
    transmission_time: str
    webhook_id: str
    webhook_event: dict[str, Any]


class WebhookVerifyResponse(BaseModel):
    verification_status: str  # "SUCCESS" or "FAILURE"
