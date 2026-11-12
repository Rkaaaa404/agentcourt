import { useEffect, useState } from 'react'
import {
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Bot,
  Layers,
  KeyRound,
  FileCheck,
  CheckCircle2,
  ShieldAlert,
  Cpu,
  ArrowRight,
} from 'lucide-react'

interface PurchaseViewProps {
  initialOrderId?: string | null
  checkoutNotice?: { status: string; message?: string } | null
  onSimulateDispute?: (seed: { orderId: string; captureId?: string; amount?: string }) => void
}

export default function PurchaseView({
  initialOrderId,
  checkoutNotice,
  onSimulateDispute,
}: PurchaseViewProps) {
  const [prompt, setPrompt] = useState(
    'USB-C docking station, at least 8 ports, HDMI 4K output, max total USD 120, from a listed merchant.'
  )
  const [policy, setPolicy] = useState<'OPTIMAL' | 'FIRST_ACCEPTABLE'>('OPTIMAL')
  const [isLoading, setIsLoading] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [purchaseResult, setPurchaseResult] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!initialOrderId) return
    const loadOrder = async () => {
      try {
        const resp = await fetch(`/api/orders/${encodeURIComponent(initialOrderId)}`)
        if (resp.ok) {
          const data = await resp.json()
          setPurchaseResult(data)
        }
      } catch (err) {
        console.error('Failed to reload order state:', err)
      }
    }
    loadOrder()
  }, [initialOrderId])

  const handlePurchase = async () => {
    setIsLoading(true)
    setError(null)
    setPurchaseResult(null)

    try {
      const resp = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_request: prompt,
          policy: policy,
        }),
      })

      if (!resp.ok) {
        const data = await resp.json()
        throw new Error(data.detail || 'Purchase orchestration failed')
      }

      const result = await resp.json()
      setPurchaseResult(result)
    } catch (err: any) {
      setError(err.message || 'Error executing purchase')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCaptureOrder = async () => {
    if (!purchaseResult?.order_id) return
    setIsCapturing(true)
    setError(null)
    try {
      const resp = await fetch(`/api/orders/${encodeURIComponent(purchaseResult.order_id)}/capture`, {
        method: 'POST',
      })
      if (!resp.ok) {
        const data = await resp.json()
        throw new Error(data.detail || 'Order capture failed')
      }
      const updated = await resp.json()
      setPurchaseResult(updated)
    } catch (err: any) {
      setError(err.message || 'Error capturing PayPal order')
    } finally {
      setIsCapturing(false)
    }
  }

  const currentStep = !purchaseResult
    ? 1
    : purchaseResult.capture_id
    ? 5
    : purchaseResult.status === 'APPROVED'
    ? 4
    : 3

  const pipelineSteps = [
    { step: 1, label: 'Intent Parsed' },
    { step: 2, label: 'Ed25519 Mandates' },
    { step: 3, label: 'PayPal Order Created' },
    { step: 4, label: 'Buyer Approved' },
    { step: 5, label: 'Captured & Bound' },
  ]

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Checkout Return Notice */}
      {checkoutNotice?.status === 'success' && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>PayPal Sandbox checkout approved and captured! Order binding state is updated below.</span>
        </div>
      )}
      {checkoutNotice?.status === 'cancelled' && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>Buyer cancelled approval in PayPal Sandbox. No funds were captured.</span>
        </div>
      )}
      {checkoutNotice?.status === 'capture_error' && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>PayPal return capture encountered an issue: {checkoutNotice.message || 'Please retry capture below.'}</span>
        </div>
      )}

      {/* Pipeline Stepper */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {pipelineSteps.map((s, idx) => {
            const done = currentStep >= s.step && Boolean(purchaseResult)
            const active = currentStep === s.step
            return (
              <div key={s.step} className="flex items-center gap-2.5">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono font-bold border transition ${
                    done
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : active
                      ? 'bg-[#EFF6FF] text-[#1D6CE0] border-blue-300'
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}
                >
                  {done ? '✓' : s.step}
                </div>
                <span
                  className={`text-xs font-semibold ${
                    done ? 'text-emerald-700' : active ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  {s.label}
                </span>
                {idx < pipelineSteps.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 hidden lg:block ml-1" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Introduction & Prompt Input */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <Bot className="w-5 h-5 text-[#1D6CE0]" />
              Autonomous Shopping Agent &amp; AP2 Mandate Checkout
            </h2>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Enter natural-language purchase constraints. The agent extracts structured constraints, evaluates merchant
              offers, signs Ed25519 Intent &amp; Cart mandates, and binds the SHA-256 digest into PayPal Orders v2{' '}
              <code className="text-[#1D6CE0] font-mono bg-[#EFF6FF] px-1.5 py-0.5 rounded">custom_id</code>.
            </p>
          </div>

          {/* Policy Toggle */}
          <div className="bg-slate-50 p-1 rounded-xl border border-slate-200 flex items-center self-start text-xs">
            <button
              onClick={() => setPolicy('OPTIMAL')}
              className={`px-3 py-1.5 rounded-lg transition font-semibold ${
                policy === 'OPTIMAL'
                  ? 'bg-[#1D6CE0] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Optimal Policy
            </button>
            <button
              onClick={() => setPolicy('FIRST_ACCEPTABLE')}
              className={`px-3 py-1.5 rounded-lg transition font-semibold ${
                policy === 'FIRST_ACCEPTABLE'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              First-Acceptable (Simulate Regret)
            </button>
          </div>
        </div>

        {/* Prompt Input Box */}
        <div className="mt-4 space-y-3">
          <div className="relative">
            <textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-[#1D6CE0] focus:ring-2 focus:ring-blue-100 font-medium placeholder-slate-400 pr-40"
              placeholder="e.g. USB-C docking station, at least 8 ports, HDMI 4K output, max total USD 120"
            />
            <button
              onClick={handlePurchase}
              disabled={isLoading}
              className="absolute right-3 bottom-3 px-4 py-2 bg-[#1D6CE0] hover:bg-[#1558BA] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 shadow-sm shadow-blue-600/20"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Reasoning...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Execute Agent
                </>
              )}
            </button>
          </div>

          {/* Prompt Presets */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Presets:</span>
            <button
              onClick={() => {
                setPrompt('USB-C docking station, at least 8 ports, HDMI 4K output, max total USD 120, from a listed merchant.')
                setPolicy('OPTIMAL')
              }}
              className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-medium transition"
            >
              Optimal Docking Station
            </button>
            <button
              onClick={() => {
                setPrompt('USB-C docking station, 8+ ports, max $120')
                setPolicy('FIRST_ACCEPTABLE')
              }}
              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-medium transition"
            >
              First-Acceptable Policy (Triggers S3 Regret)
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Results View */}
      {purchaseResult && (
        <div className="space-y-6">
          {/* Regret Warning Banner if triggered */}
          {purchaseResult.candidate_trace?.is_regret_flagged && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-900">
                  Agent Regret Detected (Regret Index: {(purchaseResult.candidate_trace.regret_score * 100).toFixed(1)}%)
                </h4>
                <p className="text-xs text-amber-800 mt-1">
                  The agent operated under the <strong>First-Acceptable Offer</strong> policy and selected{' '}
                  <span className="font-semibold text-slate-900">
                    {purchaseResult.candidate_trace.chosen_candidate?.title} (${purchaseResult.candidate_trace.chosen_candidate?.price})
                  </span>
                  , even though a mathematically superior offer{' '}
                  <span className="font-semibold text-slate-900">
                    {purchaseResult.candidate_trace.best_candidate?.title} (${purchaseResult.candidate_trace.best_candidate?.price})
                  </span>{' '}
                  was available within the authorized constraints.
                </p>
              </div>
            </div>
          )}

          {/* AI Intent Extraction Inspector */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#EFF6FF] border border-blue-100 text-[#1D6CE0]">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-900">Extracted Intent Constraints</div>
                <div className="text-[11px] text-slate-500">
                  Mode:{' '}
                  <span className="font-mono text-[#1D6CE0] font-semibold">
                    {purchaseResult.llm_used ? 'LLM Structured Extractor' : 'Deterministic Constraint Parser'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
                category: <strong className="text-slate-900">{purchaseResult.intent?.constraints?.category}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
                min_ports: <strong className="text-[#1D6CE0]">{purchaseResult.intent?.constraints?.min_ports}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
                hdmi_4k:{' '}
                <strong className="text-emerald-700">
                  {purchaseResult.intent?.constraints?.has_hdmi_4k ? 'required' : 'optional'}
                </strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
                max_spend: <strong className="text-emerald-700">${purchaseResult.intent?.spend_cap}</strong>
              </span>
            </div>
          </div>

          {/* 3-Column Layout: Candidates, Mandates, PayPal Order */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Evaluated Candidate Trace */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#1D6CE0]" />
                  Candidate Trace ({purchaseResult.candidate_trace?.evaluated_candidates?.length || 0})
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                  {purchaseResult.candidate_trace?.policy_applied}
                </span>
              </div>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {purchaseResult.candidate_trace?.evaluated_candidates?.map((c: any) => {
                  const isSelected = c.item_id === purchaseResult.candidate_trace?.chosen_candidate?.item_id
                  return (
                    <div
                      key={c.item_id}
                      className={`p-3 rounded-xl border text-xs transition ${
                        isSelected
                          ? 'border-[#1D6CE0] bg-[#EFF6FF]/60 shadow-sm'
                          : c.satisfies_constraints
                          ? 'border-slate-200 bg-slate-50/70 text-slate-700'
                          : 'border-slate-200/70 bg-slate-50/40 text-slate-400 opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className={isSelected ? 'text-[#1D6CE0] font-bold' : 'text-slate-900'}>
                          {c.title}
                        </span>
                        <span className="text-slate-900 font-mono">${c.price}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                        <span>{c.merchant_name} &bull; {c.ports_count} Ports</span>
                        <span>Utility: <strong>{(c.utility_score * 100).toFixed(0)}%</strong></span>
                      </div>
                      {isSelected && (
                        <div className="mt-2 text-[10px] font-semibold text-[#1D6CE0] bg-white border border-blue-200 px-2 py-0.5 rounded-full inline-block">
                          &check; Chosen by Agent
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Column 2: Cryptographic Mandate Pack */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-600" />
                  AP2-Inspired Mandates
                </h3>
                <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Ed25519 Signed
                </span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="font-semibold text-slate-900 flex items-center justify-between">
                  <span>IntentMandate (Buyer)</span>
                  <span className="text-[10px] font-mono text-slate-500">{purchaseResult.intent?.id}</span>
                </div>
                <div className="text-[11px] text-slate-600">
                  Spend Cap: <strong className="text-emerald-700">${purchaseResult.intent?.spend_cap}</strong> &bull; Min Ports: <strong>{purchaseResult.intent?.constraints?.min_ports}</strong>
                </div>
                <div className="text-[10px] font-mono text-slate-500 truncate">
                  Hash: {purchaseResult.cart?.intent_hash}
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="font-semibold text-slate-900 flex items-center justify-between">
                  <span>CartMandate (Agent)</span>
                  <span className="text-[10px] font-mono text-slate-500">{purchaseResult.cart?.id}</span>
                </div>
                <div className="text-[11px] text-slate-600">
                  Total: <strong className="text-emerald-700">${purchaseResult.cart?.total_amount}</strong> &bull; Merchant: <strong>{purchaseResult.cart?.merchant_id}</strong>
                </div>
                <div className="text-[10px] font-mono text-slate-500 truncate">
                  Links to: {purchaseResult.cart?.intent_hash?.slice(0, 24)}...
                </div>
              </div>

              <div className="p-3.5 bg-[#EFF6FF]/60 rounded-xl border border-blue-200 text-xs space-y-1">
                <div className="text-[11px] text-[#1D6CE0] font-bold">Cryptographic Order Binding (SHA-256)</div>
                <div className="text-[10px] font-mono text-slate-700 break-all">
                  {purchaseResult.order_binding}
                </div>
              </div>
            </div>

            {/* Column 3: PayPal Sandbox Order & Action */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-sm">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-[#1D6CE0]" />
                    PayPal Sandbox Order
                  </h3>
                  <span
                    className={`text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
                      purchaseResult.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : purchaseResult.status === 'CANCELLED_BY_BUYER'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-[#EFF6FF] text-[#1D6CE0] border-blue-200'
                    }`}
                  >
                    {purchaseResult.status}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Order ID:</span>
                    <span className="font-mono text-slate-900 font-semibold">{purchaseResult.order_id}</span>
                  </div>
                  {purchaseResult.capture_id && (
                    <div className="flex justify-between text-slate-500">
                      <span>Capture ID:</span>
                      <span className="font-mono text-emerald-700 font-semibold">{purchaseResult.capture_id}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-500">
                    <span>Item:</span>
                    <span className="text-slate-900 font-semibold truncate max-w-[180px]">{purchaseResult.chosen_item?.title}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Total Amount:</span>
                    <span className="font-mono text-slate-900 font-bold">
                      ${purchaseResult.captured_amount || purchaseResult.chosen_item?.price} USD
                    </span>
                  </div>
                </div>

                {purchaseResult.capture_id ? (
                  <div
                    className={`p-3 rounded-xl border text-[11px] space-y-1 ${
                      purchaseResult.binding_verified
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      {purchaseResult.binding_verified
                        ? 'Capture Verified: custom_id matches SHA-256 Order Binding'
                        : 'Order Captured (check custom_id binding)'}
                    </div>
                    {purchaseResult.captured_custom_id && (
                      <div className="font-mono text-[10px] break-all opacity-85">
                        custom_id: {purchaseResult.captured_custom_id}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                    <div className="text-slate-900 font-semibold">Sandbox Checkout Flow (Create &rarr; Approve &rarr; Capture):</div>
                    <p>
                      1) Click <strong>Approve on PayPal Sandbox</strong> and sign in with your sandbox buyer account.
                      2) Returning automatically captures, or click <strong>Capture Approved Order</strong> manually.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                {purchaseResult.approval_url && !purchaseResult.capture_id && (
                  <a
                    href={purchaseResult.approval_url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 bg-[#1D6CE0] hover:bg-[#1558BA] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm shadow-blue-600/20 transition text-center"
                  >
                    1. Approve on PayPal Sandbox
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}

                {!purchaseResult.capture_id && purchaseResult.status !== 'CANCELLED_BY_BUYER' && (
                  <button
                    onClick={handleCaptureOrder}
                    disabled={isCapturing}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isCapturing ? 'Capturing via PayPal Orders v2...' : '2. Capture Approved Order'}
                  </button>
                )}

                {onSimulateDispute && (
                  <button
                    onClick={() =>
                      onSimulateDispute({
                        orderId: purchaseResult.order_id,
                        captureId: purchaseResult.capture_id || undefined,
                        amount: purchaseResult.captured_amount || purchaseResult.chosen_item?.price,
                      })
                    }
                    className="w-full py-2 bg-[#EFF6FF] hover:bg-blue-100 text-[#1D6CE0] border border-blue-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    Open / Simulate Dispute for This Order
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
