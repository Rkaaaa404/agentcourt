#!/usr/bin/env python3
"""Offline evaluation harness placeholder for AgentCourt."""

import json
from pathlib import Path

RESULTS_FILE = Path(__file__).resolve().parent / "results.json"


def main():
    print("=" * 60)
    print("AgentCourt Offline Evaluation Harness (Phase 0 Skeleton)")
    print("=" * 60)
    data = {
        "status": "ready",
        "phase": 0,
        "scenarios_tested": 0,
        "note": "Full 12-scenario suite activates in Phase 2",
    }
    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print("Placeholder results written to", RESULTS_FILE)
    return 0


if __name__ == "__main__":
    main()
