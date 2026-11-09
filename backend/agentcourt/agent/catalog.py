"""Catalog loader and models for simulated merchant items."""

import json
from decimal import Decimal
from pathlib import Path
from typing import Any, Optional

from pydantic import BaseModel, Field

DATA_FILE = Path(__file__).resolve().parent.parent.parent.parent / "data" / "merchants.json"


class CatalogItem(BaseModel):
    """An offer listed in a merchant's catalog."""

    id: str
    merchant_id: str
    merchant_name: str
    merchant_rating: float
    title: str
    price: Decimal
    currency: str = "USD"
    ports_count: int
    has_hdmi_4k: bool
    power_delivery_watts: int = 0
    ethernet_speed_mbps: int = 0
    features: list[str] = Field(default_factory=list)
    description: str = ""

    def to_spec_dict(self) -> dict[str, Any]:
        """Convert to specification dictionary for evidence comparison."""
        return {
            "item_id": self.id,
            "merchant_id": self.merchant_id,
            "title": self.title,
            "price": f"{self.price:.2f}",
            "ports_count": self.ports_count,
            "has_hdmi_4k": self.has_hdmi_4k,
            "power_delivery_watts": self.power_delivery_watts,
            "ethernet_speed_mbps": self.ethernet_speed_mbps,
            "features": self.features,
            "description": self.description,
        }


class Merchant(BaseModel):
    """Simulated merchant profile."""

    id: str
    name: str
    rating: float
    verified: bool = True
    items: list[CatalogItem] = Field(default_factory=list)


def load_merchants(filepath: Optional[Path] = None) -> list[Merchant]:
    """Load merchant catalog from JSON file."""
    path = filepath or DATA_FILE
    if not path.exists():
        raise FileNotFoundError(f"Merchant catalog file not found at {path}")

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    merchants = []
    for m in data.get("merchants", []):
        items = []
        for it in m.get("items", []):
            item = CatalogItem(
                id=it["id"],
                merchant_id=m["id"],
                merchant_name=m["name"],
                merchant_rating=float(m.get("rating", 4.0)),
                title=it["title"],
                price=Decimal(str(it["price"])),
                currency=it.get("currency", "USD"),
                ports_count=int(it.get("ports_count", 0)),
                has_hdmi_4k=bool(it.get("has_hdmi_4k", False)),
                power_delivery_watts=int(it.get("power_delivery_watts", 0)),
                ethernet_speed_mbps=int(it.get("ethernet_speed_mbps", 0)),
                features=it.get("features", []),
                description=it.get("description", ""),
            )
            items.append(item)

        merchants.append(
            Merchant(
                id=m["id"],
                name=m["name"],
                rating=float(m.get("rating", 4.0)),
                verified=bool(m.get("verified", True)),
                items=items,
            )
        )

    return merchants


def get_all_catalog_items(filepath: Optional[Path] = None) -> list[CatalogItem]:
    """Return flat list of all catalog items across all merchants."""
    merchants = load_merchants(filepath)
    all_items = []
    for m in merchants:
        all_items.extend(m.items)
    return all_items
