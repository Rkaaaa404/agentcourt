import { useState, useEffect, useMemo } from 'react'
import {
  Calendar,
  AlertCircle,
  ArrowUpRight,
  ShieldAlert,
  Clock,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Webhook,
  Search,
  Zap,
  DollarSign,
} from 'lucide-react'
import { BryntumScheduler } from '@bryntum/scheduler-react'
import '@bryntum/scheduler/scheduler.css'
import '@bryntum/scheduler/stockholm-light.css'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import { veripactGridTheme, VERDICT_STYLES } from '../agGridSetup'
import { useCountUp, useInViewReveal } from '../hooks/useMotion'
import ScrollReveal from '../components/ScrollReveal'
import { CaseSummary } from '../types'

interface CasesTimelineViewProps {
  onSelectCase: (caseId: string) => void
}

interface WebhookEventSummary {
  event_id: string
  event_type: string
  verified: boolean
  received_at: number
}

interface LedgerVerifySummary {
  intact: boolean
  total_entries: number
  latest_hash: string | null
}

export default function CasesTimelineView({ onSelectCase }: CasesTimelineViewProps) {
  const [cases, setCases] = useState<CaseSummary[]>([])
  const [timelineData, setTimelineData] = useState<any | null>(null)
  const [webhookEvents, setWebhookEvents] = useState<WebhookEventSummary[]>([])
  const [ledgerStatus, setLedgerStatus] = useState<LedgerVerifySummary | null>(null)
  const [filterVerdict, setFilterVerdict] = useState<string>('ALL')
  const [viewPreset, setViewPreset] = useState<'dayAndWeek' | 'hourAndDay'>('dayAndWeek')
  const [quickFilter, setQuickFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isShifting, setIsShifting] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [casesResp, timelineResp, whResp, ledgerResp] = await Promise.all([
        fetch('/api/cases'),
        fetch('/api/cases/timeline'),
        fetch('/api/webhooks/events'),
        fetch('/api/cases/ledger/verify'),
      ])

      if (!casesResp.ok || !timelineResp.ok) {
        throw new Error('Failed to load cases or timeline data')
      }

      const [casesJson, timelineJson] = await Promise.all([casesResp.json(), timelineResp.json()])
      setCases(casesJson)
      setTimelineData(timelineJson)

      if (whResp.ok) {
        const whJson = await whResp.json()
        setWebhookEvents(whJson.events || [])
      }
      if (ledgerResp.ok) {
        setLedgerStatus(await ledgerResp.json())
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSyncPayPal = async () => {
    setIsSyncing(true)
    setSyncMessage(null)
    setError(null)
    try {
      const resp = await fetch('/api/cases/sync-paypal', { method: 'POST' })
      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data.detail || 'PayPal sync failed')
      }
      setSyncMessage(`Synced ${data.synced_count} dispute(s) from PayPal Sandbox Disputes API.`)
      await fetchData()
    } catch (err: any) {
      setError(err.message || 'Error syncing PayPal disputes')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleSimulateDeadlineShift = async () => {
    const targetCase = filteredCases[0] || cases[0]
    if (!targetCase) return
    setIsShifting(true)
    setSyncMessage(null)
    setError(null)
    try {
      const resp = await fetch(`/api/cases/${encodeURIComponent(targetCase.case_id)}/simulate-webhook-update`, {
        method: 'POST',
      })
      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data.detail || 'Failed to simulate webhook deadline shift')
      }
      setSyncMessage(
        `Webhook ${data.webhook_event_id} escalated ${data.case_id} to ${data.lifecycle_stage} — Bryntum prep & due-date markers rescheduled to ${data.seller_response_due_date}.`
      )
      await fetchData()
    } catch (err: any) {
      setError(err.message || 'Error simulating webhook escalation')
    } finally {
      setIsShifting(false)
    }
  }

  const filteredCases = useMemo(
    () =>
      cases.filter((c) => {
        if (filterVerdict === 'ALL') return true
        return c.verdict === filterVerdict
      }),
    [cases, filterVerdict]
  )

  const totalExposure = useMemo(
    () => cases.reduce((acc, c) => acc + (parseFloat(c.disputed_amount) || 0), 0),
    [cases]
  )

  const pendingCount = useMemo(() => cases.filter((c) => !c.executed).length, [cases])

  const animatedCasesCount = useCountUp(cases.length, 800, 0)
  const animatedExposure = useCountUp(totalExposure, 900, 2)
  const animatedLedgerEntries = useCountUp(ledgerStatus?.total_entries || 0, 850, 0)
  const animatedWebhookCount = useCountUp(webhookEvents.length, 750, 0)
  const schedulerReveal = useInViewReveal(0.08)

  const filteredResources = useMemo(() => {
    const rows = timelineData?.resources?.rows || []
    if (filterVerdict === 'ALL') return rows
    return rows.filter((r: any) => r.verdict === filterVerdict)
  }, [timelineData, filterVerdict])

  const filteredEvents = useMemo(() => {
    const allowedIds = new Set(filteredResources.map((r: any) => r.id))
    const rows = timelineData?.events?.rows || []
    return rows.filter((e: any) => allowedIds.has(e.resourceId))
  }, [timelineData, filteredResources])

  const schedulerColumns = useMemo(
    () => [
      { text: 'Case ID', field: 'name', width: 175 },
      { text: 'PayPal Dispute', field: 'dispute_id', width: 140 },
      { text: 'Verdict', field: 'verdict', width: 165 },
      { text: 'Amount', field: 'amount', width: 100 },
    ],
    []
  )

  const agColumnDefs = useMemo<ColDef<CaseSummary>[]>(
    () => [
      {
        headerName: 'Case ID',
        field: 'case_id',
        minWidth: 195,
        flex: 1.2,
        cellRenderer: (p: ICellRendererParams<CaseSummary>) => (
          <span className="font-mono font-semibold text-[#292522]">{p.value}</span>
        ),
      },
      {
        headerName: 'Dispute ID',
        field: 'dispute_id',
        minWidth: 145,
        flex: 1,
        cellRenderer: (p: ICellRendererParams<CaseSummary>) => (
          <span className="font-mono text-[#6E635D]">{p.value}</span>
        ),
      },
      {
        headerName: 'Amount',
        field: 'disputed_amount',
        width: 120,
        cellRenderer: (p: ICellRendererParams<CaseSummary>) => (
          <span className="font-mono font-semibold text-[#292522] tabular-nums">
            ${p.value} {p.data?.currency}
          </span>
        ),
      },
      {
        headerName: 'Arbiter Verdict',
        field: 'verdict',
        minWidth: 195,
        flex: 1.1,
        cellRenderer: (p: ICellRendererParams<CaseSummary>) => {
          const st = VERDICT_STYLES[p.value] || VERDICT_STYLES.NEEDS_HUMAN
          return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${st.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
              {p.value}
            </span>
          )
        },
      },
      {
        headerName: 'Planned PayPal Action',
        field: 'action_type',
        width: 155,
        cellRenderer: (p: ICellRendererParams<CaseSummary>) => (
          <span className="font-mono text-[11px] text-[#541827] bg-[#F2EBE0] px-2.5 py-0.5 rounded-md border border-[#DCCDBB]">
            {p.value}
          </span>
        ),
      },
      {
        headerName: 'Stage / Status',
        field: 'executed',
        minWidth: 175,
        flex: 1,
        cellRenderer: (p: ICellRendererParams<CaseSummary>) =>
          p.value ? (
            <span className="inline-flex items-center gap-1 text-[#52705C] font-semibold text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {p.data?.execution_mode === 'paypal_sandbox' ? 'Settled (Sandbox)' : 'Settled (Fallback)'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[#9A5B13] font-semibold text-xs">
              <Clock className="w-3.5 h-3.5" />
              {p.data?.lifecycle_stage || 'INQUIRY'} (Pending)
            </span>
          ),
      },
      {
        headerName: 'Inspect',
        field: 'case_id',
        width: 105,
        sortable: false,
        filter: false,
        cellRenderer: () => (
          <span className="text-[#BF4827] font-semibold inline-flex items-center gap-1 text-xs">
            Inspect <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        ),
      },
    ],
    []
  )

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Executive KPI Strip */}
      <ScrollReveal delayMs={0}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#DCCDBB] rounded-2xl p-4 flex items-center justify-between shadow-sm veripact-stagger-1 veripact-card-hover relative overflow-hidden">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#6E635D] font-semibold">Dispute Cases</span>
            <div className="text-2xl font-extrabold text-[#541827] tabular-nums mt-1">{animatedCasesCount}</div>
            <span className="text-[11px] text-[#9A5B13] font-medium">{pendingCount} awaiting approval</span>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="p-2.5 rounded-xl bg-[#FAEDE9] border border-[#EBC4BA] text-[#BF4827]">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <svg viewBox="0 0 60 18" className="w-14 h-4 overflow-visible" aria-hidden="true">
              <path d="M 2 14 C 15 14, 20 6, 32 9 C 42 12, 48 4, 56 4" fill="none" stroke="#BF4827" strokeWidth="1.8" className="animate-draw-path" />
              <circle cx="56" cy="4" r="3" fill="#BF4827" className="animate-ping-slow" />
              <circle cx="56" cy="4" r="2" fill="#BF4827" />
            </svg>
          </div>
        </div>

        <div className="bg-white border border-[#DCCDBB] rounded-2xl p-4 flex items-center justify-between shadow-sm veripact-stagger-2 veripact-card-hover relative overflow-hidden">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#6E635D] font-semibold">Disputed Volume</span>
            <div className="text-2xl font-extrabold text-[#541827] tabular-nums mt-1">${animatedExposure.toFixed(2)}</div>
            <span className="text-[11px] text-[#6E635D]">USD across sandbox orders</span>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="p-2.5 rounded-xl bg-[#EDF2EE] border border-[#C5D3C9] text-[#52705C]">
              <DollarSign className="w-5 h-5" />
            </div>
            <svg viewBox="0 0 60 18" className="w-14 h-4 overflow-visible" aria-hidden="true">
              <path d="M 2 15 C 14 12, 24 14, 34 8 C 44 4, 50 6, 56 3" fill="none" stroke="#52705C" strokeWidth="1.8" className="animate-draw-path" />
              <circle cx="56" cy="3" r="3" fill="#52705C" className="animate-ping-slow" />
              <circle cx="56" cy="3" r="2" fill="#52705C" />
            </svg>
          </div>
        </div>

        <div className="bg-white border border-[#DCCDBB] rounded-2xl p-4 flex items-center justify-between shadow-sm veripact-stagger-3 veripact-card-hover">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#6E635D] font-semibold">Hash-Chain Ledger</span>
            <div className="text-2xl font-extrabold text-[#541827] font-mono mt-1 flex items-center gap-2">
              {ledgerStatus?.intact ? 'INTACT' : ledgerStatus ? 'ALERT' : '—'}
              {ledgerStatus?.intact && <span className="w-2 h-2 rounded-full bg-[#52705C] animate-pulse" />}
            </div>
            <span className="text-[11px] text-[#52705C] font-mono">
              {ledgerStatus ? `${animatedLedgerEntries} SHA-256 entries` : 'Verifying...'}
            </span>
          </div>
          <div className="relative p-2.5 rounded-xl bg-[#EDF2EE] border border-[#C5D3C9] text-[#52705C]">
            <ShieldCheck className="w-5 h-5 relative z-10" />
            <svg viewBox="0 0 36 36" className="absolute -inset-1 w-12 h-12 animate-radar-spin opacity-45 pointer-events-none" fill="none" aria-hidden="true">
              <circle cx="18" cy="18" r="16" stroke="#52705C" strokeWidth="1.2" strokeDasharray="4 4" />
            </svg>
          </div>
        </div>

        <div className="bg-white border border-[#DCCDBB] rounded-2xl p-4 flex items-center justify-between shadow-sm veripact-stagger-4 veripact-card-hover">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#6E635D] font-semibold">Webhook Events</span>
            <div className="text-2xl font-extrabold text-[#541827] tabular-nums mt-1">{animatedWebhookCount}</div>
            <span className="text-[11px] text-[#6E635D]">Deduplicated &amp; reconciled</span>
          </div>
          <div className="relative p-2.5 rounded-xl bg-[#F2EBE0] border border-[#DCCDBB] text-[#541827]">
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#BF4827] animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#BF4827]" />
            <Webhook className="w-5 h-5" />
          </div>
        </div>
      </div>
      </ScrollReveal>

      {/* Filter & Action Toolbar */}
      <div
        ref={schedulerReveal.ref}
        className={`bg-white border border-[#DCCDBB] rounded-2xl p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-sm transition-all duration-700 ${
          schedulerReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div>
          <h2 className="font-serif text-xl font-bold text-[#541827] flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#BF4827]" />
            Dispute Lifecycle Scheduler (Bryntum) &amp; Case Registry (AG Grid)
          </h2>
          <p className="text-xs text-[#6E635D] mt-0.5">
            Track inquiry windows, automated evidence preparation blocks, and PayPal response due dates in real time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSimulateDeadlineShift}
            disabled={isShifting || cases.length === 0}
            className="px-3 py-1.5 rounded-xl bg-[#F2EBE0] hover:bg-[#EDE6DA] text-[#541827] border border-[#DCCDBB] text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 text-[#BF4827] ${isShifting ? 'animate-pulse' : ''}`} />
            {isShifting ? 'Escalating...' : 'Simulate Webhook Deadline Shift'}
          </button>

          <button
            onClick={handleSyncPayPal}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#F8F3EB] text-[#292522] border border-[#DCCDBB] text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#BF4827] ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Sandbox Disputes'}
          </button>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1 bg-[#F8F3EB] p-1 rounded-xl border border-[#DCCDBB] text-xs">
            {[
              { id: 'ALL', label: `All (${cases.length})` },
              { id: 'MERCHANT_AT_FAULT', label: 'Merchant' },
              { id: 'OPERATOR_AT_FAULT', label: 'Operator' },
              { id: 'WITHIN_MANDATE_REGRET', label: 'Regret' },
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setFilterVerdict(pill.id)}
                className={`px-2.5 py-1 rounded-lg transition font-semibold ${
                  filterVerdict === pill.id
                    ? 'bg-[#BF4827] text-white shadow-sm'
                    : 'text-[#6E635D] hover:text-[#292522]'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="p-4 bg-white border border-[#DCCDBB] rounded-xl text-xs text-[#BF4827] flex items-center gap-2 shadow-sm">
          <div className="w-3.5 h-3.5 border-2 border-[#BF4827] border-t-transparent rounded-full animate-spin" />
          <span>Synchronizing Bryntum Scheduler &amp; AG Grid registry...</span>
        </div>
      )}

      {syncMessage && (
        <div className="p-4 bg-[#EDF2EE] border border-[#C5D3C9] rounded-xl text-xs text-[#52705C] flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-[#FAEDE9] border border-[#EBC4BA] rounded-xl text-xs text-[#BF4827] flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Real Bryntum Scheduler Component */}
      <div className="bg-white border border-[#DCCDBB] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#DCCDBB] pb-3 gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-[#541827] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#BF4827]" />
              Bryntum Scheduler — Case Lifecycle &amp; Deadlines
            </span>
            <div className="flex items-center bg-[#F8F3EB] border border-[#DCCDBB] rounded-lg p-0.5 text-[11px]">
              <button
                onClick={() => setViewPreset('dayAndWeek')}
                className={`px-2 py-0.5 rounded-md transition ${
                  viewPreset === 'dayAndWeek' ? 'bg-white text-[#292522] font-semibold shadow-sm' : 'text-[#6E635D]'
                }`}
              >
                Day / Week
              </button>
              <button
                onClick={() => setViewPreset('hourAndDay')}
                className={`px-2 py-0.5 rounded-md transition ${
                  viewPreset === 'hourAndDay' ? 'bg-white text-[#292522] font-semibold shadow-sm' : 'text-[#6E635D]'
                }`}
              >
                Hour / Day
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#6E635D]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Inquiry Window
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Evidence Prep
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#BF4827]" /> Seller Due Date
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#52705C]" /> Executed
            </span>
          </div>
        </div>

        <div
          className="veripact-bryntum-host w-full"
          style={{ height: Math.max(270, filteredResources.length * 56 + 100) }}
        >
          {timelineData && (
            <BryntumScheduler
              height={Math.max(270, filteredResources.length * 56 + 100)}
              rowHeight={52}
              barMargin={8}
              readOnly={true}
              eventTooltipFeature={true}
              viewPreset={viewPreset}
              startDate={timelineData.startDate}
              endDate={timelineData.endDate}
              columns={schedulerColumns}
              resources={filteredResources}
              events={filteredEvents}
              eventRenderer={({ eventRecord }) => {
                const name = String(eventRecord.get('name') || '')
                const stage = String(eventRecord.get('lifecycleStage') || '')
                return stage ? `${name} · ${stage}` : name
              }}
              onEventClick={({ resourceRecord }) => {
                if (resourceRecord?.id) {
                  onSelectCase(String(resourceRecord.id))
                }
              }}
            />
          )}
        </div>
      </div>

      {/* AG Grid Dispute Cases Registry */}
      <div className="bg-white border border-[#DCCDBB] rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-[#DCCDBB] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FCF9F4]">
          <div>
            <h3 className="text-sm font-bold text-[#541827] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#BF4827]" />
              Dispute Cases Registry (AG Grid) &mdash; {filteredCases.length} Cases
            </h3>
            <p className="text-[11px] text-[#6E635D]">
              Sort, filter, or click any row to open the full cryptographic evidence pack and AI semantic comparison.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#8C7F77] absolute left-3 top-2.5" />
            <input
              type="text"
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              placeholder="Quick filter cases..."
              className="w-full bg-white border border-[#DCCDBB] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#292522] focus:outline-none focus:border-[#BF4827]"
            />
          </div>
        </div>

        <div className="p-4">
          <div className="w-full rounded-xl overflow-hidden border border-[#DCCDBB]">
            <AgGridReact<CaseSummary>
              theme={veripactGridTheme}
              rowData={filteredCases}
              columnDefs={agColumnDefs}
              quickFilterText={quickFilter}
              domLayout="autoHeight"
              defaultColDef={{
                sortable: true,
                resizable: true,
                filter: true,
              }}
              onRowClicked={(ev) => {
                if (ev.data?.case_id) {
                  onSelectCase(ev.data.case_id)
                }
              }}
              rowStyle={{ cursor: 'pointer' }}
            />
          </div>
        </div>
      </div>

      {/* Recent PayPal Webhook Activity */}
      {webhookEvents.length > 0 && (
        <div className="bg-white border border-[#DCCDBB] rounded-2xl p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#541827] flex items-center gap-2">
              <Webhook className="w-4 h-4 text-[#BF4827]" />
              Recent PayPal Webhook Audit Stream ({webhookEvents.length})
            </h3>
            <span className="text-[11px] font-mono text-[#6E635D]">POST /api/webhooks/paypal</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
            {webhookEvents.slice(0, 6).map((w) => (
              <div
                key={w.event_id}
                className="p-3 rounded-xl bg-[#F8F3EB] border border-[#DCCDBB] flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-mono text-[11px] font-semibold text-[#292522] truncate">{w.event_type}</div>
                  <div className="font-mono text-[10px] text-[#6E635D] truncate">{w.event_id}</div>
                </div>
                <span
                  className={`shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    w.verified
                      ? 'bg-[#EDF2EE] text-[#52705C] border-[#C5D3C9]'
                      : 'bg-white text-[#6E635D] border-[#DCCDBB]'
                  }`}
                >
                  {w.verified ? 'Verified' : 'Simulated'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
