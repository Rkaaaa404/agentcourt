"""Shopping agent package providing catalog search, candidate scoring, and purchase orchestration."""

from agentcourt.agent.catalog import CatalogItem, Merchant, get_all_catalog_items, load_merchants
from agentcourt.agent.llm import BaseLLMClient, DeterministicFallbackClient, get_llm_client
from agentcourt.agent.scoring import (
    CandidateTrace,
    CandidateTraceEntry,
    SelectionPolicy,
    calculate_utility,
    evaluate_catalog_and_select,
)
from agentcourt.agent.shopper import PurchaseResult, ShoppingAgent

__all__ = [
    "BaseLLMClient",
    "CandidateTrace",
    "CandidateTraceEntry",
    "CatalogItem",
    "DeterministicFallbackClient",
    "Merchant",
    "PurchaseResult",
    "SelectionPolicy",
    "ShoppingAgent",
    "calculate_utility",
    "evaluate_catalog_and_select",
    "get_all_catalog_items",
    "get_llm_client",
    "load_merchants",
]
