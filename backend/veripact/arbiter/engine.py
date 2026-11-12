"""Dual-layer arbiter engine: deterministic checks first, constrained LLM comparison second."""

import time
from typing import Optional

from veripact.agent.llm import BaseLLMClient, get_llm_client
from veripact.arbiter.checks import (
    check_c1_signatures,
    check_c2_expiry,
    check_c3_intent_link,
    check_c4_order_binding,
    check_c5_amounts,
    check_c6_allowed_merchant,
    check_c7_cart_attributes,
    check_regret,
)
from veripact.arbiter.models import (
    ArbiterVerdict,
    CheckStatus,
    DeterministicCheckResult,
    EvidencePack,
    SemanticComparisonResult,
    VerdictType,
)
from veripact.config import settings


class ArbiterEngine:
    """Evaluates evidence packs to produce deterministic, transparent liability verdicts."""

    def __init__(self, llm_client: Optional[BaseLLMClient] = None):
        self.llm_client = llm_client or get_llm_client()

    async def adjudicate(
        self,
        pack: EvidencePack,
        regret_threshold: Optional[float] = None,
    ) -> ArbiterVerdict:
        """Adjudicate liability according to strict two-stage process:

        Stage 1: Deterministic checks (C1 - C7). Any failure is final. LLM cannot override.
        Stage 2: Merchant delivery comparison (Listing vs Delivery Report) and regret analysis.
        """
        threshold = regret_threshold if regret_threshold is not None else float(settings.REGRET_THRESHOLD)
        deterministic_results: list[DeterministicCheckResult] = []
        failed_checks: list[str] = []

        # Run checks C1 - C7
        c1 = check_c1_signatures(pack.mandate_pack)
        deterministic_results.append(c1)
        if c1.status == CheckStatus.FAIL:
            failed_checks.append("C1")

        c2 = check_c2_expiry(pack.mandate_pack, reference_time=pack.creation_time or None)
        deterministic_results.append(c2)
        if c2.status == CheckStatus.FAIL:
            failed_checks.append("C2")

        c3 = check_c3_intent_link(pack.mandate_pack)
        deterministic_results.append(c3)
        if c3.status == CheckStatus.FAIL:
            failed_checks.append("C3")

        c4 = check_c4_order_binding(pack.mandate_pack, pack.paypal_order_id, pack.captured_custom_id)
        deterministic_results.append(c4)
        if c4.status == CheckStatus.FAIL:
            failed_checks.append("C4")

        c5 = check_c5_amounts(
            intent_spend_cap=pack.mandate_pack.intent.spend_cap,
            cart_total=pack.mandate_pack.cart.total_amount,
            captured_amount=pack.captured_amount,
        )
        deterministic_results.append(c5)
        if c5.status == CheckStatus.FAIL:
            failed_checks.append("C5")

        c6 = check_c6_allowed_merchant(
            allowed_merchants=pack.mandate_pack.intent.allowed_merchants,
            cart_merchant_id=pack.mandate_pack.cart.merchant_id,
        )
        deterministic_results.append(c6)
        if c6.status == CheckStatus.FAIL:
            failed_checks.append("C6")

        # Extract cart attributes (from primary item)
        cart_attrs = {}
        if pack.mandate_pack.cart.items:
            cart_attrs = pack.mandate_pack.cart.items[0].attributes

        c7 = check_c7_cart_attributes(pack.mandate_pack.intent.constraints, cart_attrs)
        deterministic_results.append(c7)
        if c7.status == CheckStatus.FAIL:
            failed_checks.append("C7")

        # Regret evaluation (deterministic)
        regret_score, is_regret_flagged, regret_check = check_regret(pack.candidate_trace, threshold)
        deterministic_results.append(regret_check)

        # ---------------------------------------------------------------------
        # Stage 1 Decision Gate: If ANY C1 - C7 check failed -> OPERATOR_AT_FAULT
        # ---------------------------------------------------------------------
        if failed_checks:
            reasons = [r.failure_reason for r in deterministic_results if r.failure_reason]
            summary = (
                f"Agent Operator at fault: Mandate compliance violated ({', '.join(failed_checks)}). "
                f"Reason: {'; '.join(reasons)}"
            )
            return ArbiterVerdict(
                case_id=pack.case_id,
                dispute_id=pack.dispute_id,
                verdict=VerdictType.OPERATOR_AT_FAULT,
                summary=summary,
                deterministic_checks=deterministic_results,
                failed_checks=failed_checks,
                regret_score=regret_score,
                is_regret_flagged=is_regret_flagged,
                llm_used=False,
                verdict_timestamp=int(time.time()),
            )

        # ---------------------------------------------------------------------
        # Stage 2: Merchant Delivery Comparison & Regret Attribution
        # ---------------------------------------------------------------------
        # Check if delivery report is absent or unreadable
        if not pack.delivery_report or pack.delivery_report.get("status") == "unclear":
            return ArbiterVerdict(
                case_id=pack.case_id,
                dispute_id=pack.dispute_id,
                verdict=VerdictType.NEEDS_HUMAN,
                summary="Insufficient or unclear delivery inspection report. Queued for human manual review.",
                deterministic_checks=deterministic_results,
                failed_checks=[],
                regret_score=regret_score,
                is_regret_flagged=is_regret_flagged,
                llm_used=False,
                verdict_timestamp=int(time.time()),
            )

        # Semantic comparison: listing specs vs delivery report
        listing_specs = pack.merchant_listing or cart_attrs
        comparison_dict, llm_used = await self.llm_client.compare_listing_and_delivery(
            listing_specs=listing_specs,
            delivery_specs=pack.delivery_report,
        )

        semantic_res = SemanticComparisonResult(
            ports_match=comparison_dict.get("ports_match", "match"),
            hdmi_match=comparison_dict.get("hdmi_match", "match"),
            discrepancies=comparison_dict.get("discrepancies", []),
            is_mismatch=bool(comparison_dict.get("is_mismatch", False)),
            quote=comparison_dict.get("quote", ""),
            llm_used=llm_used,
            model=settings.LLM_MODEL if llm_used else "deterministic_fallback",
        )

        # Mismatch found: Merchant delivered goods contradicting the signed listing
        if semantic_res.is_mismatch:
            disc_str = "; ".join(semantic_res.discrepancies) or "Delivered merchandise deviates from listing"
            summary = (
                f"Merchant at fault: Physical delivery contradicts signed listing specifications. Details: {disc_str}"
            )
            return ArbiterVerdict(
                case_id=pack.case_id,
                dispute_id=pack.dispute_id,
                verdict=VerdictType.MERCHANT_AT_FAULT,
                summary=summary,
                deterministic_checks=deterministic_results,
                semantic_comparison=semantic_res,
                failed_checks=[],
                regret_score=regret_score,
                is_regret_flagged=is_regret_flagged,
                llm_used=llm_used,
                verdict_timestamp=int(time.time()),
            )

        # If no mismatch and regret threshold exceeded: WITHIN_MANDATE_REGRET
        if is_regret_flagged:
            best_t = (
                pack.candidate_trace.best_candidate.title
                if pack.candidate_trace and pack.candidate_trace.best_candidate
                else "better item"
            )
            summary = (
                f"Within mandate, but agent regret detected: Purchase complied with constraints, "
                f"but a significantly superior offer ('{best_t}') was bypassed (regret index {regret_score:.1%})."
            )
            return ArbiterVerdict(
                case_id=pack.case_id,
                dispute_id=pack.dispute_id,
                verdict=VerdictType.WITHIN_MANDATE_REGRET,
                summary=summary,
                deterministic_checks=deterministic_results,
                semantic_comparison=semantic_res,
                failed_checks=[],
                regret_score=regret_score,
                is_regret_flagged=True,
                llm_used=llm_used,
                verdict_timestamp=int(time.time()),
            )

        # All valid and no regret: NO_FAULT
        return ArbiterVerdict(
            case_id=pack.case_id,
            dispute_id=pack.dispute_id,
            verdict=VerdictType.NO_FAULT,
            summary="No fault detected: Merchant delivered exactly as listed, and mandate was executed faithfully.",
            deterministic_checks=deterministic_results,
            semantic_comparison=semantic_res,
            failed_checks=[],
            regret_score=regret_score,
            is_regret_flagged=False,
            llm_used=llm_used,
            verdict_timestamp=int(time.time()),
        )
