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
          <span className="font-mono font-semibold text-slate-900">{p.value}</span>
        ),
      },
      {
        headerName: 'Dispute ID',
        field: 'dispute_id',
        minWidth: 145,
        flex: 1,
        cellRenderer: (p: ICellRendererParams<CaseSummary>) => (
          <span className="font-mono text-slate-600">{p.value}</span>
        ),
      },
      {
        headerName: 'Amount',
        field: 'disputed_amount',
        width: 120,
        cellRenderer: (p: ICellRendererParams<CaseSummary>) => (
          <span className="font-mono font-semibold text-slate-900 tabular-nums">
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
          <span className="font-mono text-[11px] text-[#1D6CE0] bg-[#EFF6FF] px-2.5 py-0.5 rounded-md border border-blue-200">
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
            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {p.data?.execution_mode === 'paypal_sandbox' ? 'Settled (Sandbox)' : 'Settled (Fallback)'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-700 font-semibold text-xs">
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
          <span className="text-[#1D6CE0] font-semibold inline-flex items-center gap-1 text-xs">
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Dispute Cases</span>
            <div className="text-2xl font-extrabold text-slate-900 tabular-nums mt-1">{cases.length}</div>
            <span className="text-[11px] text-amber-700 font-medium">{pendingCount} awaiting approval</span>
          </div>
          <div className="p-2.5 rounded-xl bg-[#EFF6FF] border border-blue-100 text-[#1D6CE0]">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Disputed Volume</span>
            <div className="text-2xl font-extrabold text-slate-900 tabular-nums mt-1">${totalExposure.toFixed(2)}</div>
            <span className="text-[11px] text-slate-500">USD across sandbox orders</span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Hash-Chain Ledger</span>
            <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
              {ledgerStatus?.intact ? 'INTACT' : ledgerStatus ? 'ALERT' : '—'}
            </div>
            <span className="text-[11px] text-emerald-700 font-mono">
              {ledgerStatus ? `${ledgerStatus.total_entries} SHA-256 entries` : 'Verifying...'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Webhook Events</span>
            <div className="text-2xl font-extrabold text-slate-900 tabular-nums mt-1">{webhookEvents.length}</div>
            <span className="text-[11px] text-slate-500">Deduplicated &amp; reconciled</span>
          </div>
          <div className="p-2.5 rounded-xl bg-[#EFF6FF] border border-blue-100 text-[#1D6CE0]">
            <Webhook className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Action Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#1D6CE0]" />
            Dispute Lifecycle Scheduler (Bryntum) &amp; Case Registry (AG Grid)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track inquiry windows, automated evidence preparation blocks, and PayPal response due dates in real time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSimulateDeadlineShift}
            disabled={isShifting || cases.length === 0}
            className="px-3 py-1.5 rounded-xl bg-[#EFF6FF] hover:bg-blue-100 text-[#1D6CE0] border border-blue-200 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${isShifting ? 'animate-pulse' : ''}`} />
            {isShifting ? 'Escalating...' : 'Simulate Webhook Deadline Shift'}
          </button>

          <button
            onClick={handleSyncPayPal}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#1D6CE0] ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Sandbox Disputes'}
          </button>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
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
                    ? 'bg-[#1D6CE0] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="p-4 bg-white border border-slate-200 rounded-xl text-xs text-[#1D6CE0] flex items-center gap-2 shadow-sm">
          <div className="w-3.5 h-3.5 border-2 border-[#1D6CE0] border-t-transparent rounded-full animate-spin" />
          <span>Synchronizing Bryntum Scheduler &amp; AG Grid registry...</span>
        </div>
      )}

      {syncMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{syncMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Real Bryntum Scheduler Component */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-3 gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#1D6CE0]" />
              Bryntum Scheduler — Case Lifecycle &amp; Deadlines
            </span>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 text-[11px]">
              <button
                onClick={() => setViewPreset('dayAndWeek')}
                className={`px-2 py-0.5 rounded-md transition ${
                  viewPreset === 'dayAndWeek' ? 'bg-white text-slate-900 font-semibold shadow-sm' : 'text-slate-500'
                }`}
              >
                Day / Week
              </button>
              <button
                onClick={() => setViewPreset('hourAndDay')}
                className={`px-2 py-0.5 rounded-md transition ${
                  viewPreset === 'hourAndDay' ? 'bg-white text-slate-900 font-semibold shadow-sm' : 'text-slate-500'
                }`}
              >
                Hour / Day
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Inquiry Window
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Evidence Prep
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Seller Due Date
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Executed
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
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#1D6CE0]" />
              Dispute Cases Registry (AG Grid) &mdash; {filteredCases.length} Cases
            </h3>
            <p className="text-[11px] text-slate-500">
              Sort, filter, or click any row to open the full cryptographic evidence pack and AI semantic comparison.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              placeholder="Quick filter cases..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
            />
          </div>
        </div>

        <div className="p-4">
          <div className="w-full rounded-xl overflow-hidden border border-slate-200">
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
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Webhook className="w-4 h-4 text-[#1D6CE0]" />
              Recent PayPal Webhook Audit Stream ({webhookEvents.length})
            </h3>
            <span className="text-[11px] font-mono text-slate-500">POST /api/webhooks/paypal</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
            {webhookEvents.slice(0, 6).map((w) => (
              <div
                key={w.event_id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-mono text-[11px] font-semibold text-slate-900 truncate">{w.event_type}</div>
                  <div className="font-mono text-[10px] text-slate-500 truncate">{w.event_id}</div>
                </div>
                <span
                  className={`shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    w.verified
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-white text-slate-600 border-slate-200'
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
