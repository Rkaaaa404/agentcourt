"""Data models for the immutable, hash-chained append-only ledger."""

import time
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

from agentcourt.mandate.crypto import canonical_hash

GENESIS_PREV_HASH = "0" * 64


class LedgerEventType(str, Enum):
    INTENT_MANDATE_CREATED = "INTENT_MANDATE_CREATED"
    CART_MANDATE_CREATED = "CART_MANDATE_CREATED"
    ORDER_CREATED = "ORDER_CREATED"
    ORDER_CAPTURED = "ORDER_CAPTURED"
    DISPUTE_OPENED = "DISPUTE_OPENED"
    EVIDENCE_COMPILED = "EVIDENCE_COMPILED"
    VERDICT_RENDERED = "VERDICT_RENDERED"
    ACTION_PLANNED = "ACTION_PLANNED"
    ACTION_EXECUTED = "ACTION_EXECUTED"
    OPERATOR_LIABILITY_RECORDED = "OPERATOR_LIABILITY_RECORDED"
    AGENT_REGRET_RECORDED = "AGENT_REGRET_RECORDED"


class LedgerEntry(BaseModel):
    """An individual entry in the append-only cryptographic event log."""

    index: int
    timestamp: int = Field(default_factory=lambda: int(time.time()))
    event_type: str
    case_id: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)
    prev_hash: str = GENESIS_PREV_HASH
    entry_hash: str = ""

    def payload_for_hashing(self) -> dict[str, Any]:
        """Dictionary representation used to calculate the entry_hash."""
        return {
            "index": self.index,
            "timestamp": self.timestamp,
            "event_type": self.event_type,
            "case_id": self.case_id or "",
            "payload": self.payload,
            "prev_hash": self.prev_hash,
        }

    def compute_hash(self) -> str:
        """Compute the SHA-256 hash of this entry."""
        return canonical_hash(self.payload_for_hashing())
