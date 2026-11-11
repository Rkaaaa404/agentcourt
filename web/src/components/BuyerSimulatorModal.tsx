import { useEffect, useState } from 'react'
import { X, AlertCircle, ShieldAlert, CheckCircle2 } from 'lucide-react'

interface BuyerSimulatorModalProps {
  isOpen: boolean
  onClose: () => void
  onDisputeCreated: (caseId: string) => void
  initialOrderId?: string
  initialCaptureId?: string
  initialAmount?: string
}

export default function BuyerSimulatorModal({
  isOpen,
  onClose,
  onDisputeCreated,
  initialOrderId,
  initialCaptureId,
  initialAmount,
}: BuyerSimulatorModalProps) {
  const [orderId, setOrderId] = useState('ORDER-SANDBOX-S1-VP')
  const [captureId, setCaptureId] = useState('')
  const [amount, setAmount] = useState('95.00')
  const [reason, setReason] = useState('MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED')
  const [notes, setNotes] = useState('Delivered unit has only 6 ports instead of 8 ports promised in listing.')
  const [useLiveSandbox, setUseLiveSandbox] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    if (initialOrderId) setOrderId(initialOrderId)
    if (initialCaptureId) {
      setCaptureId(initialCaptureId)
      setUseLiveSandbox(true)
    } else if (!initialOrderId) {
      setCaptureId('')
      setUseLiveSandbox(false)
    }
    if (initialAmount) setAmount(initialAmount)
    setError(null)
  }, [isOpen, initialOrderId, initialCaptureId, initialAmount])

  if (!isOpen) return null

  const handleApplyPreset = (presetNotes: string, presetReason: string, presetAmount: string) => {
    setNotes(presetNotes)
    setReason(presetReason)
    setAmount(presetAmount)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const resp = await fetch('/api/cases/simulate-buyer-dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          amount: parseFloat(amount),
          reason: reason,
          inspection_notes: notes,
          buyer_transaction_id: captureId.trim() || null,
          use_live_sandbox: useLiveSandbox && Boolean(captureId.trim()),
        }),
      })

      if (!resp.ok) {
        const errData = await resp.json()
        throw new Error(errData.detail || 'Failed to simulate dispute')
      }

      const data = await resp.json()
      onDisputeCreated(data.case_id)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error creating dispute')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                Sandbox Buyer Simulator
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Simulated Buyer Party
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Creates a dispute on a captured sandbox transaction or labeled test fixture.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Presets */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Quick Test Presets (Hackathon Scenarios):
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() =>
                  handleApplyPreset(
                    'Delivered unit has only 6 ports instead of 8 ports promised in listing.',
                    'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
                    '95.00'
                  )
                }
                className="p-2.5 rounded-lg border border-slate-800 bg-slate-950 hover:border-amber-500/40 text-left transition text-slate-300"
              >
                <div className="font-semibold text-amber-400">S1: Port Mismatch</div>
                <div className="text-[11px] text-slate-400 line-clamp-1">Expected: Merchant at fault (Refund)</div>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleApplyPreset(
                    'Item missing required 4K HDMI capability; only 1080p detected.',
                    'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
                    '89.00'
                  )
                }
                className="p-2.5 rounded-lg border border-slate-800 bg-slate-950 hover:border-amber-500/40 text-left transition text-slate-300"
              >
                <div className="font-semibold text-sky-400">4K HDMI Missing</div>
                <div className="text-[11px] text-slate-400 line-clamp-1">Expected: Merchant at fault (Refund)</div>
              </button>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target PayPal Order ID</label>
              <input
                type="text"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Disputed Amount (USD)</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              PayPal Capture ID <span className="text-slate-500">(optional, for live Sandbox Disputes API)</span>
            </label>
            <input
              type="text"
              value={captureId}
              onChange={(e) => setCaptureId(e.target.value)}
              placeholder="e.g. 8XY12345AB678901C (auto-filled after Capture)"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono placeholder-slate-600"
            />
          </div>

          {captureId.trim() && (
            <label className="flex items-start gap-2 text-[11px] text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={useLiveSandbox}
                onChange={(e) => setUseLiveSandbox(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 bg-slate-900 text-sky-500"
              />
              <span>
                Attempt real <code className="text-sky-400">POST /v1/customer/disputes</code> via{' '}
                <code className="text-sky-400">PayPal-Auth-Assertion</code> (falls back cleanly to labeled fixture if sandbox account lacks{' '}
                <code className="text-amber-300">DISPUTE_CREATE</code> scope).
              </span>
            </label>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Dispute Reason (PayPal API)</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED">
                MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED (SNAD)
              </option>
              <option value="MERCHANDISE_OR_SERVICE_NOT_RECEIVED">
                MERCHANDISE_OR_SERVICE_NOT_RECEIVED (INR)
              </option>
              <option value="UNAUTHORISED">UNAUTHORISED</option>
              <option value="CREDIT_NOT_PROCESSED">CREDIT_NOT_PROCESSED</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Physical Delivery Inspection Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 shadow-md shadow-amber-600/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? 'Creating Dispute...' : 'Create Sandbox Dispute'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
