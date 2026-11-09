"""Tests for merchant catalog loading, utility scoring, and candidate trace."""

from decimal import Decimal

from agentcourt.agent.catalog import get_all_catalog_items, load_merchants
from agentcourt.agent.scoring import (
    SelectionPolicy,
    calculate_utility,
    evaluate_catalog_and_select,
)
from agentcourt.mandate.models import UserConstraints


def test_catalog_load():
    merchants = load_merchants()
    assert len(merchants) >= 4
    items = get_all_catalog_items()
    assert len(items) >= 4


def test_utility_constraint_violations():
    items = get_all_catalog_items()
    dockcraft_slim = next(i for i in items if i.id == "item-dc-102")

    constraints = UserConstraints(min_ports=8, max_spend=Decimal("120.00"))
    score, satisfies, rejections, _ = calculate_utility(dockcraft_slim, constraints)

    assert score == 0.0
    assert satisfies is False
    assert any("Ports count (6) is below minimum" in r for r in rejections)


def test_optimal_selection_policy():
    items = get_all_catalog_items()
    constraints = UserConstraints(
        min_ports=8,
        has_hdmi_4k=True,
        max_spend=Decimal("120.00"),
    )

    chosen, trace = evaluate_catalog_and_select(
        items=items,
        constraints=constraints,
        policy=SelectionPolicy.OPTIMAL,
    )

    assert chosen is not None
    assert chosen.id == "item-dc-101"  # DockCraft Pro 10-in-1 is highest utility
    assert trace.regret_score == 0.0
    assert trace.is_regret_flagged is False


def test_first_acceptable_policy_triggers_regret():
    items = get_all_catalog_items()
    # Rearrange items so an inferior satisfying item (Nexus 8-Port at $115) comes before DockCraft Pro at $89
    nexus_item = next(i for i in items if i.id == "item-ng-201")
    other_items = [i for i in items if i.id != "item-ng-201"]
    ordered_items = [nexus_item] + other_items

    constraints = UserConstraints(
        min_ports=8,
        has_hdmi_4k=True,
        max_spend=Decimal("120.00"),
    )

    chosen, trace = evaluate_catalog_and_select(
        items=ordered_items,
        constraints=constraints,
        policy=SelectionPolicy.FIRST_ACCEPTABLE,
        regret_threshold=0.15,
    )

    assert chosen is not None
    assert chosen.id == "item-ng-201"  # Picked first acceptable
    assert trace.best_candidate is not None
    assert trace.best_candidate.item_id == "item-dc-101"  # But best was DockCraft Pro!
    assert trace.regret_score > 0.15
    assert trace.is_regret_flagged is True
