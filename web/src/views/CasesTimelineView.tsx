import { useState, useEffect } from 'react'
import {
  Calendar,
  AlertCircle,
  ArrowUpRight,
  ShieldAlert,
  Clock,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react'
import { CaseSummary, VerdictType } from '../types'

interface CasesTimelineViewProps {
  onSelectCase: (caseId: string) => void
}

export default function CasesTimelineView({ onSelectCase }: CasesTimelineViewProps) {
  const [cases, setCases] = useState<CaseSummary[]>([])
  const [timelineData, setTimelineData] = useState<any | null>(null)
  const [filterVerdict, setFilterVerdict] = useState<string>('ALL')
  const [isLoading, setIsLoading] = useState(true)
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

  const filteredCases = cases.filter((c) => {
    if (filterVerdict === 'ALL') return true
    return c.verdict === filterVerdict
  })

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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-sky-400" />
            Dispute Cases Timeline & Bryntum Scheduler
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Displays active PayPal disputes across inquiry windows, auto-scheduled evidence preparation blocks, and
            seller response deadlines. Colors correspond directly to Arbiter liability verdicts.
          </p>
        </div>

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

      {isLoading && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-sky-400 flex items-center gap-2">
          <div className="w-3.5 h-3.5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <span>Synchronizing Bryntum Scheduler dispute cases and timeline...</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Bryntum Timeline Visualizer */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Clock className="w-4 h-4 text-sky-400" />
            Bryntum Scheduler Case Lifecycle Gantt
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500" /> Inquiry Window
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Auto-Evidence Prep Block
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Response Deadline Marker
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Resolved Action
            </span>
          </div>
        </div>

        {/* Timeline Event Lanes */}
        <div className="space-y-3 pt-2">
          {timelineData?.resources?.rows?.map((resource: any) => {
            const caseEvents = timelineData?.events?.rows?.filter((e: any) => e.resourceId === resource.id) || []
            return (
              <div
                key={resource.id}
                onClick={() => onSelectCase(resource.id)}
                className="group p-4 bg-slate-950 border border-slate-800/80 hover:border-sky-500/50 rounded-xl cursor-pointer transition space-y-3"
              >
                {/* Lane Header */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white group-hover:text-sky-300 transition">{resource.id}</span>
                    <span className="text-slate-500 font-mono">({resource.dispute_id})</span>
                    {getVerdictBadge(resource.verdict)}
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 font-mono text-xs">
                    <span>${resource.amount} {resource.currency}</span>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
                  </div>
                </div>

                {/* Timeline Gantt Bar Simulation */}
                <div className="relative h-7 bg-slate-900 rounded-lg overflow-hidden border border-slate-800/60 flex items-center px-2">
                  <div className="w-full flex items-center gap-2 text-[10px] font-mono">
                    {caseEvents.map((ev: any) => (
                      <div
                        key={ev.id}
                        style={{ backgroundColor: ev.eventColor }}
                        className="px-2.5 py-1 rounded text-white font-medium shadow-sm flex items-center gap-1 whitespace-nowrap overflow-hidden text-ellipsis"
                      >
                        <span>{ev.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
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
                <th className="px-6 py-3.5">Status</th>
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
                        <CheckCircle2 className="w-3.5 h-3.5" /> Executed
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
