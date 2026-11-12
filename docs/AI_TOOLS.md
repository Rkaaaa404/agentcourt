# AI Tools & Sponsor Integration Documentation

In accordance with hackathon rules, this document details all AI tools, models, and sponsor developer tools utilized in the development and runtime execution of **Veripact**.

---

## 1. Runtime AI Models & Usage in Veripact

Veripact incorporates AI at specific, bounded runtime stages where natural language understanding is required. Critically, AI outputs can never override deterministic rule failures or directly trigger payment actions.

| Task | Model / Provider | Role | Safety Guarantee |
|---|---|---|---|
| **Intent Extraction** | Google Gemini 3.1 Pro (default) / Claude / OpenAI (`LLM_PROVIDER`) | Parses raw user shopping prompts into structured JSON constraints (item attributes, price ceiling, merchant filters). | Pydantic schema validation; invalid outputs are rejected. |
| **Semantic Comparison** | Google Gemini 3.1 Pro (default) / Claude / OpenAI (`LLM_PROVIDER`) | Compares signed merchant listing specs against simulated warehouse delivery reports. | Strict JSON schema output (`match`, `mismatch`, `unclear`); prompt-injection shielding. |
| **Verdict Explanation** | Google Gemini 3.1 Pro (default) / Claude / OpenAI (`LLM_PROVIDER`) | Generates transparent narrative explaining why the merchant or operator is at fault. | Explanatory only; deterministic rules C1–C7 dictate the executable action. |

*Note: If no LLM API key is provided, Veripact automatically operates in deterministic-only mode, flagging all verdicts with `llm_used: false`.*

---

## 2. Development AI Tools

### Google Antigravity
- **Role**: AI-assisted development environment and pair-programming assistant used for codebase architecture, implementation, typing, testing, and continuous verification.

### Claude Code (Anthropic)
- **Role**: Used in a final pre-submission audit pass: adding the Google Gemini provider, fixing the retired default LLM model ID, repairing documentation links, and aligning the sponsor and AI-tool disclosures with what the code actually does.

### APIMatic Context Plugin
- **Status**: Not used in this build. Veripact calls the PayPal REST APIs directly via `httpx` (`backend/veripact/payments/paypal_client.py`).
