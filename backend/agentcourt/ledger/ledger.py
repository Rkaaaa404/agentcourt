"""Append-only cryptographic event log with hash chaining and tamper detection."""

import json
import sqlite3
import threading
from pathlib import Path
from typing import Any, Optional

from agentcourt.config import settings
from agentcourt.ledger.models import GENESIS_PREV_HASH, LedgerEntry, LedgerEventType


class AppendOnlyLedger:
    """Thread-safe append-only ledger backed by in-memory list and optional SQLite store."""

    def __init__(self, db_path: Optional[str] = None):
        self._db_path = db_path
        self._entries: list[LedgerEntry] = []
        self._lock = threading.Lock()

        if self._db_path:
            self._init_sqlite()
            self._load_from_sqlite()

    def _init_sqlite(self) -> None:
        """Create sqlite table if needed."""
        if not self._db_path:
            return
        Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self._db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS ledger_entries (
                    entry_index INTEGER PRIMARY KEY,
                    timestamp INTEGER NOT NULL,
                    event_type TEXT NOT NULL,
                    case_id TEXT,
                    payload TEXT NOT NULL,
                    prev_hash TEXT NOT NULL,
                    entry_hash TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def _load_from_sqlite(self) -> None:
        """Load stored entries into memory."""
        if not self._db_path:
            return
        with sqlite3.connect(self._db_path) as conn:
            cursor = conn.execute(
                "SELECT entry_index, timestamp, event_type, case_id, payload, prev_hash, entry_hash "
                "FROM ledger_entries ORDER BY entry_index ASC"
            )
            rows = cursor.fetchall()
            for r in rows:
                entry = LedgerEntry(
                    index=r[0],
                    timestamp=r[1],
                    event_type=r[2],
                    case_id=r[3],
                    payload=json.loads(r[4]),
                    prev_hash=r[5],
                    entry_hash=r[6],
                )
                self._entries.append(entry)

    def append(
        self,
        event_type: str | LedgerEventType,
        payload: dict[str, Any],
        case_id: Optional[str] = None,
        timestamp: Optional[int] = None,
    ) -> LedgerEntry:
        """Append a new cryptographic event to the ledger."""
        ev_type = event_type.value if isinstance(event_type, LedgerEventType) else str(event_type)

        with self._lock:
            index = len(self._entries)
            prev_hash = self._entries[-1].entry_hash if index > 0 else GENESIS_PREV_HASH

            entry = LedgerEntry(
                index=index,
                timestamp=timestamp or entry_timestamp(),
                event_type=ev_type,
                case_id=case_id,
                payload=payload,
                prev_hash=prev_hash,
            )
            entry.entry_hash = entry.compute_hash()

            self._entries.append(entry)

            if self._db_path:
                with sqlite3.connect(self._db_path) as conn:
                    conn.execute(
                        "INSERT INTO ledger_entries (entry_index, timestamp, event_type, case_id, payload, prev_hash, entry_hash) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (
                            entry.index,
                            entry.timestamp,
                            entry.event_type,
                            entry.case_id,
                            json.dumps(entry.payload),
                            entry.prev_hash,
                            entry.entry_hash,
                        ),
                    )
                    conn.commit()

            return entry

    def get_entries(self, case_id: Optional[str] = None) -> list[LedgerEntry]:
        """Return a copy of the ledger entries, optionally filtered by case_id."""
        with self._lock:
            if case_id is None:
                return list(self._entries)
            return [e for e in self._entries if e.case_id == case_id]

    def count(self) -> int:
        """Return total number of entries in ledger."""
        with self._lock:
            return len(self._entries)

    def verify_integrity(self) -> tuple[bool, Optional[str]]:
        """Verify cryptographic hash chaining across all ledger entries.

        Returns (True, None) if completely intact, or (False, error_reason) if tampered.
        """
        with self._lock:
            for i, entry in enumerate(self._entries):
                # 1. Check hash correctness
                expected_hash = entry.compute_hash()
                if entry.entry_hash != expected_hash:
                    return (
                        False,
                        f"Tamper detected at index {i}: recorded entry_hash {entry.entry_hash} does not match computed hash {expected_hash}",
                    )

                # 2. Check previous hash link
                if i == 0:
                    if entry.prev_hash != GENESIS_PREV_HASH:
                        return (
                            False,
                            f"Genesis entry index 0 invalid prev_hash: expected {GENESIS_PREV_HASH}, found {entry.prev_hash}",
                        )
                else:
                    prev_entry = self._entries[i - 1]
                    if entry.prev_hash != prev_entry.entry_hash:
                        return (
                            False,
                            f"Broken chain at index {i}: prev_hash {entry.prev_hash} does not link to previous entry hash {prev_entry.entry_hash}",
                        )

            return True, None


def entry_timestamp() -> int:
    import time

    return int(time.time())


# Global shared ledger instance
default_ledger = AppendOnlyLedger(db_path=settings.LEDGER_DB_PATH)
