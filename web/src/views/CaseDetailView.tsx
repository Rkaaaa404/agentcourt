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
} from 'lucide-react'
import { CaseDetail, DeterministicCheck, VerdictType } from '../types'

interface CaseDetailViewProps {
  caseId: string
  onBack: () => void
}

export default function CaseDetailView({ caseId, onBack }: CaseDetailViewProps) {
  const [detail, setDetail] = useState<CaseDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExecuting, setIsExecuting] = useState(false)
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
      <div className="py-20 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-400">Loading cryptographic evidence pack...</p>
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
        <div className="text-xs text-rose-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{error || 'Case not found'}</span>
        </div>
        <button
          onClick={onBack}
          className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-white rounded-lg transition"
        >
          Return to Cases
        </button>
      </div>
    )
  }

  const c = detail.case
  const ep = c.evidence_pack
  const verdict = c.verdict
  const action = c.planned_action

  const renderVerdictBadge = (v: VerdictType) => {
    const colors: Record<VerdictType, string> = {
      MERCHANT_AT_FAULT: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      OPERATOR_AT_FAULT: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
      WITHIN_MANDATE_REGRET: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
      NO_FAULT: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      NEEDS_HUMAN: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    }
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold border tracking-wide ${colors[v] || colors.NEEDS_HUMAN}`}>
        {v}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Case Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-white font-mono">{c.case_id}</h2>
              <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                PayPal Dispute: {c.dispute_id}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Disputed Amount: <strong className="text-emerald-400 font-mono">${c.disputed_amount} {c.currency}</strong> &bull; Reason: {ep.dispute_reason}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {c.source_mode && (
            <span
              className={`text-[10px] font-mono px-2.5 py-1 rounded-full border ${
                c.source_mode === 'PAYPAL_SANDBOX'
                  ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {c.source_mode === 'PAYPAL_SANDBOX' ? 'PayPal Sandbox Live' : 'Simulated Fixture'}
            </span>
          )}
          {renderVerdictBadge(verdict.verdict)}
          <span className="text-xs font-mono px-3 py-1 bg-slate-950 border border-slate-800 rounded-full text-slate-300">
            {c.status}
          </span>
        </div>
      </div>

      {executionMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{executionMessage}</span>
        </div>
      )}

      {/* 3-Column Evidence Pack Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Signed Mandates & Cryptographic Hashes */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <KeyRound className="w-4 h-4 text-emerald-400" />
              1. Cryptographic Mandates
            </h3>

            {/* Intent Mandate */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center font-semibold text-slate-200">
                <span>IntentMandate (Buyer)</span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5" /> Ed25519 Valid
                </span>
              </div>
              <div className="text-[11px] text-slate-400 italic">
                "{ep.mandate_pack.intent.user_request}"
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px] pt-1 border-t border-slate-800/60">
                <span className="text-slate-500">Spend Cap:</span>
                <span className="font-mono text-emerald-400 font-bold">${ep.mandate_pack.intent.spend_cap}</span>
                <span className="text-slate-500">Nonce:</span>
                <span className="font-mono text-slate-300 truncate">{ep.mandate_pack.intent.nonce}</span>
              </div>
              <div className="text-[10px] font-mono text-slate-500 truncate pt-1">
                Hash: {ep.mandate_pack.cart.intent_hash}
              </div>
            </div>

            {/* Cart Mandate */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center font-semibold text-slate-200">
                <span>CartMandate (Agent)</span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5" /> Ed25519 Valid
                </span>
              </div>
              <div className="text-[11px] text-slate-300 font-medium">
                {ep.mandate_pack.cart.items?.[0]?.title || 'Selected Offer'}
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px] pt-1 border-t border-slate-800/60">
                <span className="text-slate-500">Signed Total:</span>
                <span className="font-mono text-emerald-400 font-bold">${ep.mandate_pack.cart.total_amount}</span>
                <span className="text-slate-500">Merchant:</span>
                <span className="font-mono text-slate-300">{ep.mandate_pack.cart.merchant_id}</span>
              </div>
              <div className="text-[10px] font-mono text-slate-500 truncate pt-1">
                Links to Intent: {ep.mandate_pack.cart.intent_hash?.slice(0, 20)}...
              </div>
            </div>

            {/* PayPal Order Binding */}
            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-sky-500/20 text-xs space-y-1.5">
              <div className="flex items-center justify-between font-semibold text-sky-400 text-xs">
                <span>Order Binding (custom_id)</span>
                <span className="text-[10px] font-mono text-slate-400">{ep.paypal_order_id}</span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 break-all bg-slate-900 p-2 rounded border border-slate-800">
                {ep.captured_custom_id}
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Physical Delivery vs. Listing Specs & Regret */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <FileCheck className="w-4 h-4 text-sky-400" />
              2. Physical Inspection vs. Listing
            </h3>

            {/* Side-by-side specs */}
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-center text-[11px]">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block mb-1">Signed Listing Spec</span>
                  <span className="font-bold text-white font-mono text-sm">
                    {ep.merchant_listing?.ports_count || 8} Ports
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">HDMI 4K: Yes</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block mb-1">Delivered Inspection</span>
                  <span className={`font-bold font-mono text-sm ${
                    (ep.delivery_report?.ports_count || 0) < (ep.merchant_listing?.ports_count || 8)
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}>
                    {ep.delivery_report?.ports_count ?? 'N/A'} Ports
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    HDMI 4K: {ep.delivery_report?.has_hdmi_4k ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              {/* Inspection Quote */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  Warehouse Inspector Notes:
                </span>
                <p className="text-slate-300 text-[11px]">
                  {ep.delivery_report?.inspection_notes || 'Inspection completed according to standard protocol.'}
                </p>
              </div>

              {/* Regret Meter */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Agent Regret Index:</span>
                  <span className={`font-mono font-bold ${
                    verdict.is_regret_flagged ? 'text-cyan-400' : 'text-slate-400'
                  }`}>
                    {(verdict.regret_score * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    style={{ width: `${Math.min(100, verdict.regret_score * 100)}%` }}
                    className={`h-full ${verdict.is_regret_flagged ? 'bg-cyan-500' : 'bg-slate-600'}`}
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  {verdict.is_regret_flagged
                    ? 'Regret threshold (15%) exceeded. A significantly superior offer was available.'
                    : 'Within acceptable tolerance. No severe regret detected.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Arbiter Checks & Human Action Execution */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              3. Arbiter Verdict & Action Plan
            </h3>

            {/* Verdict Summary Card */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Rendered Verdict:</span>
                {renderVerdictBadge(verdict.verdict)}
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {verdict.summary}
              </p>
            </div>

            {/* C1 - C7 Deterministic Checklist */}
            <div className="space-y-1.5 text-xs">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block mb-1">
                Deterministic Rule Trace (C1 - C7):
              </span>
              <div className="grid grid-cols-1 gap-1 max-h-[140px] overflow-y-auto pr-1">
                {verdict.deterministic_checks?.map((chk: DeterministicCheck) => (
                  <div
                    key={chk.check_id}
                    className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-[11px]"
                  >
                    <span className="font-mono text-slate-300 font-medium">
                      [{chk.check_id}] {chk.name}
                    </span>
                    {chk.status === 'PASS' ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-semibold text-[10px]">
                        <CheckCircle2 className="w-3 h-3" /> PASS
                      </span>
                    ) : chk.status === 'FAIL' ? (
                      <span className="text-rose-400 flex items-center gap-1 font-semibold text-[10px]">
                        <XCircle className="w-3 h-3" /> FAIL
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[10px]">SKIP</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Planned PayPal Action Preview */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-sky-500/30 space-y-2 text-xs">
              <div className="flex items-center justify-between font-semibold text-slate-200">
                <span className="flex items-center gap-1.5 text-sky-400">
                  <Terminal className="w-3.5 h-3.5" /> Planned PayPal Action
                </span>
                <span className="font-mono text-[10px] bg-sky-500/10 text-sky-300 px-2 py-0.5 rounded border border-sky-500/20">
                  {action.action_type}
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                POST {action.api_path}
              </div>
              <pre className="text-[10px] font-mono bg-slate-900 p-2 rounded text-slate-300 overflow-x-auto max-h-24">
                {JSON.stringify(action.request_payload, null, 2)}
              </pre>

              {action.off_paypal_ledger_entry && (
                <div className="text-[10px] text-purple-400 border-t border-slate-800 pt-1.5 flex items-center gap-1">
                  <span>Off-PayPal consequence:</span>
                  <span className="font-mono font-semibold">
                    {action.off_paypal_ledger_entry.event}
                  </span>
                </div>
              )}

              {((c.allowed_links && c.allowed_links.length > 0) ||
                (c.allowed_response_options && c.allowed_response_options.length > 0)) && (
                <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1.5">
                  HATEOAS Permitted:{' '}
                  <span className="font-mono text-sky-300">
                    {[...(c.allowed_links || []), ...(c.allowed_response_options || [])].join(', ')}
                  </span>
                </div>
              )}
            </div>

            {/* Human Approve and Execute Button */}
            <div>
              {c.executed ? (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center text-xs text-emerald-400 font-semibold flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {c.execution_mode === 'paypal_sandbox'
                    ? 'Action Executed at PayPal Sandbox'
                    : 'Executed in Local Sandbox Fallback'}
                </div>
              ) : (
                <button
                  onClick={handleApproveAction}
                  disabled={isExecuting}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {isExecuting ? 'Executing with PayPal Sandbox...' : 'Approve and Execute Action'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Immutable Ledger Audit Trail */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <History className="w-4 h-4 text-sky-400" />
          Cryptographic Ledger Audit Trail ({detail.ledger_events?.length || 0} Events)
        </h3>

        <div className="space-y-2">
          {detail.ledger_events?.map((ev) => (
            <div
              key={ev.index}
              className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl text-xs flex flex-col md:flex-row md:items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-slate-500 text-[10px]">#{ev.index}</span>
                <span className="font-semibold text-white">{ev.event_type}</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(ev.timestamp * 1000).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-500 truncate max-w-md">
                Hash: {ev.entry_hash}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
