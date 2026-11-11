# Limitations & Threat Model

AgentCourt is an open-source proof-of-concept built for the **PayPal AI Hackathon 2026**. This document outlines known boundaries, security scope, and system limitations.

---

## 1. PayPal Sandbox Scope

- **Sandbox Only**: All PayPal integrations (Orders v2, Disputes API, Webhooks, and simulated buyer assertions) are hard-coded to `https://api-m.sandbox.paypal.com`. Real money is never handled.
- **Dispute Categories**: The PayPal Disputes API natively classifies disputes under categories such as `MERCHANDISE_OR_SERVICE_NOT_RECEIVED` (INR) and `MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED` (SNAD). There is currently no native PayPal dispute category for "Agent Hallucination" or "Suboptimal Choice / Agent Regret". AgentCourt handles these off-chain within its cryptographic ledger and maps them to PayPal's evidence submission (`provide-evidence`) or settlement flows (`accept-claim`, `make-offer`).
- **Operator Liability Settlement**: The PayPal API does not have an automated mechanism to directly debit an AI agent operator's wallet or credit line for off-mandate violations (`OPERATOR_AT_FAULT`). AgentCourt logs the liability entry into its append-only ledger and arms the merchant with a complete defense evidence pack to prevent merchant-side loss at PayPal adjudication.

---

## 2. Simulated Environment Components

- **Merchant Catalog**: The product catalog (`data/merchants.json`) is simulated with fictional merchants selling USB-C docking stations to provide predictable, repeatable test vectors.
- **Delivery Reports**: Warehouse intake and buyer delivery reports are simulated test fixtures representing physical goods inspection.
- **Buyer Disputes**: The sandbox environment lacks actual human buyers initiating disputes from mobile apps. The buyer simulator utilizes PayPal's documented unsigned JWT `PayPal-Auth-Assertion` header to programmatically trigger buyer disputes for testing.

---

## 3. Production Readiness & Security Disclaimer

- **Not Production Software**: This codebase has not undergone independent third-party cryptographic or cybersecurity audits and should not be used in production without formal review.
- **Ephemeral Storage on Render Free Tier**: Both local and default Render Blueprint (`plan: free`) deployments use SQLite (`DATABASE_URL` and `LEDGER_DB_PATH`). On Render's Free Tier, persistent data resets upon container recycling/sleep; `ensure_seeded_if_empty()` and `scripts/seed_demo.py` automatically repopulate the 3 flagship demo scenarios on startup.
- **Human-in-the-Loop Safeguard**: Autonomous agents and LLM classifiers are never permitted to unilaterally execute PayPal dispute settlement calls. Every state-altering call requires explicit human confirmation via the UI.
