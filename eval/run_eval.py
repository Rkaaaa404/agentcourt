#!/usr/bin/env python3
"""Offline 15-Scenario Evaluation Harness for AgentCourt.

Executes all scenarios purely through the Arbiter without network calls.
Outputs structured metrics to eval/results.json and prints a GitHub-flavored Markdown table.
"""

import asyncio
import json
import sys
import time
from collections import defaultdict
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))
sys.path.insert(0, str(PROJECT_ROOT))

from agentcourt.arbiter import ArbiterEngine

from eval.scenarios import generate_evaluation_scenarios

RESULTS_FILE = Path(__file__).resolve().parent / "results.json"


async def run_evaluation() -> int:
    print("=" * 80)
    print("AgentCourt Offline Evaluation Harness (15 Scenarios)")
    print("=" * 80)

    engine = ArbiterEngine()
    scenarios = generate_evaluation_scenarios()

    total = len(scenarios)
    passed = 0
    results_list = []
    class_stats = defaultdict(lambda: {"total": 0, "correct": 0})

    start_time = time.time()

    for sc in scenarios:
        sc_id = sc["id"]
        sc_name = sc["name"]
        expected = sc["expected_verdict"]
        pack = sc["pack"]

        verdict = await engine.adjudicate(pack)
        actual = verdict.verdict

        is_match = actual == expected
        if is_match:
            passed += 1

        class_stats[expected.value]["total"] += 1
        if is_match:
            class_stats[expected.value]["correct"] += 1

        results_list.append(
            {
                "id": sc_id,
                "name": sc_name,
                "category": sc.get("category", "General"),
                "expected": expected.value,
                "actual": actual.value,
                "passed": is_match,
                "failed_checks": verdict.failed_checks,
                "regret_score": verdict.regret_score,
                "llm_used": verdict.llm_used,
                "summary": verdict.summary,
            }
        )

    elapsed_ms = round((time.time() - start_time) * 1000, 2)
    accuracy = round((passed / total) * 100, 1)

    # Class breakdown
    breakdown = {}
    for cls_name, stat in class_stats.items():
        pct = round((stat["correct"] / stat["total"]) * 100, 1) if stat["total"] > 0 else 0.0
        breakdown[cls_name] = {
            "correct": stat["correct"],
            "total": stat["total"],
            "accuracy_pct": pct,
        }

    output_payload = {
        "timestamp": int(time.time()),
        "total_scenarios": total,
        "passed_scenarios": passed,
        "failed_scenarios": total - passed,
        "accuracy_pct": accuracy,
        "elapsed_ms": elapsed_ms,
        "class_breakdown": breakdown,
        "results": results_list,
    }

    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, indent=2)

    # Print GitHub Flavored Markdown Table
    print("\n### Evaluation Results Table\n")
    print("| ID | Scenario | Category | Expected Verdict | Actual Verdict | Status |")
    print("|:---|:---|:---|:---|:---|:---:|")
    for r in results_list:
        status_icon = "PASS" if r["passed"] else "FAIL"
        print(
            f"| `{r['id'][:15]}` | {r['name']} | {r['category']} | `{r['expected']}` | `{r['actual']}` | **{status_icon}** |"
        )

    print("\n### Verdict Class Accuracy Breakdown\n")
    print("| Verdict Class | Correct / Total | Accuracy |")
    print("|:---|:---:|:---:|")
    for cls_name, b in breakdown.items():
        print(f"| `{cls_name}` | {b['correct']} / {b['total']} | **{b['accuracy_pct']}%** |")

    print(f"\n[SUMMARY] {passed}/{total} scenarios passed ({accuracy}%) in {elapsed_ms}ms.")
    print(f"Results recorded to: {RESULTS_FILE}\n")

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(run_evaluation()))
