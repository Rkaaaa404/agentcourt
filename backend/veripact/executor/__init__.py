"""Executor package providing planned action synthesis and human-approved execution."""

from veripact.executor.executor import ActionExecutor, ExecutionError
from veripact.executor.planner import (
    PlannedActionType,
    PlannedPayPalAction,
    is_action_permitted,
    plan_action_for_verdict,
)

__all__ = [
    "ActionExecutor",
    "ExecutionError",
    "PlannedActionType",
    "PlannedPayPalAction",
    "is_action_permitted",
    "plan_action_for_verdict",
]

