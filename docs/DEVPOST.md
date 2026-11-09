# Devpost Submission — AgentCourt

> **Tagline:** *AP2 tells you what was authorized. AgentCourt tells you who pays when it goes wrong.*

---

## 1. Inspiration

The promise of autonomous agentic commerce is compelling: AI agents finding, negotiating, and purchasing goods on behalf of consumers. Emerging frameworks—such as Google's Agent Payment Protocol (AP2) and mandate specifications—have pioneered how a user authorizes an agent before checkout.

However, the industry faces an unaddressed question: **What happens after payment when an autonomous purchase goes wrong?**

When a buyer opens a PayPal dispute on an agent-initiated order—because the delivered docking station had 6 ports instead of 10, or because price drift occurred, or because the agent accepted a suboptimal offer—current dispute resolution requires slow human investigation. Merchants risk unmerited chargebacks; agent platforms face existential liability; and buyers lose trust.

We built **AgentCourt** to be the missing post-payment liability resolution layer for the agent economy.

---

## 2. What It Does

AgentCourt links pre-payment mandates to post-payment PayPal Disputes through cryptographic audit trails, deterministic verification, and bounded AI adjudication:

1. **AP2-Inspired Cryptographic Mandates**:
   - The user signs an Ed25519 **Intent Mandate** specifying constraints (ports >= 8, max price $120, allowed merchants).
   - The shopping agent evaluates real merchants, selects an offer, and generates a **Cart Mandate** cryptographically linked to the Intent Mandate hash.
   - Upon creating an order via **PayPal Orders v2**, AgentCourt binds `order_binding = sha256(intent_hash || cart_hash || paypal_order_id)` and records it into PayPal's `purchase_units[0].custom_id`.

2. **Automated Evidence Pack Assembly & Deterministic Arbiter**:
   - When a PayPal dispute arrives via Webhooks (`CUSTOMER.DISPUTE.CREATED`), AgentCourt aggregates the Intent Mandate, Cart Mandate, Merchant Listing, Delivery Inspection, and PayPal Order data.
   - Seven deterministic rules (**C1–C7**) verify mandate integrity, signature authenticity, time validity, order binding, spend caps, and merchant authorization.
   - **Deterministic Supremacy**: If *any* deterministic check fails, the verdict is immediately `OPERATOR_AT_FAULT`. An LLM can never override a rule failure.

3. **Autonomous Agent Regret Attribution**:
   - Evaluates whether the shopping agent used an `OPTIMAL` policy or settled for a `FIRST_ACCEPTABLE` offer.
   - If relative utility regret exceeds the threshold (> 15%), AgentCourt flags `WITHIN_MANDATE_REGRET` and plans a proportional goodwill offer rather than blaming the merchant.

4. **Human-in-the-Loop PayPal Dispute Execution**:
   - Based on the verdict, AgentCourt plans an actionable PayPal Dispute step:
     - `MERCHANT_AT_FAULT` -> `accept-claim` (full refund) or `provide-evidence`.
     - `OPERATOR_AT_FAULT` -> `accept-claim` (operator-funded refund).
     - `WITHIN_MANDATE_REGRET` -> `make-offer` (goodwill partial refund / credit).
   - Requires explicit human approval before invoking PayPal's sandbox Disputes API. Every action is sealed into a tamper-evident cryptographic event ledger.

5. **Bryntum Scheduler Timeline Visualizer**:
   - Visualizes the multi-day dispute lifecycle (dispute opened, evidence due date, response submitted, adjudication) across parallel case lanes with color-coded verdict badges.

---

## 3. How We Built It

- **Backend**: Python 3.12/3.13 + **FastAPI**.
- **PayPal Integration**:
  - Direct integration with **PayPal Sandbox** (`https://api-m.sandbox.paypal.com`):
  - Orders v2 (`POST /v2/checkout/orders`, `POST /v2/checkout/orders/{id}/capture`, `PATCH /v2/checkout/orders/{id}`).
  - Customer Disputes API (`POST /v1/customer/disputes` with unsigned JWT `PayPal-Auth-Assertion`, `GET /v1/customer/disputes/{id}`, `change-reason`, `accept-claim`, `make-offer`, `provide-evidence`, and sandbox-only simulation endpoints).
  - Webhooks signature verification (`POST /v1/notifications/verify-webhook-signature`).
- **Cryptography & Ledger**:
  - RFC 8785 Canonical JSON hashing (`hashlib.sha256`).
  - Ed25519 digital signatures via `cryptography`.
  - Append-only cryptographic ledger with SHA-256 hash chains.
- **AI & Arbiter**:
  - Pluggable LLM layer (Claude 3.5 Sonnet / OpenAI GPT-4o / Deterministic Fallback).
  - Strict JSON schema enforcement and prompt-injection shielding.
- **Frontend Dashboard**:
  - React 18, Vite, TypeScript, Tailwind CSS, Lucide icons.
  - **Bryntum Scheduler** trial package (`@bryntum/scheduler` / `@bryntum/scheduler-react`) for high-performance interactive dispute timeline scheduling.
- **Deployment**:
  - Multi-stage Docker container deployed on **Render**.

---

## 4. Challenges We Ran Into

1. **PayPal Auth Assertion in Sandbox**:
   Creating disputes programmatically from the buyer side in the PayPal sandbox requires an unsigned JWT assertion header (`PayPal-Auth-Assertion`) with `"alg": "none"` and a trailing dot (`header.payload.`). Correctly constructing and formatting this assertion allowed automated dispute simulation.
2. **Order Binding in Orders v2**:
   Ensuring an agent's pre-signed mandate cannot be replayed onto a foreign order required computing `sha256(intent_hash || cart_hash || order_id)`. We successfully utilized PayPal's `purchase_units[0].custom_id` field to persist this 64-character hash.
3. **Deterministic AI Safety**:
   Preventing prompt injections in merchant product listings from hijacking dispute verdicts required isolating language analysis to leaf attribute comparisons with strict schema validation, guarded by pre-execution deterministic assertions.

---

## 5. Accomplishments That We're Proud Of

- **100% Pass Rate on 15-Scenario Evaluation Harness**: An automated offline test harness executing across 15 edge-case scenarios (tampered signatures, price drift, replay attacks, agent regret, prompt injections) verified in under 10ms.
- **Real PayPal API Integration**: Complete support for Orders v2, Customer Disputes, and Webhooks with graceful fallbacks.
- **Bryntum Scheduler Integration**: Smooth, professional timeline view mapping dispute deadlines and events.
- **Strict Human-in-the-Loop Safety**: No funds are moved without human review and cryptographic audit logging.

---

## 6. What We Learned

- Agentic commerce requires verifiable post-payment infrastructure; pre-authorization alone does not solve liability when real-world delivery fails.
- Deterministic guardrails must always supersede probabilistic LLMs when financial actions are on the line.

---

## 7. What's Next for AgentCourt

- Standardizing the `order_binding` custom attribute with the AP2 working group.
- Automated merchant settlement routing for merchant liability claims.
- Multi-party multi-agent mediation for complex supply chain disputes.

---

## 8. Built With

- Python 3.12 / FastAPI
- PayPal Orders v2 & Disputes API
- Bryntum Scheduler
- React / Vite / TypeScript / Tailwind CSS
- Ed25519 & RFC 8785 Canonical JSON
- Docker & Render
- Claude 3.5 Sonnet / OpenAI GPT-4o

