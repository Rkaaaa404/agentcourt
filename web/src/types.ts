export type VerdictType =
  | 'MERCHANT_AT_FAULT'
  | 'OPERATOR_AT_FAULT'
  | 'WITHIN_MANDATE_REGRET'
  | 'NO_FAULT'
  | 'NEEDS_HUMAN'

export interface CaseSummary {
  case_id: string
  dispute_id: string
  status: string
  lifecycle_stage: string
  disputed_amount: string
  currency: string
  seller_response_due_date: string | null
  verdict: VerdictType
  verdict_summary: string
  action_type: string
  executed: boolean
  created_at: number
  regret_score: number
  is_regret_flagged: boolean
}

export interface DeterministicCheck {
  check_id: string
  name: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  details: string
  failure_reason: string | null
}

export interface SemanticComparison {
  ports_match: string
  hdmi_match: string
  discrepancies: string[]
  is_mismatch: boolean
  quote: string
  llm_used: boolean
  model: string
}

export interface PlannedAction {
  case_id: string
  dispute_id: string
  action_type: string
  http_method: string
  api_path: string
  request_payload: Record<string, any>
  rationale: string
  off_paypal_ledger_entry: Record<string, any> | null
  requires_human_approval: boolean
  executed: boolean
  execution_result: Record<string, any> | null
}

export interface CaseDetail {
  case: {
    case_id: string
    dispute_id: string
    status: string
    lifecycle_stage: string
    disputed_amount: string
    currency: string
    seller_response_due_date: string | null
    evidence_pack: {
      case_id: string
      dispute_id: string
      dispute_reason: string
      disputed_amount: string
      currency: string
      paypal_order_id: string
      paypal_capture_id: string | null
      captured_amount: string
      captured_custom_id: string | null
      merchant_listing: Record<string, any>
      delivery_report: Record<string, any>
      mandate_pack: {
        intent: {
          id: string
          user_request: string
          spend_cap: string
          allowed_merchants: string[]
          expires_at: number
          nonce: string
          public_key: string
          signature: string
        }
        cart: {
          id: string
          intent_hash: string
          merchant_id: string
          total_amount: string
          items: Array<{
            item_id: string
            title: string
            price: string
            attributes: Record<string, any>
          }>
          public_key: string
          signature: string
        }
      }
      candidate_trace?: {
        evaluated_candidates: Array<{
          item_id: string
          merchant_name: string
          title: string
          price: string
          ports_count: number
          satisfies_constraints: boolean
          utility_score: number
        }>
        chosen_candidate?: {
          title: string
          price: string
          utility_score: number
        }
        best_candidate?: {
          title: string
          price: string
          utility_score: number
        }
        regret_score: number
        is_regret_flagged: boolean
      }
    }
    verdict: {
      verdict: VerdictType
      summary: string
      deterministic_checks: DeterministicCheck[]
      semantic_comparison?: SemanticComparison
      regret_score: number
      is_regret_flagged: boolean
      failed_checks: string[]
      llm_used: boolean
    }
    planned_action: PlannedAction
    executed: boolean
  }
  ledger_events: Array<{
    index: number
    timestamp: number
    event_type: string
    payload: Record<string, any>
    entry_hash: string
    prev_hash: string
  }>
}

export interface EvalScenarioResult {
  id: string
  name: string
  category: string
  expected: string
  actual: string
  passed: boolean
  failed_checks: string[]
  regret_score: number
  llm_used: boolean
  summary: string
}

export interface EvalResultsResponse {
  timestamp: number
  total_scenarios: number
  passed_scenarios: number
  failed_scenarios: number
  accuracy_pct: number
  elapsed_ms: number
  class_breakdown: Record<string, { correct: number; total: number; accuracy_pct: number }>
  results: EvalScenarioResult[]
}
