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
import '@bryntum/scheduler/stockholm-dark.css'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import { agentCourtGridTheme, VERDICT_STYLES } from '../agGridSetup'
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
          <span className="font-mono font-semibold text-white">{p.value}</span>
        ),
      },
      {
        headerName: 'Dispute ID',
        field: 'dispute_id',
        minWidth: 145,
        flex: 1,
        cellRenderer: (p: ICellRendererParams<CaseSummary>) => (
          <span className="font-mono text-slate-300">{p.value}</span>
        ),
      },
      {
        headerName: 'Amount',
        field: 'disputed_amount',
        width: 115,
        cellRenderer: (p: ICellRendererParams<CaseSummary>) => (
          <span className="font-mono font-semibold text-emerald-400">
            ${p.value} {p.data?.currency}
          </span>
        ),
      },
      {
        headerName: 'Arbiter Verdict',
        field: 'verdict',
        minWidth: 190,
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
          <span className="font-mono text-[11px] text-sky-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-700/80">
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
            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {p.data?.execution_mode === 'paypal_sandbox' ? 'Settled (Sandbox)' : 'Settled (Fallback)'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-300 font-medium text-xs">
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
          <span className="text-sky-400 font-semibold inline-flex items-center gap-1 text-xs">
            Inspect <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        ),
      },
    ],
    []
  )

  return (
    <div className="space-y-6">
      {/* Executive KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0b1120] border border-slate-800/90 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Dispute Cases</span>
            <div className="text-2xl font-bold text-white font-mono mt-1">{cases.length}</div>
            <span className="text-[11px] text-amber-300">{pendingCount} awaiting human approval</span>
          </div>
          <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0b1120] border border-slate-800/90 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Disputed Volume</span>
            <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">${totalExposure.toFixed(2)}</div>
            <span className="text-[11px] text-slate-400">USD across sandbox orders</span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0b1120] border border-slate-800/90 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Hash-Chain Ledger</span>
            <div className="text-2xl font-bold text-white font-mono mt-1">
              {ledgerStatus?.intact ? 'INTACT' : ledgerStatus ? 'ALERT' : '—'}
            </div>
            <span className="text-[11px] text-emerald-400 font-mono">
              {ledgerStatus ? `${ledgerStatus.total_entries} sealed SHA-256 entries` : 'Verifying...'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0b1120] border border-slate-800/90 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Webhook Events</span>
            <div className="text-2xl font-bold text-purple-300 font-mono mt-1">{webhookEvents.length}</div>
            <span className="text-[11px] text-slate-400">Deduplicated &amp; reconciled</span>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Webhook className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Action Toolbar */}
      <div className="bg-[#0b1120] border border-slate-800/90 rounded-2xl p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-sky-400" />
            Dispute Lifecycle Scheduler (Bryntum) &amp; Case Registry (AG Grid)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Track inquiry windows, automated evidence preparation blocks, and PayPal response due dates in real time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSimulateDeadlineShift}
            disabled={isShifting || cases.length === 0}
            className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 border border-purple-500/30 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${isShifting ? 'animate-pulse' : ''}`} />
            {isShifting ? 'Escalating...' : 'Simulate Webhook Deadline Shift'}
          </button>

          <button
            onClick={handleSyncPayPal}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded-xl bg-sky-600/15 hover:bg-sky-600/25 text-sky-300 border border-sky-500/30 text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Sandbox Disputes'}
          </button>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {[
              { id: 'ALL', label: `All (${cases.length})`, active: 'bg-sky-600 text-white' },
              { id: 'MERCHANT_AT_FAULT', label: 'Merchant', active: 'bg-amber-600 text-white' },
              { id: 'OPERATOR_AT_FAULT', label: 'Operator', active: 'bg-purple-600 text-white' },
              { id: 'WITHIN_MANDATE_REGRET', label: 'Regret', active: 'bg-cyan-600 text-white' },
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setFilterVerdict(pill.id)}
                className={`px-2.5 py-1 rounded-lg transition font-medium ${
                  filterVerdict === pill.id ? pill.active : 'text-slate-400 hover:text-white'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="p-4 bg-[#0b1120] border border-slate-800 rounded-xl text-xs text-sky-400 flex items-center gap-2">
          <div className="w-3.5 h-3.5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <span>Synchronizing Bryntum Scheduler &amp; AG Grid registry...</span>
        </div>
      )}

      {syncMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-xs text-emerald-300 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-300 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Real Bryntum Scheduler Component */}
      <div className="bg-[#0b1120] border border-slate-800/90 rounded-2xl p-5 shadow-lg shadow-black/20 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-3 gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              Bryntum Scheduler — Case Lifecycle &amp; Deadlines
            </span>
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[11px]">
              <button
                onClick={() => setViewPreset('dayAndWeek')}
                className={`px-2 py-0.5 rounded-md transition ${
                  viewPreset === 'dayAndWeek' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400'
                }`}
              >
                Day / Week
              </button>
              <button
                onClick={() => setViewPreset('hourAndDay')}
                className={`px-2 py-0.5 rounded-md transition ${
                  viewPreset === 'hourAndDay' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400'
                }`}
              >
                Hour / Day
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500" /> Inquiry Window
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Evidence Prep
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Seller Due Date
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Executed
            </span>
          </div>
        </div>

        <div
          className="agentcourt-bryntum-host w-full"
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
      <div className="bg-[#0b1120] border border-slate-800/90 rounded-2xl overflow-hidden shadow-lg shadow-black/20">
        <div className="px-5 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/50">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Dispute Cases Registry (AG Grid) &mdash; {filteredCases.length} Cases
            </h3>
            <p className="text-[11px] text-slate-400">
              Sort, filter, or click any row to open the full cryptographic evidence pack and AI semantic comparison.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              placeholder="Quick filter cases..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        <div className="p-4">
          <div className="w-full rounded-xl overflow-hidden border border-slate-800">
            <AgGridReact<CaseSummary>
              theme={agentCourtGridTheme}
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
        <div className="bg-[#0b1120] border border-slate-800/90 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Webhook className="w-4 h-4 text-purple-400" />
              Recent PayPal Webhook Audit Stream ({webhookEvents.length})
            </h3>
            <span className="text-[11px] font-mono text-slate-500">POST /api/webhooks/paypal</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
            {webhookEvents.slice(0, 6).map((w) => (
              <div
                key={w.event_id}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-mono text-[11px] font-semibold text-white truncate">{w.event_type}</div>
                  <div className="font-mono text-[10px] text-slate-500 truncate">{w.event_id}</div>
                </div>
                <span
                  className={`shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    w.verified
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
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
