import { useState, useEffect, useMemo } from 'react'
import {
  Calendar,
  AlertCircle,
  ArrowUpRight,
  ShieldAlert,
  Clock,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'
import { BryntumScheduler } from '@bryntum/scheduler-react'
import '@bryntum/scheduler/scheduler.css'
import '@bryntum/scheduler/stockholm-dark.css'
import { CaseSummary, VerdictType } from '../types'

interface CasesTimelineViewProps {
  onSelectCase: (caseId: string) => void
}

export default function CasesTimelineView({ onSelectCase }: CasesTimelineViewProps) {
  const [cases, setCases] = useState<CaseSummary[]>([])
  const [timelineData, setTimelineData] = useState<any | null>(null)
  const [filterVerdict, setFilterVerdict] = useState<string>('ALL')
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [casesResp, timelineResp] = await Promise.all([
        fetch('/api/cases'),
        fetch('/api/cases/timeline'),
      ])

      if (!casesResp.ok || !timelineResp.ok) {
        throw new Error('Failed to load cases or timeline data')
      }

      const casesJson = await casesResp.json()
      const timelineJson = await timelineResp.json()

      setCases(casesJson)
      setTimelineData(timelineJson)
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

  const filteredCases = useMemo(
    () =>
      cases.filter((c) => {
        if (filterVerdict === 'ALL') return true
        return c.verdict === filterVerdict
      }),
    [cases, filterVerdict]
  )

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
      { text: 'Case', field: 'name', width: 175 },
      { text: 'Dispute ID', field: 'dispute_id', width: 145 },
      { text: 'Verdict', field: 'verdict', width: 165 },
      { text: 'Amount', field: 'amount', width: 105 },
    ],
    []
  )

  const getVerdictBadge = (verdict: VerdictType) => {
    switch (verdict) {
      case 'MERCHANT_AT_FAULT':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            MERCHANT_AT_FAULT
          </span>
        )
      case 'OPERATOR_AT_FAULT':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            OPERATOR_AT_FAULT
          </span>
        )
      case 'WITHIN_MANDATE_REGRET':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            WITHIN_MANDATE_REGRET
          </span>
        )
      case 'NO_FAULT':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            NO_FAULT
          </span>
        )
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
            NEEDS_HUMAN
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-sky-400" />
            Dispute Cases Timeline &amp; Bryntum Scheduler
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Interactive Bryntum Scheduler mapping inquiry windows, auto-scheduled evidence preparation blocks, and
            PayPal seller response due dates. Click any timeline event or table row to inspect the evidence pack.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSyncPayPal}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded-xl bg-sky-600/15 hover:bg-sky-600/25 text-sky-300 border border-sky-500/30 text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing PayPal...' : 'Sync Sandbox Disputes'}
          </button>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setFilterVerdict('ALL')}
              className={`px-3 py-1.5 rounded-lg transition font-medium ${
                filterVerdict === 'ALL' ? 'bg-sky-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({cases.length})
            </button>
            <button
              onClick={() => setFilterVerdict('MERCHANT_AT_FAULT')}
              className={`px-3 py-1.5 rounded-lg transition font-medium ${
                filterVerdict === 'MERCHANT_AT_FAULT'
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Merchant Breach
            </button>
            <button
              onClick={() => setFilterVerdict('OPERATOR_AT_FAULT')}
              className={`px-3 py-1.5 rounded-lg transition font-medium ${
                filterVerdict === 'OPERATOR_AT_FAULT'
                  ? 'bg-purple-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Operator Breach
            </button>
            <button
              onClick={() => setFilterVerdict('WITHIN_MANDATE_REGRET')}
              className={`px-3 py-1.5 rounded-lg transition font-medium ${
                filterVerdict === 'WITHIN_MANDATE_REGRET'
                  ? 'bg-cyan-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Agent Regret
            </button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-sky-400 flex items-center gap-2">
          <div className="w-3.5 h-3.5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <span>Synchronizing Bryntum Scheduler dispute cases and timeline...</span>
        </div>
      )}

      {syncMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Real Bryntum Scheduler Component */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-3 gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Clock className="w-4 h-4 text-sky-400" />
            Bryntum Scheduler — Case Lifecycle &amp; Response Deadlines
          </div>
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500" /> Inquiry Window
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Auto-Evidence Prep Block
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Seller Response Due
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Executed Resolution
            </span>
          </div>
        </div>

        <div className="agentcourt-bryntum-host w-full" style={{ height: Math.max(260, filteredResources.length * 60 + 95) }}>
          {timelineData && (
            <BryntumScheduler
              height={Math.max(260, filteredResources.length * 60 + 95)}
              rowHeight={52}
              barMargin={8}
              readOnly={true}
              viewPreset="dayAndWeek"
              startDate={timelineData.startDate}
              endDate={timelineData.endDate}
              columns={schedulerColumns}
              resources={filteredResources}
              events={filteredEvents}
              onEventClick={({ resourceRecord }) => {
                if (resourceRecord?.id) {
                  onSelectCase(String(resourceRecord.id))
                }
              }}
            />
          )}
        </div>
      </div>

      {/* Cases Table List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            Dispute Cases Registry ({filteredCases.length})
          </h3>
          <span className="text-xs text-slate-400">Click any row to open the complete cryptographic evidence pack</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-6 py-3.5">Case ID</th>
                <th className="px-6 py-3.5">PayPal Dispute ID</th>
                <th className="px-6 py-3.5">Amount</th>
                <th className="px-6 py-3.5">Arbiter Verdict</th>
                <th className="px-6 py-3.5">Planned PayPal Action</th>
                <th className="px-6 py-3.5">Source / Status</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredCases.map((c) => (
                <tr
                  key={c.case_id}
                  onClick={() => onSelectCase(c.case_id)}
                  className="hover:bg-slate-800/40 transition cursor-pointer group"
                >
                  <td className="px-6 py-4 font-mono font-semibold text-white group-hover:text-sky-300">
                    {c.case_id}
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-400">{c.dispute_id}</td>
                  <td className="px-6 py-4 font-mono font-semibold text-emerald-400">
                    ${c.disputed_amount} {c.currency}
                  </td>
                  <td className="px-6 py-4">{getVerdictBadge(c.verdict)}</td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-slate-300 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                      {c.action_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {c.executed ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {c.execution_mode === 'paypal_sandbox' ? 'Executed (PayPal Sandbox)' : 'Executed (Local Fallback)'}
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5" /> Pending Approval
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-sky-400 group-hover:text-sky-300 font-semibold inline-flex items-center gap-1">
                      Inspect <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
