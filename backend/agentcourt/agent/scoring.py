"""Deterministic scoring, utility function, candidate trace recording, and regret computation."""

from decimal import Decimal
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from agentcourt.agent.catalog import CatalogItem
from agentcourt.mandate.models import UserConstraints


class SelectionPolicy(str, Enum):
    OPTIMAL = "OPTIMAL"
    FIRST_ACCEPTABLE = "FIRST_ACCEPTABLE"


class CandidateTraceEntry(BaseModel):
    """Evaluation record of a single catalog offer considered by the agent."""

    item_id: str
    merchant_id: str
    merchant_name: str
    title: str
    price: Decimal
    ports_count: int
    has_hdmi_4k: bool
    satisfies_constraints: bool
    rejection_reasons: list[str] = Field(default_factory=list)
    utility_score: float = 0.0
    sub_scores: dict[str, float] = Field(default_factory=dict)


class CandidateTrace(BaseModel):
    """Full decision trace of all candidates evaluated for an intent."""

    evaluated_candidates: list[CandidateTraceEntry] = Field(default_factory=list)
    chosen_candidate: Optional[CandidateTraceEntry] = None
    best_candidate: Optional[CandidateTraceEntry] = None
    regret_score: float = 0.0
    is_regret_flagged: bool = False
    policy_applied: SelectionPolicy = SelectionPolicy.OPTIMAL


def calculate_utility(
    item: CatalogItem, constraints: UserConstraints
) -> tuple[float, bool, list[str], dict[str, float]]:
    """Deterministic utility calculation.

    Returns (total_utility, satisfies_constraints, rejection_reasons, sub_scores).
    """
    rejections = []

    # 1. Mandatory constraint checks
    if item.price > constraints.max_spend:
        rejections.append(f"Price ${item.price:.2f} exceeds spend cap ${constraints.max_spend:.2f}")

    if item.ports_count < constraints.min_ports:
        rejections.append(f"Ports count ({item.ports_count}) is below minimum requirement ({constraints.min_ports})")

    if constraints.has_hdmi_4k and not item.has_hdmi_4k:
        rejections.append("Missing required 4K HDMI capability")

    if constraints.allowed_merchants and item.merchant_id not in constraints.allowed_merchants:
        rejections.append(f"Merchant '{item.merchant_id}' is not in allowed list")

    satisfies = len(rejections) == 0
    if not satisfies:
        return 0.0, False, rejections, {}

    # 2. Continuous utility sub-scores (0.0 to 1.0)
    budget = float(constraints.max_spend)
    price = float(item.price)

    # Price efficiency: higher utility for lower price within budget
    # Max score 1.0 if price is 0, score 0.2 if price == budget
    u_price = max(0.0, min(1.0, 1.0 - (price / (budget * 1.25))))

    # Ports score: capped at 10 ports
    u_ports = min(1.0, item.ports_count / 10.0)

    # Merchant reputation
    u_rating = min(1.0, item.merchant_rating / 5.0)

    # Power delivery capacity
    u_pd = min(1.0, item.power_delivery_watts / 100.0)

    sub_scores = {
        "price_efficiency": round(u_price, 4),
        "ports_score": round(u_ports, 4),
        "reputation_score": round(u_rating, 4),
        "power_delivery_score": round(u_pd, 4),
    }

    # Total weighted utility
    total_utility = 0.40 * u_price + 0.30 * u_ports + 0.15 * u_rating + 0.15 * u_pd

    return round(total_utility, 4), True, [], sub_scores


def evaluate_catalog_and_select(
    items: list[CatalogItem],
    constraints: UserConstraints,
    policy: SelectionPolicy = SelectionPolicy.OPTIMAL,
    regret_threshold: float = 0.15,
) -> tuple[Optional[CatalogItem], CandidateTrace]:
    """Score all offers in the catalog, record candidate trace, and select offer according to policy."""
    trace_entries: list[CandidateTraceEntry] = []
    satisfying_items: list[tuple[CatalogItem, CandidateTraceEntry]] = []

    for it in items:
        utility, satisfies, rejections, sub_scores = calculate_utility(it, constraints)
        entry = CandidateTraceEntry(
            item_id=it.id,
            merchant_id=it.merchant_id,
            merchant_name=it.merchant_name,
            title=it.title,
            price=it.price,
            ports_count=it.ports_count,
            has_hdmi_4k=it.has_hdmi_4k,
            satisfies_constraints=satisfies,
            rejection_reasons=rejections,
            utility_score=utility,
            sub_scores=sub_scores,
        )
        trace_entries.append(entry)
        if satisfies:
            satisfying_items.append((it, entry))

    if not satisfying_items:
        return None, CandidateTrace(
            evaluated_candidates=trace_entries,
            policy_applied=policy,
        )

    # Determine best item by maximum utility
    best_item, best_entry = max(satisfying_items, key=lambda pair: pair[1].utility_score)

    # Select item based on active policy
    if policy == SelectionPolicy.FIRST_ACCEPTABLE:
        # Deliberately pick the first candidate meeting requirements to simulate suboptimal behavior
        chosen_item, chosen_entry = satisfying_items[0]
    else:
        # Optimal selection
        chosen_item, chosen_entry = best_item, best_entry

    # Calculate agent regret: (U_best - U_chosen) / U_best
    regret = 0.0
    if best_entry.utility_score > 0:
        regret = (best_entry.utility_score - chosen_entry.utility_score) / best_entry.utility_score
        regret = max(0.0, round(regret, 4))

    is_regret_flagged = regret > regret_threshold

    candidate_trace = CandidateTrace(
        evaluated_candidates=trace_entries,
        chosen_candidate=chosen_entry,
        best_candidate=best_entry,
        regret_score=regret,
        is_regret_flagged=is_regret_flagged,
        policy_applied=policy,
    )

    return chosen_item, candidate_trace
