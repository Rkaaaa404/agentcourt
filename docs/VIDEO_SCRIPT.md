# AgentCourt Video Script (Under 3 Minutes)

**Target Duration:** ~2 minutes 40 seconds (Hard limit: 3:00)  
**Presenter:** [HUMAN]  
**Format:** Screen recording with voiceover narration and webcam picture-in-picture.

---

### **[0:00 - 0:25] ACT I: The Hook & The Problem**

**Visual:**
- Camera on presenter, then cut to slide showing an autonomous AI shopping agent buying a USB-C docking station.
- Display headline: *"AP2 tells you what was authorized. AgentCourt tells you who pays when it goes wrong."*

**Audio (Spoken):**
> "Autonomous shopping agents are finally here. With protocols like Google's AP2, users can authorize AI agents to buy products on their behalf. But what happens after payment when an order goes wrong?
>
> When a buyer opens a PayPal dispute because the delivered docking station had 6 ports instead of 10, or because price drift occurred—who is liable? The merchant? The agent operator? Or was it agent regret?
>
> Today, dispute resolution is slow, subjective, and costly. That's why we built **AgentCourt**: the post-payment liability resolution layer for autonomous agentic commerce."

---

### **[0:25 - 0:55] ACT II: The Architecture (Mandates to PayPal Order)**

**Visual:**
- Screen switch to AgentCourt UI: **Screen 1 (Agent Purchase & Mandate)** (`/purchase`).
- Show the shopping prompt: *"USB-C docking station, at least 8 ports, HDMI 4K output, max USD 120."*
- Click **Execute Shopping Agent**.
- Highlight the generated **Intent Mandate** (Ed25519 signature), the **Cart Mandate**, and the **PayPal Order Binding** (`custom_id`).

**Audio (Spoken):**
> "AgentCourt begins at checkout. When our agent shops, the user signs an Ed25519 Intent Mandate with hard constraints: price cap, port count, and authorized merchants.
>
> The agent selects an offer and generates a Cart Mandate. We then create a real PayPal Orders v2 transaction, binding the hash of both mandates directly into PayPal's `custom_id`. This prevents any replay attack or mandate tampering."

---

### **[0:55 - 1:35] ACT III: Dispute Arrival & The Bryntum Timeline**

**Visual:**
- Open the **Sandbox Buyer Simulator** modal.
- Simulate an incoming PayPal dispute (`CUSTOMER.DISPUTE.CREATED`) for an attribute mismatch (`MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED`).
- Switch to **Screen 2: Bryntum Timeline** (`/cases`).
- Hover over the timeline bars: Dispute Opened, Seller Response Due Date, Adjudication.
- Point out the color-coded verdict rows.

**Audio (Spoken):**
> "When a dispute arises, PayPal sends a webhook notification to AgentCourt.
>
> On our Dispute Timeline—powered by the **Bryntum Scheduler**—merchants and platforms get instant multi-case situational awareness. We see active disputes, filing deadlines, and response windows across parallel case lanes with clear status milestones."

---

### **[1:35 - 2:15] ACT IV: The Evidence Pack & Deterministic Arbiter**

**Visual:**
- Click on **Case S1 (Merchant Breach)** to open **Screen 3: Case Evidence Pack & Action Execution**.
- Pan across the 3-column view:
  - Column 1: Mandate & Order Binding.
  - Column 2: Merchant Listing vs. Warehouse Delivery Report (10 ports promised vs. 6 ports delivered).
  - Column 3: The 7 Deterministic Checks (C1 through C7) and Verdict badge: `MERCHANT_AT_FAULT`.
- Highlight the **Planned PayPal Action**: `accept-claim` (full refund) or `provide-evidence`.
- Click **Approve & Execute via PayPal Sandbox API**.
- Show the live PayPal response and the cryptographic Ledger entry.

**Audio (Spoken):**
> "Let's inspect the evidence pack. AgentCourt correlates the signed mandate, the merchant's listing, and the actual delivery inspection.
>
> Here, our Arbiter runs seven deterministic checks: cryptographic signature validity, spend caps, and merchant authorization. Deterministic rules are supreme: AI can never override a rule failure.
>
> In this case, the merchant delivered 6 ports instead of 10. The verdict is `MERCHANT_AT_FAULT`. AgentCourt plans an `accept-claim` refund action through the PayPal Disputes API. With one click, the operator approves, and the refund is executed in the PayPal sandbox and permanently recorded to our hash-chained audit ledger."

---

### **[2:15 - 2:40] ACT V: Evaluation Suite & Agent Regret**

**Visual:**
- Switch to **Screen 4: Evaluation Suite** (`/eval`).
- Show the 15/15 passed benchmark table (100% pass rate).
- Highlight Scenario 11: `WITHIN_MANDATE_REGRET` (agent selected a suboptimal offer with 28% regret).

**Audio (Spoken):**
> "AgentCourt also introduces an innovative concept: **Autonomous Agent Regret**. If an agent chooses a lazy, suboptimal offer when a far better deal was available, AgentCourt attributes liability to agent regret rather than penalizing the merchant, issuing a goodwill offer instead.
>
> Our comprehensive 15-scenario evaluation suite tests price drift, replayed mandates, prompt injections, and expired tokens with 100% accuracy in milliseconds."

---

### **[2:40 - 2:50] ACT VI: Wrap-Up & Call to Action**

**Visual:**
- Presenter camera / GitHub repo screen showing `https://github.com/livai12/agentcourt`.
- Show MIT License and Render live deployment link.

**Audio (Spoken):**
> "AgentCourt is fully open-source under the MIT license, deployed on Render, and ready for judges to test in under 10 minutes. Thank you!"

