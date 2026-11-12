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
        <div className="p-4 bg-[#EDF2EE] border border-[#C5D3C9] rounded-xl text-xs text-[#52705C] flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>PayPal Sandbox checkout approved and captured! Order binding state is updated below.</span>
        </div>
      )}
      {checkoutNotice?.status === 'cancelled' && (
        <div className="p-4 bg-[#FEF3DC] border border-[#F5DEB0] rounded-xl text-xs text-[#9A5B13] flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Buyer cancelled approval in PayPal Sandbox. No funds were captured.</span>
        </div>
      )}
      {checkoutNotice?.status === 'capture_error' && (
        <div className="p-4 bg-[#FAEDE9] border border-[#EBC4BA] rounded-xl text-xs text-[#BF4827] flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>PayPal return capture encountered an issue: {checkoutNotice.message || 'Please retry capture below.'}</span>
        </div>
      )}

      {/* Pipeline Stepper with Continuous SVG Data-Packet Beam */}
      <div className="bg-white border border-[#DCCDBB] rounded-2xl px-5 py-4 shadow-sm veripact-stagger-1 relative overflow-hidden">
        <svg
          className="hidden lg:block absolute inset-x-10 top-1/2 -translate-y-1/2 w-[calc(100%-5rem)] h-6 pointer-events-none"
          viewBox="0 0 1000 24"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path id="veripactCheckoutBeam" d="M 40 12 L 960 12" stroke="#E8DDD0" strokeWidth="1.5" fill="none" />
          <path
            d="M 40 12 L 960 12"
            stroke="#BF4827"
            strokeOpacity="0.45"
            strokeWidth="2"
            fill="none"
            className="animate-beam-flow"
          />
          <circle r="3.5" fill="#BF4827">
            <animateMotion dur="3.4s" repeatCount="indefinite">
              <mpath href="#veripactCheckoutBeam" />
            </animateMotion>
          </circle>
        </svg>

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          {pipelineSteps.map((s, idx) => {
            const done = currentStep >= s.step && Boolean(purchaseResult)
            const active = currentStep === s.step
            return (
              <div key={s.step} className="flex items-center gap-2.5 bg-white/95 px-2 py-0.5 rounded-full">
                <div className="relative">
                  {active && (
                    <span className="absolute inset-0 rounded-full bg-[#BF4827]/35 animate-ping" />
                  )}
                  <div
                    className={`relative w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono font-bold border transition-all duration-300 ${
                      done
                        ? 'bg-[#EDF2EE] text-[#52705C] border-[#C5D3C9] scale-105'
                        : active
                        ? 'bg-[#FAEDE9] text-[#BF4827] border-[#EBC4BA] scale-110 shadow-sm'
                        : 'bg-[#F8F3EB] text-[#8C7F77] border-[#DCCDBB]'
                    }`}
                  >
                    {done ? '✓' : s.step}
                  </div>
                </div>
                <span
                  className={`text-xs font-semibold transition-colors ${
                    done ? 'text-[#52705C]' : active ? 'text-[#541827]' : 'text-[#8C7F77]'
                  }`}
                >
                  {s.label}
                </span>
                {idx < pipelineSteps.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-[#DCCDBB] lg:hidden ml-1" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Introduction & Prompt Input */}
      <div className="bg-white border border-[#DCCDBB] rounded-2xl p-6 shadow-sm veripact-stagger-2 veripact-card-hover">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-serif text-2xl font-bold text-[#541827] flex items-center gap-2.5">
              <Bot className="w-5 h-5 text-[#BF4827]" />
              Autonomous Shopping Agent &amp; AP2 Mandate Checkout
            </h2>
            <p className="text-xs text-[#6E635D] max-w-2xl leading-relaxed">
              Enter natural-language purchase constraints. The agent extracts structured constraints, evaluates merchant
              offers, signs Ed25519 Intent &amp; Cart mandates, and binds the SHA-256 digest into PayPal Orders v2{' '}
              <code className="text-[#541827] font-mono bg-[#F2EBE0] px-1.5 py-0.5 rounded">custom_id</code>.
            </p>
          </div>

          {/* Policy Toggle */}
          <div className="bg-[#F8F3EB] p-1 rounded-xl border border-[#DCCDBB] flex items-center self-start text-xs">
            <button
              onClick={() => setPolicy('OPTIMAL')}
              className={`px-3 py-1.5 rounded-lg transition font-semibold ${
                policy === 'OPTIMAL'
                  ? 'bg-[#541827] text-white shadow-sm'
                  : 'text-[#6E635D] hover:text-[#292522]'
              }`}
            >
              Optimal Policy
            </button>
            <button
              onClick={() => setPolicy('FIRST_ACCEPTABLE')}
              className={`px-3 py-1.5 rounded-lg transition font-semibold ${
                policy === 'FIRST_ACCEPTABLE'
                  ? 'bg-[#BF4827] text-white shadow-sm'
                  : 'text-[#6E635D] hover:text-[#292522]'
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
              className="w-full bg-[#F8F3EB]/60 border border-[#DCCDBB] rounded-xl px-4 py-3 text-sm text-[#292522] focus:bg-white focus:outline-none focus:border-[#BF4827] font-medium placeholder-[#A3988E] pr-40"
              placeholder="e.g. USB-C docking station, at least 8 ports, HDMI 4K output, max total USD 120"
            />
            <button
              onClick={handlePurchase}
              disabled={isLoading}
              className="absolute right-3 bottom-3 px-4 py-2 bg-[#BF4827] hover:bg-[#A33B1E] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 shadow-sm"
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
            <span className="text-[#6E635D] font-medium">Presets:</span>
            <button
              onClick={() => {
                setPrompt('USB-C docking station, at least 8 ports, HDMI 4K output, max total USD 120, from a listed merchant.')
                setPolicy('OPTIMAL')
              }}
              className="px-2.5 py-1 bg-[#F8F3EB] hover:bg-[#F2EBE0] text-[#292522] border border-[#DCCDBB] rounded-lg font-medium transition"
            >
              Optimal Docking Station
            </button>
            <button
              onClick={() => {
                setPrompt('USB-C docking station, 8+ ports, max $120')
                setPolicy('FIRST_ACCEPTABLE')
              }}
              className="px-2.5 py-1 bg-[#FEF3DC] hover:bg-[#FDE8BD] text-[#9A5B13] border border-[#F5DEB0] rounded-lg font-medium transition"
            >
              First-Acceptable Policy (Triggers S3 Regret)
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-[#FAEDE9] border border-[#EBC4BA] rounded-xl text-xs text-[#BF4827] flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading && (
        <div className="bg-white border border-[#DCCDBB] rounded-2xl p-5 shadow-sm space-y-3 veripact-stagger-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#541827] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#BF4827] animate-ping" />
              Autonomous Agent Executing Mandate Pipeline...
            </span>
            <span className="font-mono text-[11px] text-[#6E635D]">Ed25519 + PayPal Orders v2</span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#F2EBE0] veripact-shimmer-bar" />
          <div className="grid grid-cols-3 gap-2 text-[11px] text-[#6E635D] font-mono">
            <span className="text-[#52705C] font-semibold">1. Parsing constraints</span>
            <span className="text-[#BF4827] font-semibold animate-pulse">2. Signing AP2 mandates</span>
            <span>3. Binding PayPal order</span>
          </div>
        </div>
      )}

      {/* Results View */}
      {purchaseResult && (
        <div className="space-y-6 veripact-page-enter">
          {/* Regret Warning Banner if triggered */}
          {purchaseResult.candidate_trace?.is_regret_flagged && (
            <div className="p-4 bg-[#FEF3DC] border border-[#F5DEB0] rounded-2xl flex items-start gap-3 text-[#9A5B13]">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-[#7D470C]">
                  Agent Regret Detected (Regret Index: {(purchaseResult.candidate_trace.regret_score * 100).toFixed(1)}%)
                </h4>
                <p className="text-xs text-[#8A5011] mt-1">
                  The agent operated under the <strong>First-Acceptable Offer</strong> policy and selected{' '}
                  <span className="font-semibold text-[#292522]">
                    {purchaseResult.candidate_trace.chosen_candidate?.title} (${purchaseResult.candidate_trace.chosen_candidate?.price})
                  </span>
                  , even though a mathematically superior offer{' '}
                  <span className="font-semibold text-[#292522]">
                    {purchaseResult.candidate_trace.best_candidate?.title} (${purchaseResult.candidate_trace.best_candidate?.price})
                  </span>{' '}
                  was available within the authorized constraints.
                </p>
              </div>
            </div>
          )}

          {/* AI Intent Extraction Inspector */}
          <div className="bg-white border border-[#DCCDBB] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#FAEDE9] border border-[#EBC4BA] text-[#BF4827]">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-[#292522]">Extracted Intent Constraints</div>
                <div className="text-[11px] text-[#6E635D]">
                  Mode:{' '}
                  <span className="font-mono text-[#541827] font-semibold">
                    {purchaseResult.llm_used ? 'LLM Structured Extractor' : 'Deterministic Constraint Parser'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              <span className="px-2.5 py-1 rounded-lg bg-[#F8F3EB] border border-[#DCCDBB] text-[#6E635D]">
                category: <strong className="text-[#292522]">{purchaseResult.intent?.constraints?.category}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#F8F3EB] border border-[#DCCDBB] text-[#6E635D]">
                min_ports: <strong className="text-[#BF4827]">{purchaseResult.intent?.constraints?.min_ports}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#F8F3EB] border border-[#DCCDBB] text-[#6E635D]">
                hdmi_4k:{' '}
                <strong className="text-[#52705C]">
                  {purchaseResult.intent?.constraints?.has_hdmi_4k ? 'required' : 'optional'}
                </strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#F8F3EB] border border-[#DCCDBB] text-[#6E635D]">
                max_spend: <strong className="text-[#52705C]">${purchaseResult.intent?.spend_cap}</strong>
              </span>
            </div>
          </div>

          {/* 3-Column Layout: Candidates, Mandates, PayPal Order */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Evaluated Candidate Trace */}
            <div className="bg-white border border-[#DCCDBB] rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#DCCDBB] pb-3">
                <h3 className="text-sm font-bold text-[#541827] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#BF4827]" />
                  Candidate Trace ({purchaseResult.candidate_trace?.evaluated_candidates?.length || 0})
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#F2EBE0] text-[#541827] font-semibold">
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
                          ? 'border-[#BF4827] bg-[#FDF6F3] shadow-sm'
                          : c.satisfies_constraints
                          ? 'border-[#DCCDBB] bg-[#F8F3EB] text-[#292522]'
                          : 'border-[#DCCDBB] bg-[#F8F3EB]/50 text-[#8C7F77] opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className={isSelected ? 'text-[#541827] font-bold' : 'text-[#292522]'}>
                          {c.title}
                        </span>
                        <span className="text-[#292522] font-mono">${c.price}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#6E635D] mt-1">
                        <span>{c.merchant_name} &bull; {c.ports_count} Ports</span>
                        <span>Utility: <strong>{(c.utility_score * 100).toFixed(0)}%</strong></span>
                      </div>
                      {isSelected && (
                        <div className="mt-2 text-[10px] font-semibold text-[#BF4827] bg-white border border-[#EBC4BA] px-2 py-0.5 rounded-full inline-block">
                          &check; Chosen by Agent
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Column 2: Cryptographic Mandate Pack */}
            <div className="bg-white border border-[#DCCDBB] rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#DCCDBB] pb-3">
                <h3 className="text-sm font-bold text-[#541827] flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#52705C]" />
                  AP2-Inspired Mandates
                </h3>
                <span className="text-[11px] font-mono text-[#52705C] bg-[#EDF2EE] px-2 py-0.5 rounded-full border border-[#C5D3C9] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Ed25519 Signed
                </span>
              </div>

              <div className="p-3.5 bg-[#F8F3EB] rounded-xl border border-[#DCCDBB] space-y-2 text-xs">
                <div className="font-semibold text-[#292522] flex items-center justify-between">
                  <span>IntentMandate (Buyer)</span>
                  <span className="text-[10px] font-mono text-[#6E635D]">{purchaseResult.intent?.id}</span>
                </div>
                <div className="text-[11px] text-[#574D48]">
                  Spend Cap: <strong className="text-[#52705C]">${purchaseResult.intent?.spend_cap}</strong> &bull; Min Ports: <strong>{purchaseResult.intent?.constraints?.min_ports}</strong>
                </div>
                <div className="text-[10px] font-mono text-[#6E635D] truncate">
                  Hash: {purchaseResult.cart?.intent_hash}
                </div>
              </div>

              <div className="p-3.5 bg-[#F8F3EB] rounded-xl border border-[#DCCDBB] space-y-2 text-xs">
                <div className="font-semibold text-[#292522] flex items-center justify-between">
                  <span>CartMandate (Agent)</span>
                  <span className="text-[10px] font-mono text-[#6E635D]">{purchaseResult.cart?.id}</span>
                </div>
                <div className="text-[11px] text-[#574D48]">
                  Total: <strong className="text-[#52705C]">${purchaseResult.cart?.total_amount}</strong> &bull; Merchant: <strong>{purchaseResult.cart?.merchant_id}</strong>
                </div>
                <div className="text-[10px] font-mono text-[#6E635D] truncate">
                  Links to: {purchaseResult.cart?.intent_hash?.slice(0, 24)}...
                </div>
              </div>

              <div className="p-3.5 bg-[#F2EBE0] rounded-xl border border-[#DCCDBB] text-xs space-y-1">
                <div className="text-[11px] text-[#541827] font-bold">Cryptographic Order Binding (SHA-256)</div>
                <div className="text-[10px] font-mono text-[#574D48] break-all">
                  {purchaseResult.order_binding}
                </div>
              </div>
            </div>

            {/* Column 3: PayPal Sandbox Order & Action */}
            <div className="bg-white border border-[#DCCDBB] rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-sm">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#DCCDBB] pb-3">
                  <h3 className="text-sm font-bold text-[#541827] flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-[#BF4827]" />
                    PayPal Sandbox Order
                  </h3>
                  <span
                    className={`text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
                      purchaseResult.status === 'COMPLETED'
                        ? 'bg-[#EDF2EE] text-[#52705C] border-[#C5D3C9]'
                        : purchaseResult.status === 'CANCELLED_BY_BUYER'
                        ? 'bg-[#FAEDE9] text-[#BF4827] border-[#EBC4BA]'
                        : 'bg-[#F2EBE0] text-[#541827] border-[#DCCDBB]'
                    }`}
                  >
                    {purchaseResult.status}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-[#6E635D]">
                    <span>Order ID:</span>
                    <span className="font-mono text-[#292522] font-semibold">{purchaseResult.order_id}</span>
                  </div>
                  {purchaseResult.capture_id && (
                    <div className="flex justify-between text-[#6E635D]">
                      <span>Capture ID:</span>
                      <span className="font-mono text-[#52705C] font-semibold">{purchaseResult.capture_id}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[#6E635D]">
                    <span>Item:</span>
                    <span className="text-[#292522] font-semibold truncate max-w-[180px]">{purchaseResult.chosen_item?.title}</span>
                  </div>
                  <div className="flex justify-between text-[#6E635D]">
                    <span>Total Amount:</span>
                    <span className="font-mono text-[#292522] font-bold">
                      ${purchaseResult.captured_amount || purchaseResult.chosen_item?.price} USD
                    </span>
                  </div>
                </div>

                {purchaseResult.capture_id ? (
                  <div
                    className={`p-3 rounded-xl border text-[11px] space-y-1 ${
                      purchaseResult.binding_verified
                        ? 'bg-[#EDF2EE] border-[#C5D3C9] text-[#52705C]'
                        : 'bg-[#FEF3DC] border-[#F5DEB0] text-[#9A5B13]'
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
                  <div className="p-3 bg-[#F8F3EB] rounded-xl border border-[#DCCDBB] text-[11px] text-[#574D48] space-y-1">
                    <div className="text-[#292522] font-semibold">Sandbox Checkout Flow (Create &rarr; Approve &rarr; Capture):</div>
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
                    className="w-full py-2.5 bg-[#541827] hover:bg-[#42121E] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition text-center"
                  >
                    1. Approve on PayPal Sandbox
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}

                {!purchaseResult.capture_id && purchaseResult.status !== 'CANCELLED_BY_BUYER' && (
                  <button
                    onClick={handleCaptureOrder}
                    disabled={isCapturing}
                    className="w-full py-2.5 bg-[#52705C] hover:bg-[#425C4B] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
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
                    className="w-full py-2 bg-[#FAEDE9] hover:bg-[#F9DCD5] text-[#BF4827] border border-[#EBC4BA] rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
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
