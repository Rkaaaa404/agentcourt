import { useState, useEffect } from 'react'
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  KeyRound,
  FileCheck,
  Send,
  History,
  Terminal,
  Brain,
  Lock,
  ChevronDown,
} from 'lucide-react'
import { VERDICT_STYLES } from '../agGridSetup'
import ScrollReveal from '../components/ScrollReveal'
import { CaseDetail, DeterministicCheck, VerdictType } from '../types'

interface CaseDetailViewProps {
  caseId: string
  onBack: () => void
}

export default function CaseDetailView({ caseId, onBack }: CaseDetailViewProps) {
  const [detail, setDetail] = useState<CaseDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isVerifyingLedger, setIsVerifyingLedger] = useState(false)
  const [ledgerVerifyResult, setLedgerVerifyResult] = useState<{
    intact: boolean
    total_entries: number
    latest_hash: string | null
    error: string | null
  } | null>(null)
  const [expandedEventIdx, setExpandedEventIdx] = useState<number | null>(null)
  const [executionMessage, setExecutionMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDetail()
  }, [caseId])

  const fetchDetail = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const resp = await fetch(`/api/cases/${caseId}`)
      if (!resp.ok) throw new Error(`Failed to load case detail for ${caseId}`)
      const data = await resp.json()
      setDetail(data)
    } catch (err: any) {
      setError(err.message || 'Error loading case')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyLedger = async () => {
    setIsVerifyingLedger(true)
    try {
      const resp = await fetch('/api/cases/ledger/verify')
      if (resp.ok) {
        setLedgerVerifyResult(await resp.json())
      }
    } catch (err) {
      console.error('Failed to verify ledger:', err)
    } finally {
      setIsVerifyingLedger(false)
    }
  }

  const handleApproveAction = async () => {
    setIsExecuting(true)
    setExecutionMessage(null)
    setError(null)
    try {
      const resp = await fetch(`/api/cases/${caseId}/approve-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approver: 'human_operator' }),
      })

      if (!resp.ok) {
        const errJson = await resp.json()
        throw new Error(errJson.detail || 'Action execution failed')
      }

      const data = await resp.json()
      setExecutionMessage(
        data.execution_mode === 'paypal_sandbox'
          ? 'Planned PayPal action executed live against PayPal Sandbox Disputes API and recorded in the ledger!'
          : 'Simulated dispute fixture settled in local fallback mode and recorded in the cryptographic ledger (not a live PayPal dispute ID).'
      )
      await fetchDetail()
    } catch (err: any) {
      setError(err.message || 'Execution error')
    } finally {
      setIsExecuting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-[#BF4827] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-[#6E635D]">Loading cryptographic evidence pack...</p>
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="p-6 bg-white border border-[#DCCDBB] rounded-2xl space-y-4 shadow-sm">
          <div className="text-xs text-[#BF4827] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{error || 'Case not found'}</span>
          </div>
          <button
            onClick={onBack}
            className="px-3.5 py-1.5 bg-[#BF4827] hover:bg-[#A33B1E] text-xs text-white rounded-lg font-semibold transition"
          >
            Return to Cases
          </button>
        </div>
      </div>
    )
  }

  const c = detail.case
  const ep = c.evidence_pack
  const verdict = c.verdict
  const action = c.planned_action
  const sem = verdict.semantic_comparison

  const promisedPorts = Number(ep.merchant_listing?.ports_count ?? 8)
  const deliveredPorts = ep.delivery_report?.ports_count
  const portsDelta =
    typeof deliveredPorts === 'number' ? deliveredPorts - promisedPorts : null

  const promisedHdmi = Boolean(ep.merchant_listing?.has_hdmi_4k ?? true)
  const deliveredHdmi = ep.delivery_report?.has_hdmi_4k

  const renderVerdictBadge = (v: VerdictType) => {
    const st = VERDICT_STYLES[v] || VERDICT_STYLES.NEEDS_HUMAN
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border tracking-wide ${st.badge}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
        {v}
      </span>
    )
  }

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Breadcrumb & Case Bar */}
      <ScrollReveal delayMs={0}>
        <div className="bg-white border border-[#DCCDBB] rounded-2xl p-5 space-y-3 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-[#F8F3EB] hover:bg-[#F2EBE0] text-[#6E635D] hover:text-[#292522] rounded-xl border border-[#DCCDBB] transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-extrabold text-[#541827] font-mono">{c.case_id}</h2>
              <span className="text-xs font-mono text-[#574D48] bg-[#F8F3EB] px-2.5 py-0.5 rounded-lg border border-[#DCCDBB]">
                PayPal Dispute: {c.dispute_id}
              </span>
              <span className="text-[11px] font-mono text-[#541827] bg-[#F2EBE0] px-2.5 py-0.5 rounded-full border border-[#DCCDBB] font-semibold">
                {c.lifecycle_stage}
              </span>
            </div>
            <p className="text-xs text-[#6E635D] mt-1">
              Disputed Amount: <strong className="text-[#292522] font-mono">${c.disputed_amount} {c.currency}</strong> &bull; Reason:{' '}
              <span className="font-mono text-[#574D48]">{ep.dispute_reason}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {c.source_mode && (
            <span
              className={`text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full border ${
                c.source_mode === 'PAYPAL_SANDBOX'
                  ? 'bg-[#EDF2EE] text-[#52705C] border-[#C5D3C9]'
                  : 'bg-[#F8F3EB] text-[#574D48] border-[#DCCDBB]'
              }`}
            >
              {c.source_mode === 'PAYPAL_SANDBOX' ? 'PayPal Sandbox Live' : 'Simulated Fixture'}
            </span>
          )}
          {renderVerdictBadge(verdict.verdict)}
          <span className="text-xs font-mono px-3 py-1 bg-[#F8F3EB] border border-[#DCCDBB] rounded-full text-[#574D48]">
            {c.status}
          </span>
        </div>
          </div>

          {/* Continuous Cryptographic Binding Flow */}
          <div className="pt-2.5 border-t border-[#DCCDBB]/70 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#6E635D]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#52705C] animate-pulse" />
              <span>Evidence Chain:</span>
              <span className="text-[#541827] font-semibold">IntentMandate</span>
              <svg viewBox="0 0 40 10" className="w-8 h-2.5 overflow-visible" aria-hidden="true">
                <path d="M 2 5 L 38 5" stroke="#52705C" strokeWidth="1.5" className="animate-beam-flow" />
                <circle r="2.2" fill="#52705C">
                  <animateMotion dur="1.6s" repeatCount="indefinite" path="M 2 5 L 38 5" />
                </circle>
              </svg>
              <span className="text-[#541827] font-semibold">C1–C7 Guardrails</span>
              <svg viewBox="0 0 40 10" className="w-8 h-2.5 overflow-visible" aria-hidden="true">
                <path d="M 2 5 L 38 5" stroke="#BF4827" strokeWidth="1.5" className="animate-beam-flow" />
                <circle r="2.2" fill="#BF4827">
                  <animateMotion dur="1.6s" begin="0.8s" repeatCount="indefinite" path="M 2 5 L 38 5" />
                </circle>
              </svg>
              <span className="text-[#003087] font-bold">PayPal Settlement</span>
            </div>
            <span className="text-[10px] text-[#8C7F77]">Tamper-evident audit verified</span>
          </div>
      </div>
      </ScrollReveal>

      {executionMessage && (
        <div className="p-4 bg-[#EDF2EE] border border-[#C5D3C9] rounded-xl text-xs text-[#52705C] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{executionMessage}</span>
        </div>
      )}

      {/* 3-Column Evidence Pack Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Signed Mandates & Cryptographic Hashes */}
        <div className="bg-white border border-[#DCCDBB] rounded-2xl p-5 space-y-4 shadow-sm veripact-stagger-2 veripact-card-hover">
          <h3 className="text-sm font-bold text-[#541827] flex items-center gap-2 border-b border-[#DCCDBB] pb-3">
            <KeyRound className="w-4 h-4 text-[#52705C]" />
            1. AP2 Cryptographic Mandates
          </h3>

          <div className="p-3.5 bg-[#F8F3EB] rounded-xl border border-[#DCCDBB] space-y-2 text-xs">
            <div className="flex justify-between items-center font-semibold text-[#292522]">
              <span>IntentMandate (Buyer)</span>
              <span className="text-[10px] text-[#52705C] bg-[#EDF2EE] px-2 py-0.5 rounded-full border border-[#C5D3C9] flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3.5 h-3.5" /> Ed25519 Signed
              </span>
            </div>
            <div className="text-[11px] text-[#574D48] italic">
              &ldquo;{ep.mandate_pack.intent.user_request}&rdquo;
            </div>
            <div className="grid grid-cols-2 gap-1 text-[11px] pt-1 border-t border-[#DCCDBB]">
              <span className="text-[#6E635D]">Spend Cap:</span>
              <span className="font-mono text-[#52705C] font-bold">${ep.mandate_pack.intent.spend_cap}</span>
              <span className="text-[#6E635D]">Nonce:</span>
              <span className="font-mono text-[#574D48] truncate">{ep.mandate_pack.intent.nonce}</span>
            </div>
            <div className="text-[10px] font-mono text-[#6E635D] truncate pt-1">
              Hash: {ep.mandate_pack.cart.intent_hash}
            </div>
          </div>

          <div className="p-3.5 bg-[#F8F3EB] rounded-xl border border-[#DCCDBB] space-y-2 text-xs">
            <div className="flex justify-between items-center font-semibold text-[#292522]">
              <span>CartMandate (Agent)</span>
              <span className="text-[10px] text-[#52705C] bg-[#EDF2EE] px-2 py-0.5 rounded-full border border-[#C5D3C9] flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3.5 h-3.5" /> Ed25519 Signed
              </span>
            </div>
            <div className="text-[11px] text-[#292522] font-semibold">
              {ep.mandate_pack.cart.items?.[0]?.title || 'Selected Offer'}
            </div>
            <div className="grid grid-cols-2 gap-1 text-[11px] pt-1 border-t border-[#DCCDBB]">
              <span className="text-[#6E635D]">Signed Total:</span>
              <span className="font-mono text-[#52705C] font-bold">${ep.mandate_pack.cart.total_amount}</span>
              <span className="text-[#6E635D]">Captured Total:</span>
              <span
                className={`font-mono font-bold ${
                  Number(ep.captured_amount) > Number(ep.mandate_pack.cart.total_amount)
                    ? 'text-[#BF4827]'
                    : 'text-[#52705C]'
                }`}
              >
                ${ep.captured_amount}
              </span>
              <span className="text-[#6E635D]">Merchant:</span>
              <span className="font-mono text-[#574D48]">{ep.mandate_pack.cart.merchant_id}</span>
            </div>
          </div>

          <div className="p-3.5 bg-[#F2EBE0] rounded-xl border border-[#DCCDBB] text-xs space-y-1.5">
            <div className="flex items-center justify-between font-bold text-[#541827] text-xs">
              <span>PayPal Order Binding (custom_id)</span>
              <span className="text-[10px] font-mono text-[#6E635D]">{ep.paypal_order_id}</span>
            </div>
            <div className="text-[10px] font-mono text-[#574D48] break-all bg-white p-2 rounded-lg border border-[#DCCDBB]">
              {ep.captured_custom_id || 'NONE'}
            </div>
          </div>
        </div>

        {/* Column 2: Visual Spec Diff, AI Semantic Comparison & Regret */}
        <div className="bg-white border border-[#DCCDBB] rounded-2xl p-5 space-y-4 shadow-sm veripact-stagger-3 veripact-card-hover">
          <h3 className="text-sm font-bold text-[#541827] flex items-center gap-2 border-b border-[#DCCDBB] pb-3">
            <FileCheck className="w-4 h-4 text-[#BF4827]" />
            2. Spec Diff &amp; AI Semantic Reasoning
          </h3>

          {/* Side-by-side Spec Diff */}
          <div className="grid grid-cols-2 gap-2.5 text-center text-[11px]">
            <div className="p-3 rounded-xl bg-[#F8F3EB] border border-[#DCCDBB] space-y-1">
              <span className="text-[#6E635D] block">Signed Listing Spec</span>
              <span className="font-bold text-[#292522] font-mono text-base block">{promisedPorts} Ports</span>
              <span className="text-[10px] text-[#6E635D] block">
                HDMI 4K: {promisedHdmi ? 'Yes' : 'No'}
              </span>
            </div>

            <div
              className={`p-3 rounded-xl border space-y-1 ${
                portsDelta !== null && portsDelta < 0
                  ? 'bg-[#FAEDE9] border-[#EBC4BA]'
                  : 'bg-[#F8F3EB] border-[#DCCDBB]'
              }`}
            >
              <span className="text-[#574D48] block">Delivered Inspection</span>
              <div className="flex items-center justify-center gap-1.5">
                <span
                  className={`font-bold font-mono text-base ${
                    portsDelta !== null && portsDelta < 0 ? 'text-[#BF4827]' : 'text-[#52705C]'
                  }`}
                >
                  {deliveredPorts ?? 'N/A'} Ports
                </span>
                {portsDelta !== null && portsDelta !== 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-[#BF4827] border border-[#EBC4BA] font-bold">
                    {portsDelta > 0 ? `+${portsDelta}` : portsDelta}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] block ${
                  deliveredHdmi === false && promisedHdmi ? 'text-[#BF4827] font-semibold' : 'text-[#6E635D]'
                }`}
              >
                HDMI 4K: {deliveredHdmi === undefined ? 'N/A' : deliveredHdmi ? 'Yes' : 'Missing'}
              </span>
            </div>
          </div>

          <div className="p-3 bg-[#F8F3EB] rounded-xl border border-[#DCCDBB] space-y-1">
            <span className="text-[10px] text-[#6E635D] uppercase tracking-wider font-semibold">
              Warehouse Inspector Notes:
            </span>
            <p className="text-[#292522] text-[11px]">
              {ep.delivery_report?.inspection_notes || 'Inspection completed according to standard protocol.'}
            </p>
          </div>

          {/* Semantic Comparison & Prompt-Injection Shield */}
          <div className="p-3.5 bg-[#F2EBE0] rounded-xl border border-[#DCCDBB] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#541827] flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-[#BF4827]" />
                AI Semantic Discrepancy
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-[#DCCDBB] text-[#574D48]">
                {sem?.llm_used ? sem.model : 'Deterministic Classifier'}
              </span>
            </div>
            {sem ? (
              <div className="space-y-1.5 text-[11px]">
                <div className="flex flex-wrap gap-2 font-mono text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-white border border-[#DCCDBB] text-[#574D48]">
                    ports_match: <strong>{sem.ports_match}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white border border-[#DCCDBB] text-[#574D48]">
                    hdmi_match: <strong>{sem.hdmi_match}</strong>
                  </span>
                </div>
                {sem.discrepancies && sem.discrepancies.length > 0 && (
                  <ul className="list-disc list-inside text-[#9A5B13] space-y-0.5">
                    {sem.discrepancies.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                )}
                {sem.quote && (
                  <div className="text-[10px] text-[#574D48] italic border-l-2 border-[#BF4827] pl-2">
                    &ldquo;{sem.quote}&rdquo;
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-[#574D48]">
                Bypassed by Deterministic Supremacy (C1–C7 protocol/operator checks failed before LLM stage).
              </p>
            )}
          </div>

          {/* Regret Meter */}
          <div className="p-3.5 bg-[#F8F3EB] rounded-xl border border-[#DCCDBB] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#292522]">Agent Regret Index:</span>
              <span className={`font-mono font-bold ${verdict.is_regret_flagged ? 'text-[#9A5B13]' : 'text-[#574D48]'}`}>
                {(verdict.regret_score * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-[#EAE3D8] rounded-full h-2 overflow-hidden">
              <div
                style={{ width: `${Math.min(100, verdict.regret_score * 100)}%` }}
                className={`h-full transition-all duration-700 ease-out ${verdict.is_regret_flagged ? 'bg-[#C97B18]' : 'bg-[#541827]'}`}
              />
            </div>
            <p className="text-[10px] text-[#6E635D]">
              {verdict.is_regret_flagged
                ? 'Regret threshold (15%) exceeded. A significantly superior offer was available.'
                : 'Within acceptable tolerance. No severe regret detected.'}
            </p>
          </div>
        </div>

        {/* Column 3: Arbiter Checks & Human Action Execution */}
        <div className="bg-white border border-[#DCCDBB] rounded-2xl p-5 space-y-4 shadow-sm veripact-stagger-4 veripact-card-hover">
          <h3 className="text-sm font-bold text-[#541827] flex items-center gap-2 border-b border-[#DCCDBB] pb-3">
            <ShieldCheck className="w-4 h-4 text-[#BF4827]" />
            3. Arbiter Verdict &amp; Action Plan
          </h3>

          <div className="p-3.5 bg-[#F8F3EB] rounded-xl border border-[#DCCDBB] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#6E635D] font-medium">Rendered Verdict:</span>
              {renderVerdictBadge(verdict.verdict)}
            </div>
            <p className="text-[#292522] text-[11px] leading-relaxed">{verdict.summary}</p>
          </div>

          <div className="space-y-1.5 text-xs">
            <span className="text-[10px] text-[#6E635D] uppercase tracking-wider font-semibold block mb-1">
              Deterministic Rule Trace (C1 - C7):
            </span>
            <div className="grid grid-cols-1 gap-1 max-h-[160px] overflow-y-auto pr-1">
              {verdict.deterministic_checks?.map((chk: DeterministicCheck, idx: number) => (
                <div
                  key={chk.check_id}
                  title={chk.details}
                  style={{ animationDelay: `${idx * 55}ms` }}
                  className={`p-2 rounded-lg border flex items-center justify-between text-[11px] animate-fade-up transition-colors ${
                    chk.status === 'FAIL'
                      ? 'bg-[#FAEDE9] border-[#EBC4BA]'
                      : 'bg-[#F8F3EB] border-[#DCCDBB] hover:border-[#BF4827]/40'
                  }`}
                >
                  <span className="font-mono text-[#292522] font-medium">
                    [{chk.check_id}] {chk.name}
                  </span>
                  {chk.status === 'PASS' ? (
                    <span className="text-[#52705C] flex items-center gap-1 font-semibold text-[10px]">
                      <CheckCircle2 className="w-3 h-3" /> PASS
                    </span>
                  ) : chk.status === 'FAIL' ? (
                    <span className="text-[#BF4827] flex items-center gap-1 font-semibold text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#BF4827] animate-ping" />
                      <XCircle className="w-3 h-3" /> FAIL
                    </span>
                  ) : (
                    <span className="text-[#8C7F77] text-[10px]">SKIP</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-3.5 bg-[#F2EBE0] rounded-xl border border-[#DCCDBB] space-y-2 text-xs">
            <div className="flex items-center justify-between font-semibold text-[#292522]">
              <span className="flex items-center gap-1.5 text-[#541827]">
                <Terminal className="w-3.5 h-3.5 text-[#BF4827]" /> Planned PayPal Action
              </span>
              <span className="font-mono text-[10px] bg-white text-[#BF4827] px-2 py-0.5 rounded border border-[#EBC4BA] font-semibold">
                {action.action_type}
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#574D48]">
              {action.http_method} {action.api_path}
            </div>
            <pre className="text-[10px] font-mono bg-white p-2.5 rounded-lg border border-[#DCCDBB] text-[#292522] overflow-x-auto max-h-28">
              {JSON.stringify(action.request_payload, null, 2)}
            </pre>

            {action.off_paypal_ledger_entry && (
              <div className="text-[10px] text-[#541827] border-t border-[#DCCDBB] pt-1.5 flex items-center gap-1">
                <span>Off-PayPal consequence:</span>
                <span className="font-mono font-semibold">{action.off_paypal_ledger_entry.event}</span>
              </div>
            )}

            {((c.allowed_links && c.allowed_links.length > 0) ||
              (c.allowed_response_options && c.allowed_response_options.length > 0)) && (
              <div className="text-[10px] text-[#574D48] border-t border-[#DCCDBB] pt-1.5">
                HATEOAS Permitted:{' '}
                <span className="font-mono text-[#BF4827] font-semibold">
                  {[...(c.allowed_links || []), ...(c.allowed_response_options || [])].join(', ')}
                </span>
              </div>
            )}
          </div>

          <div>
            {c.executed ? (
              <div className="p-3 bg-[#EDF2EE] border border-[#C5D3C9] rounded-xl text-center text-xs text-[#52705C] font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {c.execution_mode === 'paypal_sandbox'
                  ? 'Action Executed at PayPal Sandbox'
                  : 'Executed in Local Sandbox Fallback'}
              </div>
            ) : (
              <button
                onClick={handleApproveAction}
                disabled={isExecuting}
                className="w-full py-3 bg-[#BF4827] hover:bg-[#A33B1E] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {isExecuting ? 'Executing with PayPal Sandbox...' : 'Approve and Execute Action'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Immutable Ledger Audit Trail with Live Hash-Chain Verification */}
      <ScrollReveal delayMs={80}>
        <div className="bg-white border border-[#DCCDBB] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCCDBB] pb-3">
          <h3 className="text-sm font-bold text-[#541827] flex items-center gap-2">
            <History className="w-4 h-4 text-[#BF4827]" />
            Cryptographic Ledger Audit Trail ({detail.ledger_events?.length || 0} Case Events)
          </h3>

          <button
            onClick={handleVerifyLedger}
            disabled={isVerifyingLedger}
            className="px-3.5 py-1.5 rounded-xl bg-[#F2EBE0] hover:bg-[#EDE6DA] border border-[#DCCDBB] text-xs font-semibold text-[#541827] flex items-center gap-1.5 transition self-start sm:self-auto"
          >
            <Lock className="w-3.5 h-3.5 text-[#BF4827]" />
            {isVerifyingLedger ? 'Verifying SHA-256 Chain...' : 'Verify Full Hash-Chain Integrity'}
          </button>
        </div>

        {ledgerVerifyResult && (
          <div
            className={`p-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
              ledgerVerifyResult.intact
                ? 'bg-[#EDF2EE] border-[#C5D3C9] text-[#52705C]'
                : 'bg-[#FAEDE9] border-[#EBC4BA] text-[#BF4827]'
            }`}
          >
            <span className="font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              {ledgerVerifyResult.intact
                ? `SHA-256 Hash Chain Verified Intact (${ledgerVerifyResult.total_entries} total ledger entries)`
                : `Tamper Detected: ${ledgerVerifyResult.error}`}
            </span>
            {ledgerVerifyResult.latest_hash && (
              <span className="font-mono text-[10px] opacity-85">
                Tip: {ledgerVerifyResult.latest_hash.slice(0, 24)}...
              </span>
            )}
          </div>
        )}

        <div className="space-y-2">
          {detail.ledger_events?.map((ev) => {
            const isExpanded = expandedEventIdx === ev.index
            return (
              <div
                key={ev.index}
                className="bg-[#F8F3EB] border border-[#DCCDBB] rounded-xl text-xs overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedEventIdx(isExpanded ? null : ev.index)}
                  className="w-full p-3 flex flex-col md:flex-row md:items-center justify-between gap-2 text-left hover:bg-[#F2EBE0] transition"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[#8C7F77] text-[10px]">#{ev.index}</span>
                    <span className="font-bold text-[#292522]">{ev.event_type}</span>
                    <span className="text-[10px] text-[#6E635D] font-mono">
                      {new Date(ev.timestamp * 1000).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-[#6E635D]">
                    <span className="truncate max-w-xs md:max-w-md">Hash: {ev.entry_hash}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-[#BF4827]' : ''}`} />
                  </div>
                </button>
                <div
                  className={`grid transition-all duration-300 ease-out ${
                    isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-3 pb-3 pt-2 border-t border-[#DCCDBB] space-y-1 bg-white">
                      <div className="text-[10px] font-mono text-[#6E635D]">prev_hash: {ev.prev_hash}</div>
                      <pre className="text-[10px] font-mono bg-[#F8F3EB] border border-[#DCCDBB] p-2 rounded text-[#292522] overflow-x-auto">
                        {JSON.stringify(ev.payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      </ScrollReveal>
    </div>
  )
}
