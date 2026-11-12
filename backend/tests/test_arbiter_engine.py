"""Unit tests for ArbiterEngine adjudication logic."""

import pytest
from veripact.arbiter import ArbiterEngine, VerdictType

from eval.scenarios import generate_evaluation_scenarios


@pytest.mark.asyncio
async def test_arbiter_all_scenarios():
    engine = ArbiterEngine()
    scenarios = generate_evaluation_scenarios()

    for sc in scenarios:
        verdict = await engine.adjudicate(sc["pack"])
        assert verdict.verdict == sc["expected_verdict"], f"Failed on {sc['id']}"


@pytest.mark.asyncio
async def test_prompt_injection_shield():
    """Ensure prompt injection text does not trick arbiter into altering verdict."""
    engine = ArbiterEngine()
    scenarios = generate_evaluation_scenarios()
    injection_sc = next(s for s in scenarios if s["id"] == "SCENARIO_13_PROMPT_INJECTION_DEFENSE")

    verdict = await engine.adjudicate(injection_sc["pack"])
    assert verdict.verdict == VerdictType.NO_FAULT
    assert verdict.all_deterministic_passed() is True
