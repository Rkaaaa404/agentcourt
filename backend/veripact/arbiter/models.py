"""Data models for the Veripact Arbiter."""

from decimal import Decimal
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

from veripact.agent.scoring import CandidateTrace
from veripact.mandate.models import SignedMandatePack


class CheckStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    SKIP = "SKIP"


class VerdictType(str, Enum):
    MERCHANT_AT_FAULT = "MERCHANT_AT_FAULT"
    OPERATOR_AT_FAULT = "OPERATOR_AT_FAULT"
    WITHIN_MANDATE_REGRET = "WITHIN_MANDATE_REGRET"
    NO_FAULT = "NO_FAULT"
    NEEDS_HUMAN = "NEEDS_HUMAN"


class DeterministicCheckResult(BaseModel):
    """Result of a single deterministic check (C1 - C7 or Regret)."""

    check_id: str  # C1, C2, C3, C4, C5, C6, C7, REGRET
    name: str
    status: CheckStatus
    details: str
    failure_reason: Optional[str] = None


class SemanticComparisonResult(BaseModel):
    """Result of LLM-assisted or rule-assisted semantic comparison of listing vs delivery."""

    ports_match: str = "match"  # match, mismatch, unclear
    hdmi_match: str = "match"  # match, mismatch, unclear
    discrepancies: list[str] = Field(default_factory=list)
    is_mismatch: bool = False
    quote: str = ""
    llm_used: bool = False
    model: str = "deterministic_fallback"


class EvidencePack(BaseModel):
    """Cryptographic evidence pack assembled for a dispute case."""

    case_id: str
    dispute_id: str
    dispute_reason: str
    disputed_amount: Decimal
    currency: str = "USD"
    mandate_pack: SignedMandatePack
    paypal_order_id: str
    paypal_capture_id: Optional[str] = None
    captured_amount: Decimal
    captured_custom_id: Optional[str] = None
    merchant_listing: dict[str, Any]
    delivery_report: dict[str, Any]
    candidate_trace: Optional[CandidateTrace] = None
    creation_time: int = 0


class ArbiterVerdict(BaseModel):
    """Final liability verdict rendered by the dual-layer arbiter."""

    case_id: str
    dispute_id: str
    verdict: VerdictType
    summary: str
    deterministic_checks: list[DeterministicCheckResult]
    semantic_comparison: Optional[SemanticComparisonResult] = None
    regret_score: float = 0.0
    is_regret_flagged: bool = False
    failed_checks: list[str] = Field(default_factory=list)
    llm_used: bool = False
    verdict_timestamp: int = 0

    def all_deterministic_passed(self) -> bool:
        """True if every C1-C7 check passed."""
        return len(self.failed_checks) == 0

