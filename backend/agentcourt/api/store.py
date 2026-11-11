"""Lightweight SQLite persistence for AgentCourt cases, orders/mandates, and webhook deduplication."""

import json
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any, Optional

from agentcourt.config import settings


def _resolve_db_path() -> Path:
    url = settings.DATABASE_URL
    if url.startswith("sqlite:///"):
        raw_path = url.removeprefix("sqlite:///")
    else:
        raw_path = "./agentcourt.db"
    path = Path(raw_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


class StateStore:
    """Thread-safe SQLite store for cases, purchase sessions, and webhook event IDs."""

    def __init__(self, db_path: Optional[Path] = None):
        self._db_path = db_path or _resolve_db_path()
        self._lock = threading.Lock()
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(str(self._db_path))

    def _init_db(self) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS cases_state (
                    case_id TEXT PRIMARY KEY,
                    dispute_id TEXT NOT NULL,
                    record_json TEXT NOT NULL,
                    updated_at INTEGER NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS purchases_state (
                    order_id TEXT PRIMARY KEY,
                    custom_id TEXT,
                    capture_id TEXT,
                    status TEXT NOT NULL,
                    purchase_json TEXT NOT NULL,
                    updated_at INTEGER NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS webhook_events (
                    event_id TEXT PRIMARY KEY,
                    event_type TEXT NOT NULL,
                    verified INTEGER NOT NULL,
                    received_at INTEGER NOT NULL
                )
                """
            )
            conn.commit()

    # -------------------------------------------------------------------------
    # Cases
    # -------------------------------------------------------------------------

    def save_case(self, case_id: str, dispute_id: str, record_dict: dict[str, Any]) -> None:
        now = int(time.time())
        payload = json.dumps(record_dict, default=str)
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO cases_state (case_id, dispute_id, record_json, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(case_id) DO UPDATE SET
                    dispute_id = excluded.dispute_id,
                    record_json = excluded.record_json,
                    updated_at = excluded.updated_at
                """,
                (case_id, dispute_id, payload, now),
            )
            conn.commit()

    def load_all_cases(self) -> list[dict[str, Any]]:
        with self._lock, self._connect() as conn:
            rows = conn.execute("SELECT record_json FROM cases_state ORDER BY updated_at ASC").fetchall()
        return [json.loads(row[0]) for row in rows]

    # -------------------------------------------------------------------------
    # Purchases (Orders + Signed Mandates)
    # -------------------------------------------------------------------------

    def save_purchase(
        self,
        order_id: str,
        purchase_dict: dict[str, Any],
        *,
        custom_id: Optional[str] = None,
        capture_id: Optional[str] = None,
        status: str = "CREATED",
    ) -> None:
        now = int(time.time())
        payload = json.dumps(purchase_dict, default=str)
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO purchases_state (order_id, custom_id, capture_id, status, purchase_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(order_id) DO UPDATE SET
                    custom_id = COALESCE(excluded.custom_id, purchases_state.custom_id),
                    capture_id = COALESCE(excluded.capture_id, purchases_state.capture_id),
                    status = excluded.status,
                    purchase_json = excluded.purchase_json,
                    updated_at = excluded.updated_at
                """,
                (order_id, custom_id, capture_id, status, payload, now),
            )
            conn.commit()

    def get_purchase(self, order_id: str) -> Optional[dict[str, Any]]:
        with self._lock, self._connect() as conn:
            row = conn.execute(
                "SELECT purchase_json, capture_id, status, custom_id FROM purchases_state WHERE order_id = ?",
                (order_id,),
            ).fetchone()
        if not row:
            return None
        data = json.loads(row[0])
        if row[1]:
            data["capture_id"] = row[1]
        data["status"] = row[2]
        if row[3]:
            data["custom_id"] = row[3]
        return data

    def find_purchase_by_custom_id(self, custom_id: str) -> Optional[dict[str, Any]]:
        if not custom_id:
            return None
        with self._lock, self._connect() as conn:
            row = conn.execute(
                "SELECT purchase_json, capture_id, status, custom_id FROM purchases_state WHERE custom_id = ?",
                (custom_id,),
            ).fetchone()
        if not row:
            return None
        data = json.loads(row[0])
        if row[1]:
            data["capture_id"] = row[1]
        data["status"] = row[2]
        if row[3]:
            data["custom_id"] = row[3]
        return data

    # -------------------------------------------------------------------------
    # Webhook Deduplication
    # -------------------------------------------------------------------------

    def record_webhook_event(self, event_id: str, event_type: str, verified: bool) -> bool:
        """Record a webhook event ID. Returns True if newly recorded, False if duplicate."""
        if not event_id:
            return True
        now = int(time.time())
        with self._lock, self._connect() as conn:
            cur = conn.execute(
                """
                INSERT OR IGNORE INTO webhook_events (event_id, event_type, verified, received_at)
                VALUES (?, ?, ?, ?)
                """,
                (event_id, event_type, 1 if verified else 0, now),
            )
            conn.commit()
            return cur.rowcount > 0


default_store = StateStore()

