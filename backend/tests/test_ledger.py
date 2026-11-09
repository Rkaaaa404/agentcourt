"""Tests for append-only hash-chained ledger and tamper verification."""

from agentcourt.ledger import GENESIS_PREV_HASH, AppendOnlyLedger, LedgerEventType


def test_ledger_append_and_integrity():
    ledger = AppendOnlyLedger()

    e0 = ledger.append(
        event_type=LedgerEventType.INTENT_MANDATE_CREATED,
        payload={"intent_id": "im_1", "spend_cap": "120.00"},
        case_id="case_1",
    )
    assert e0.index == 0
    assert e0.prev_hash == GENESIS_PREV_HASH
    assert len(e0.entry_hash) == 64

    e1 = ledger.append(
        event_type=LedgerEventType.CART_MANDATE_CREATED,
        payload={"cart_id": "cm_1", "amount": "89.00"},
        case_id="case_1",
    )
    assert e1.index == 1
    assert e1.prev_hash == e0.entry_hash

    is_intact, err = ledger.verify_integrity()
    assert is_intact is True
    assert err is None


def test_ledger_tamper_detection():
    ledger = AppendOnlyLedger()
    ledger.append("EVENT_0", {"val": 100})
    ledger.append("EVENT_1", {"val": 200})
    ledger.append("EVENT_2", {"val": 300})

    is_valid, _ = ledger.verify_integrity()
    assert is_valid is True

    # Tamper with internal payload of entry index 1
    ledger._entries[1].payload["val"] = 999999

    is_valid_after_tamper, err_msg = ledger.verify_integrity()
    assert is_valid_after_tamper is False
    assert "Tamper detected at index 1" in str(err_msg)


def test_ledger_filter_by_case_id():
    ledger = AppendOnlyLedger()
    ledger.append("EVENT_A", {}, case_id="case_alpha")
    ledger.append("EVENT_B", {}, case_id="case_beta")
    ledger.append("EVENT_C", {}, case_id="case_alpha")

    alpha_entries = ledger.get_entries(case_id="case_alpha")
    assert len(alpha_entries) == 2
    assert [e.event_type for e in alpha_entries] == ["EVENT_A", "EVENT_C"]
