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

  return (
    <div className="space-y-6">
      {/* Checkout Return Notice */}
      {checkoutNotice?.status === 'success' && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>PayPal Sandbox checkout approved and captured! Order binding state is updated below.</span>
        </div>
      )}
      {checkoutNotice?.status === 'cancelled' && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Buyer cancelled approval in PayPal Sandbox. No funds were captured.</span>
        </div>
      )}
      {checkoutNotice?.status === 'capture_error' && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>PayPal return capture encountered an issue: {checkoutNotice.message || 'Please retry capture below.'}</span>
        </div>
      )}

      {/* Introduction banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <Bot className="w-5 h-5 text-sky-400" />
              Autonomous Shopping Agent & Mandate Signer
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl">
              Type a natural-language shopping instruction. The agent parses constraints, searches the catalog,
              evaluates candidate utility, signs AP2-inspired Intent and Cart mandates, and binds them cryptographically
              to a PayPal Sandbox order.
            </p>
          </div>

          {/* Policy Toggle */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center self-start text-xs">
            <button
              onClick={() => setPolicy('OPTIMAL')}
              className={`px-3 py-1.5 rounded-lg transition font-medium ${
                policy === 'OPTIMAL' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Optimal Policy
            </button>
            <button
              onClick={() => setPolicy('FIRST_ACCEPTABLE')}
              className={`px-3 py-1.5 rounded-lg transition font-medium ${
                policy === 'FIRST_ACCEPTABLE' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
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
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-sky-500 font-medium placeholder-slate-600 pr-32"
              placeholder="e.g. USB-C docking station, at least 8 ports, HDMI 4K output, max total USD 120"
            />
            <button
              onClick={handlePurchase}
              disabled={isLoading}
              className="absolute right-3 bottom-3 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 shadow-md shadow-sky-600/20"
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
            <span className="text-slate-500">Presets:</span>
            <button
              onClick={() => {
                setPrompt('USB-C docking station, at least 8 ports, HDMI 4K output, max total USD 120, from a listed merchant.')
                setPolicy('OPTIMAL')
              }}
              className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-md transition"
            >
              Optimal Docking Station
            </button>
            <button
              onClick={() => {
                setPrompt('USB-C docking station, 8+ ports, max $120')
                setPolicy('FIRST_ACCEPTABLE')
              }}
              className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 rounded-md transition"
            >
              First-Acceptable Policy (Triggers S3 Regret)
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results View */}
      {purchaseResult && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Regret Warning Banner if triggered */}
          {purchaseResult.candidate_trace?.is_regret_flagged && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 text-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-300">
                  Agent Regret Detected (Regret Index: {(purchaseResult.candidate_trace.regret_score * 100).toFixed(1)}%)
                </h4>
                <p className="text-xs text-amber-200/80 mt-1">
                  The agent operated under the <strong>First-Acceptable Offer</strong> policy and selected{' '}
                  <span className="font-semibold text-white">
                    {purchaseResult.candidate_trace.chosen_candidate?.title} (${purchaseResult.candidate_trace.chosen_candidate?.price})
                  </span>
                  , even though a mathematically superior offer{' '}
                  <span className="font-semibold text-white">
                    {purchaseResult.candidate_trace.best_candidate?.title} (${purchaseResult.candidate_trace.best_candidate?.price})
                  </span>{' '}
                  was available within the authorized constraints. This reproduces Scenario S3 for post-payment review.
                </p>
              </div>
            </div>
          )}

          {/* 3-Column Layout: Candidates, Mandates, PayPal Order */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Evaluated Candidate Trace */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  Candidate Trace ({purchaseResult.candidate_trace?.evaluated_candidates?.length || 0})
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  Policy: {purchaseResult.candidate_trace?.policy_applied}
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
                          ? 'border-sky-500/60 bg-sky-500/10 shadow-sm'
                          : c.satisfies_constraints
                          ? 'border-slate-800 bg-slate-950/60 text-slate-300'
                          : 'border-slate-800/60 bg-slate-950/30 text-slate-500 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className={isSelected ? 'text-sky-300 font-bold' : 'text-slate-200'}>
                          {c.title}
                        </span>
                        <span className="text-white font-mono">${c.price}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                        <span>{c.merchant_name} &bull; {c.ports_count} Ports</span>
                        <span>Utility: <strong>{(c.utility_score * 100).toFixed(0)}%</strong></span>
                      </div>
                      {isSelected && (
                        <div className="mt-2 text-[10px] font-semibold text-sky-400 bg-sky-500/20 px-2 py-0.5 rounded inline-block">
                          &check; Chosen by Agent
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Column 2: Cryptographic Mandate Pack */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                  AP2-Inspired Mandates
                </h3>
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Ed25519 Signed
                </span>
              </div>

              {/* Intent Mandate Summary */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="font-semibold text-slate-200 flex items-center justify-between">
                  <span>IntentMandate (Buyer)</span>
                  <span className="text-[10px] font-mono text-slate-400">{purchaseResult.intent?.id}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Spend Cap: <strong className="text-emerald-400">${purchaseResult.intent?.spend_cap}</strong> &bull; Min Ports: <strong>{purchaseResult.intent?.constraints?.min_ports}</strong>
                </div>
                <div className="text-[10px] font-mono text-slate-500 truncate">
                  Hash: {purchaseResult.cart?.intent_hash}
                </div>
              </div>

              {/* Cart Mandate Summary */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="font-semibold text-slate-200 flex items-center justify-between">
                  <span>CartMandate (Agent)</span>
                  <span className="text-[10px] font-mono text-slate-400">{purchaseResult.cart?.id}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Total: <strong className="text-emerald-400">${purchaseResult.cart?.total_amount}</strong> &bull; Merchant: <strong>{purchaseResult.cart?.merchant_id}</strong>
                </div>
                <div className="text-[10px] font-mono text-slate-500 truncate">
                  Links to: {purchaseResult.cart?.intent_hash?.slice(0, 24)}...
                </div>
              </div>

              {/* Order Binding */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-sky-500/20 text-xs space-y-1">
                <div className="text-[11px] text-sky-400 font-semibold">Cryptographic Order Binding</div>
                <div className="text-[10px] font-mono text-slate-400 break-all">
                  {purchaseResult.order_binding}
                </div>
              </div>
            </div>

            {/* Column 3: PayPal Sandbox Order & Action */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-sky-400" />
                    PayPal Sandbox Order
                  </h3>
                  <span
                    className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                      purchaseResult.status === 'COMPLETED'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : purchaseResult.status === 'CANCELLED_BY_BUYER'
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                    }`}
                  >
                    {purchaseResult.status}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Order ID:</span>
                    <span className="font-mono text-white font-medium">{purchaseResult.order_id}</span>
                  </div>
                  {purchaseResult.capture_id && (
                    <div className="flex justify-between text-slate-400">
                      <span>Capture ID:</span>
                      <span className="font-mono text-emerald-400 font-medium">{purchaseResult.capture_id}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-400">
                    <span>Item:</span>
                    <span className="text-white font-medium truncate max-w-[180px]">{purchaseResult.chosen_item?.title}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Total Amount:</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      ${purchaseResult.captured_amount || purchaseResult.chosen_item?.price} USD
                    </span>
                  </div>
                </div>

                {purchaseResult.capture_id ? (
                  <div
                    className={`p-3 rounded-xl border text-[11px] space-y-1 ${
                      purchaseResult.binding_verified
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      {purchaseResult.binding_verified
                        ? 'Capture Verified: custom_id matches SHA-256 Order Binding'
                        : 'Order Captured (check custom_id binding)'}
                    </div>
                    {purchaseResult.captured_custom_id && (
                      <div className="font-mono text-[10px] break-all opacity-80">
                        custom_id: {purchaseResult.captured_custom_id}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                    <div className="text-slate-300 font-medium">Sandbox Checkout Flow (Create &rarr; Approve &rarr; Capture):</div>
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
                    className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30 transition text-center"
                  >
                    1. Approve on PayPal Sandbox
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}

                {!purchaseResult.capture_id && purchaseResult.status !== 'CANCELLED_BY_BUYER' && (
                  <button
                    onClick={handleCaptureOrder}
                    disabled={isCapturing}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"
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
                    className="w-full py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
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
