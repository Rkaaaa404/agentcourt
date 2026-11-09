# AI Tools & Sponsor Integration Documentation

In accordance with hackathon rules, this document details all AI tools, models, and sponsor developer tools utilized in the development and runtime execution of **AgentCourt**.

---

## 1. Runtime AI Models & Usage in AgentCourt

AgentCourt incorporates AI at specific, bounded runtime stages where natural language understanding is required. Critically, AI outputs can never override deterministic rule failures or directly trigger payment actions.

| Task | Model / Provider | Role | Safety Guarantee |
|---|---|---|---|
| **Intent Extraction** | Claude 3.5 Sonnet / OpenAI GPT-4o (`LLM_PROVIDER`) | Parses raw user shopping prompts into structured JSON constraints (item attributes, price ceiling, merchant filters). | Pydantic schema validation; invalid outputs are rejected. |
| **Semantic Comparison** | Claude 3.5 Sonnet / OpenAI GPT-4o (`LLM_PROVIDER`) | Compares signed merchant listing specs against simulated warehouse delivery reports. | Strict JSON schema output (`match`, `mismatch`, `unclear`); prompt-injection shielding. |
| **Verdict Explanation** | Claude 3.5 Sonnet / OpenAI GPT-4o (`LLM_PROVIDER`) | Generates transparent narrative explaining why the merchant or operator is at fault. | Explanatory only; deterministic rules C1–C7 dictate the executable action. |

*Note: If no LLM API key is provided, AgentCourt automatically operates in deterministic-only mode, flagging all verdicts with `llm_used: false`.*

---

## 2. Development AI Tools

### Google Antigravity
- **Role**: AI-assisted development environment and pair-programming assistant used for codebase architecture, implementation, typing, testing, and continuous verification.

### APIMatic Context Plugin
- **Status & Details**:
  [HUMAN TO FILL: where the plugin was used and what it produced]
  *(The APIMatic Context Plugin was evaluated for API specification and schema generation. Because Antigravity operates on its native coding agent architecture, complete any APIMatic CLI/plugin runs in your supported environment and paste the generated context outputs or verification notes here).*
