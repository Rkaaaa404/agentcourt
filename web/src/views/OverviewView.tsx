import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Database,
  FileCheck2,
  KeyRound,
  LayoutDashboard,
  Lock,
  Plus,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Webhook,
  XCircle,
  Zap,
} from 'lucide-react'
import { VERDICT_STYLES } from '../agGridSetup'
import type { CaseDetail, CaseSummary, EvalResultsResponse } from '../types'
import { VeripactLogo, type AppTab } from '../components/Navbar'

interface OverviewViewProps {
  onSelectCase: (caseId: string) => void
  onNavigateTab: (tab: AppTab) => void
  onOpenSimulator: () => void
}

function MiniSparkline({ color = '#1D6CE0', variant = 0 }: { color?: string; variant?: number }) {
  const paths = [
    'M2 16 C 10 15, 16 10, 24 12 C 32 14, 40 6, 50 7 C 56 8, 62 4, 68 3',
    'M2 14 C 12 14, 18 16, 26 11 C 34 7, 42 13, 50 9 C 58 6, 62 7, 68 4',
    'M2 17 C 10 16, 18 13, 28 14 C 36 15, 44 10, 52 11 C 60 11, 64 7, 68 6',
  ]
  const path = paths[variant % paths.length]
  return (
    <svg viewBox="0 0 70 20" className="w-16 h-5 overflow-visible" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function OverviewView({
  onSelectCase,
  onNavigateTab,
  onOpenSimulator,
}: OverviewViewProps) {
  const [cases, setCases] = useState<CaseSummary[]>([])
  const [evalSummary, setEvalSummary] = useState<EvalResultsResponse | null>(null)
  const [ledgerStatus, setLedgerStatus] = useState<{ intact: boolean; total_entries: number } | null>(null)
  const [spotlightCase, setSpotlightCase] = useState<CaseDetail | null>(null)
  const [monitorFilter, setMonitorFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadOverviewData = async () => {
      setIsLoading(true)
      try {
        const [casesResp, evalResp, ledgerResp] = await Promise.all([
          fetch('/api/cases'),
          fetch('/api/eval/results'),
          fetch('/api/cases/ledger/verify'),
        ])

        let loadedCases: CaseSummary[] = []
        if (casesResp.ok) {
          loadedCases = await casesResp.json()
          setCases(loadedCases)
        }
        if (evalResp.ok) {
          setEvalSummary(await evalResp.json())
        }
        if (ledgerResp.ok) {
          setLedgerStatus(await ledgerResp.json())
        }

        const firstCaseId = loadedCases[0]?.case_id || 'case-s1-merchant-breach'
        const detailResp = await fetch(`/api/cases/${encodeURIComponent(firstCaseId)}`)
        if (detailResp.ok) {
          setSpotlightCase(await detailResp.json())
        }
      } catch (err) {
        console.error('Failed to load overview telemetry:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadOverviewData()
  }, [])

  const pendingCount = useMemo(() => cases.filter((c) => !c.executed).length, [cases])

  const countsByVerdict = useMemo(() => {
    const counts = {
      MERCHANT_AT_FAULT: 0,
      OPERATOR_AT_FAULT: 0,
      WITHIN_MANDATE_REGRET: 0,
      NO_FAULT: 0,
    }
    cases.forEach((c) => {
      if (c.verdict in counts) {
        counts[c.verdict as keyof typeof counts] += 1
      }
    })
    return counts
  }, [cases])

  const filteredMonitorCases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return cases.filter((c) => {
      const verdictMatch = monitorFilter === 'ALL' || c.verdict === monitorFilter
      const queryMatch =
        !q ||
        c.case_id.toLowerCase().includes(q) ||
        c.dispute_id.toLowerCase().includes(q) ||
        c.verdict.toLowerCase().includes(q) ||
        c.verdict_summary.toLowerCase().includes(q)
      return verdictMatch && queryMatch
    })
  }, [cases, monitorFilter, searchQuery])

  const spotlight = spotlightCase?.case
  const spotlightEp = spotlight?.evidence_pack
  const topFlaggedCase =
    cases.find((c) => c.verdict === 'MERCHANT_AT_FAULT') || cases[0]

  return (
    <div className="bg-white text-slate-900">
      {/* 1. Asymmetric 2-Column Hero */}
      <section className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-b from-[#F8FBFF] via-white to-white">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 lg:pt-14 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Copy & KPIs */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EFF6FF] border border-blue-200/80 text-[#1D6CE0] text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1D6CE0]" />
                AI Commerce Trust &amp; Liability Infrastructure
              </div>

              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.08]">
                Autonomous Liability Resolution for{' '}
                <span className="text-[#1D6CE0]">AI Commerce</span>
              </h1>

              <p className="text-base sm:text-[17px] text-slate-600 leading-relaxed max-w-xl">
                Veripact cryptographically binds purchase mandates to PayPal orders, pinpoints fault across merchants
                and AI shopping agents, and automates dispute settlement with a tamper-evident ledger.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={() => onNavigateTab('purchase')}
                  className="px-5 py-3 bg-[#1D6CE0] hover:bg-[#1558BA] text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-md shadow-blue-600/20 transition"
                >
                  <span>Try Live Demo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onNavigateTab('cases')}
                  className="px-5 py-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition"
                >
                  <span>Explore Live Monitor</span>
                </button>
              </div>

              {/* 3-Column KPI Strip */}
              <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-200/80 max-w-lg">
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                    {evalSummary ? `${evalSummary.accuracy_pct}%` : '100%'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 leading-snug">
                    Deterministic Policy Accuracy
                  </div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                    7 Checks
                  </div>
                  <div className="text-xs text-slate-500 mt-1 leading-snug">
                    Ed25519 &amp; Spend-Cap Guardrails
                  </div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                    24/7
                  </div>
                  <div className="text-xs text-slate-500 mt-1 leading-snug">
                    Real-Time PayPal Webhook Sync
                  </div>
                </div>
              </div>
            </div>

            {/* Right Floating Workspace Preview */}
            <div className="lg:col-span-6">
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_24px_60px_-15px_rgba(15,23,42,0.12)] overflow-hidden lg:rotate-[0.6deg] hover:rotate-0 transition-transform duration-300">
                <div className="grid grid-cols-12 min-h-[380px]">
                  {/* Mini Sidebar */}
                  <div className="col-span-4 sm:col-span-3 bg-slate-50/90 border-r border-slate-200/80 p-3.5 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 px-1.5">
                        <VeripactLogo className="w-5 h-5" />
                        <span className="font-bold text-xs text-slate-900">Veripact</span>
                      </div>

                      <div className="space-y-1 text-[11px] font-medium">
                        <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#EFF6FF] text-[#1D6CE0] font-semibold">
                          <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
                          <span>Overview</span>
                        </div>
                        <button
                          onClick={() => onNavigateTab('cases')}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition text-left"
                        >
                          <Scale className="w-3.5 h-3.5 shrink-0" />
                          <span>Disputes</span>
                        </button>
                        <button
                          onClick={() => onNavigateTab('purchase')}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition text-left"
                        >
                          <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                          <span>Checkout</span>
                        </button>
                        <button
                          onClick={() => onSelectCase(topFlaggedCase?.case_id || 'case-s1-merchant-breach')}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition text-left"
                        >
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                          <span>Ledger</span>
                        </button>
                        <button
                          onClick={() => onNavigateTab('eval')}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition text-left"
                        >
                          <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Evaluation</span>
                        </button>
                      </div>
                    </div>

                    <div className="px-2 py-2 rounded-lg bg-white border border-slate-200/80 text-[10px] text-slate-500">
                      <span className="font-semibold text-emerald-700 block">● Sandbox Live</span>
                      {ledgerStatus ? `${ledgerStatus.total_entries} SHA-256 entries` : 'Hash chain synced'}
                    </div>
                  </div>

                  {/* Preview Main Canvas */}
                  <div className="col-span-8 sm:col-span-9 p-4 sm:p-5 space-y-4 bg-white">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Welcome back, Ops Team</h3>
                        <p className="text-[11px] text-slate-500">
                          Monitor disputes, liability verdicts, and PayPal execution.
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-[11px] text-slate-600 font-medium whitespace-nowrap">
                        Live Sandbox
                      </span>
                    </div>

                    {/* 3 Compact KPI Cards */}
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="p-2.5 rounded-xl border border-slate-200 bg-white">
                        <div className="text-lg font-extrabold text-slate-900 tabular-nums">
                          {isLoading ? '—' : cases.length}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">Active Cases</div>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-emerald-600">Synced</span>
                          <MiniSparkline color="#1D6CE0" variant={0} />
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl border border-slate-200 bg-white">
                        <div className="text-lg font-extrabold text-slate-900 tabular-nums">
                          {isLoading ? '—' : pendingCount}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">Need Review</div>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-amber-600">HATEOAS</span>
                          <MiniSparkline color="#D97706" variant={1} />
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl border border-slate-200 bg-white">
                        <div className="text-lg font-extrabold text-slate-900 tabular-nums">
                          {evalSummary ? `${evalSummary.accuracy_pct}%` : '100%'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">Eval Pass Rate</div>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-emerald-600">
                            {evalSummary ? `${evalSummary.passed_scenarios}/${evalSummary.total_scenarios}` : '15/15'}
                          </span>
                          <MiniSparkline color="#10B981" variant={2} />
                        </div>
                      </div>
                    </div>

                    {/* Trend Chart + AI Arbiter Insight */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-7 p-3 rounded-xl border border-slate-200 bg-slate-50/40">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold text-slate-800">Dispute &amp; Breach Trend</span>
                          <div className="flex items-center gap-2 text-[9px] text-slate-500">
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Verified
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Regret
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Breach
                            </span>
                          </div>
                        </div>

                        <svg viewBox="0 0 260 95" className="w-full h-24" aria-hidden="true">
                          <defs>
                            <linearGradient id="veripactAreaBlue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#1D6CE0" stopOpacity="0.22" />
                              <stop offset="100%" stopColor="#1D6CE0" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <line x1="0" y1="25" x2="260" y2="25" stroke="#E2E8F0" strokeDasharray="3 3" />
                          <line x1="0" y1="55" x2="260" y2="55" stroke="#E2E8F0" strokeDasharray="3 3" />
                          <line x1="0" y1="82" x2="260" y2="82" stroke="#E2E8F0" />
                          <path
                            d="M4 68 C 38 66, 56 54, 88 52 C 120 50, 142 36, 174 34 C 204 32, 226 18, 256 14 L 256 82 L 4 82 Z"
                            fill="url(#veripactAreaBlue)"
                          />
                          <path
                            d="M4 68 C 38 66, 56 54, 88 52 C 120 50, 142 36, 174 34 C 204 32, 226 18, 256 14"
                            fill="none"
                            stroke="#1D6CE0"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M4 76 C 42 74, 74 68, 110 65 C 145 62, 175 64, 210 54 C 228 49, 242 46, 256 42"
                            fill="none"
                            stroke="#F59E0B"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                          <path
                            d="M4 80 C 48 80, 92 78, 134 73 C 174 68, 212 72, 256 61"
                            fill="none"
                            stroke="#EF4444"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>

                      <div className="sm:col-span-5 p-3 rounded-xl border border-blue-200/80 bg-[#EFF6FF]/60 flex flex-col justify-between gap-2">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900">
                            <Sparkles className="w-3.5 h-3.5 text-[#1D6CE0]" />
                            AI Arbiter Insight
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3">
                            {topFlaggedCase
                              ? `${topFlaggedCase.case_id}: ${topFlaggedCase.verdict_summary}`
                              : 'Deterministic checks verified signed intent & cart mandate hashes across active disputes.'}
                          </p>
                        </div>
                        <button
                          onClick={() => onSelectCase(topFlaggedCase?.case_id || 'case-s1-merchant-breach')}
                          className="w-full py-1.5 px-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-900 flex items-center justify-center gap-1 transition"
                        >
                          <span>Inspect Case</span>
                          <ArrowRight className="w-3 h-3 text-[#1D6CE0]" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Ecosystem & Protocol Trust Strip */}
      <section className="border-b border-slate-100 bg-white">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-xs font-medium text-slate-500 mb-6">
            Built to interoperate with modern agentic payment standards
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200 max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-2.5 py-3 px-4">
              <div className="p-2 rounded-lg bg-[#EFF6FF] text-[#1D6CE0]">
                <Zap className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-900">PayPal Orders &amp; Disputes</div>
                <div className="text-[11px] text-slate-500">Live Sandbox API v1/v2</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2.5 py-3 px-4">
              <div className="p-2 rounded-lg bg-[#EFF6FF] text-[#1D6CE0]">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-900">AP2 Mandates</div>
                <div className="text-[11px] text-slate-500">Intent &amp; Cart Binding</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2.5 py-3 px-4">
              <div className="p-2 rounded-lg bg-[#EFF6FF] text-[#1D6CE0]">
                <KeyRound className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-900">Ed25519 Signatures</div>
                <div className="text-[11px] text-slate-500">SHA-256 Digest Verification</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2.5 py-3 px-4">
              <div className="p-2 rounded-lg bg-[#EFF6FF] text-[#1D6CE0]">
                <Database className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-900">Hash-Chained Ledger</div>
                <div className="text-[11px] text-slate-500">Append-Only Audit Trail</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. 4-Column Pipeline Section */}
      <section className="py-16 bg-[#F8FAFC] border-b border-slate-200/70">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-2 mb-8">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#EFF6FF] border border-blue-200 text-[#1D6CE0] text-xs font-semibold">
              Veripact Pipeline
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              From agent checkout to verified settlement
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: <KeyRound className="w-5 h-5 text-[#1D6CE0]" />,
                title: 'Signed Mandate Binding',
                desc: 'Lock buyer intent, spend caps, and required specs onto PayPal Orders v2 via custom_id.',
              },
              {
                icon: <ShieldCheck className="w-5 h-5 text-[#1D6CE0]" />,
                title: 'Deterministic Guardrails',
                desc: 'Pure-function C1–C7 checks validate Ed25519 signatures, expiry, hashes, and price limits.',
              },
              {
                icon: <Brain className="w-5 h-5 text-[#1D6CE0]" />,
                title: 'Spec Diff & AI Arbiter',
                desc: 'Side-by-side comparison of merchant listings, warehouse reports, and agent traces.',
              },
              {
                icon: <RefreshCw className="w-5 h-5 text-[#1D6CE0]" />,
                title: 'One-Click PayPal Execution',
                desc: 'Preview exact PayPal Disputes API payloads and dispatch refunds, evidence, or offers safely.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:border-blue-300 hover:shadow-md transition"
              >
                <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] border border-blue-100 flex items-center justify-center mb-4">
                  {card.icon}
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">{card.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Interactive Embedded Dispute & Liability Monitor */}
      <section className="py-16 bg-white border-b border-slate-100">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#EFF6FF] border border-blue-200 text-[#1D6CE0] text-xs font-semibold">
              Dispute &amp; Liability Monitor
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Dispute &amp; Liability Monitor
            </h2>
            <p className="text-sm text-slate-600">
              Track, filter, and inspect live AI commerce disputes with a transparent, auditable workflow.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_18px_45px_-18px_rgba(15,23,42,0.12)] overflow-hidden">
            {/* Toolbar Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'ALL', label: `All (${cases.length})` },
                  { id: 'MERCHANT_AT_FAULT', label: `Merchant Fault (${countsByVerdict.MERCHANT_AT_FAULT})` },
                  { id: 'OPERATOR_AT_FAULT', label: `Operator Fault (${countsByVerdict.OPERATOR_AT_FAULT})` },
                  { id: 'WITHIN_MANDATE_REGRET', label: `Agent Regret (${countsByVerdict.WITHIN_MANDATE_REGRET})` },
                  { id: 'NO_FAULT', label: `No Fault (${countsByVerdict.NO_FAULT})` },
                ].map((tab) => {
                  const active = monitorFilter === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setMonitorFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        active
                          ? 'bg-[#EFF6FF] text-[#1D6CE0] border border-blue-200'
                          : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search case ID, dispute, verdict..."
                    className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
                  />
                </div>
                <button
                  onClick={() => onNavigateTab('purchase')}
                  className="px-3.5 py-1.5 bg-[#1D6CE0] hover:bg-[#1558BA] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Simulate Purchase
                </button>
                <button
                  onClick={onOpenSimulator}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition"
                >
                  + Dispute
                </button>
              </div>
            </div>

            {/* Clean Case Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-5">Case ID</th>
                    <th className="py-3 px-4">Scenario &amp; Verdict Summary</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Risk Trend</th>
                    <th className="py-3 px-4">Liability Verdict</th>
                    <th className="py-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredMonitorCases.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500">
                        {isLoading ? 'Loading live sandbox cases...' : 'No cases match your current filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredMonitorCases.map((c, idx) => {
                      const st = VERDICT_STYLES[c.verdict] || VERDICT_STYLES.NEEDS_HUMAN
                      const sparkColor =
                        c.verdict === 'NO_FAULT'
                          ? '#10B981'
                          : c.verdict === 'WITHIN_MANDATE_REGRET'
                          ? '#D97706'
                          : '#EF4444'
                      return (
                        <tr
                          key={c.case_id}
                          onClick={() => onSelectCase(c.case_id)}
                          className="hover:bg-[#F8FBFF] cursor-pointer transition"
                        >
                          <td className="py-3.5 px-5 font-mono font-semibold text-slate-900 whitespace-nowrap">
                            {c.case_id}
                            <div className="text-[10px] font-normal text-slate-400">{c.dispute_id}</div>
                          </td>
                          <td className="py-3.5 px-4 max-w-md">
                            <div className="font-semibold text-slate-900 line-clamp-1">
                              {c.action_type} &bull; {c.lifecycle_stage}
                            </div>
                            <div className="text-[11px] text-slate-500 line-clamp-1">{c.verdict_summary}</div>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                            ${c.disputed_amount} {c.currency}
                          </td>
                          <td className="py-3.5 px-4">
                            <MiniSparkline color={sparkColor} variant={idx} />
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${st.badge}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                              {c.verdict}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-[#1D6CE0] font-semibold">
                              Inspect <ArrowRight className="w-3.5 h-3.5" />
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Core Capabilities (2x2 Grid) & Live Case Spotlight */}
      <section className="py-16 bg-[#F8FAFC] border-b border-slate-200/70">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left: 2x2 Core Capabilities */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#EFF6FF] border border-blue-200 text-[#1D6CE0] text-xs font-semibold">
                Core Capabilities
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Engineered for high-stakes agentic payment ops
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  icon: <Scale className="w-5 h-5 text-[#1D6CE0]" />,
                  title: 'Dual-Layer Deterministic + LLM Arbiter',
                  desc: 'Combine C1–C7 deterministic policy rules with constrained AI semantic checks for explainable verdicts.',
                },
                {
                  icon: <Lock className="w-5 h-5 text-[#1D6CE0]" />,
                  title: 'Tamper-Evident Audit Ledger',
                  desc: 'Hash-chained SHA-256 append-only records for mandates, evidence packs, and PayPal actions.',
                },
                {
                  icon: <ShieldCheck className="w-5 h-5 text-[#1D6CE0]" />,
                  title: 'Prompt-Injection Shielded Inspection',
                  desc: 'Guarded comparison of merchant specs and delivery reports with strict deterministic precedence.',
                },
                {
                  icon: <Webhook className="w-5 h-5 text-[#1D6CE0]" />,
                  title: 'Live PayPal Orders & Webhook Sync',
                  desc: 'Real-time ingestion and signature verification for orders, disputes, and settlement events.',
                },
              ].map((item) => (
                <div key={item.title} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] border border-blue-100 flex items-center justify-center mb-3">
                    {item.icon}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1.5">{item.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Live Case Inspection Preview Card */}
          <div className="lg:col-span-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 font-mono">
                    Case Inspection &mdash; {spotlight?.case_id || 'case-s1-merchant-breach'}
                  </span>
                </div>
                <button
                  onClick={() => onSelectCase(spotlight?.case_id || 'case-s1-merchant-breach')}
                  className="text-xs font-semibold text-[#1D6CE0] hover:underline flex items-center gap-1"
                >
                  Open Full Arbiter <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {spotlightEp?.mandate_pack?.cart?.items?.[0]?.title || 'USB-C Docking Station'}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      Order: {spotlightEp?.paypal_order_id || 'ORDER-SANDBOX'} &bull; Amount: $
                      {spotlight?.disputed_amount || '95.00'}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                      (VERDICT_STYLES[spotlight?.verdict?.verdict || 'MERCHANT_AT_FAULT'] || VERDICT_STYLES.NEEDS_HUMAN)
                        .badge
                    }`}
                  >
                    {spotlight?.verdict?.verdict || 'MERCHANT_AT_FAULT'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FFFBEB] border border-amber-200/80 space-y-1">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    AI Arbiter Verdict Summary
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {spotlight?.verdict?.summary ||
                      'Deterministic & semantic evidence check completed against the signed AP2 cart mandate.'}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-800">Policy Checks (C1 – C7)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(spotlight?.verdict?.deterministic_checks || []).slice(0, 7).map((chk) => (
                      <div
                        key={chk.check_id}
                        className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/70 flex items-center justify-between text-[11px]"
                      >
                        <span className="font-medium text-slate-800 truncate pr-2">
                          <span className="font-mono text-slate-500">{chk.check_id}</span> {chk.name}
                        </span>
                        {chk.status === 'PASS' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                          </span>
                        ) : chk.status === 'FAIL' ? (
                          <span className="inline-flex items-center gap-1 text-rose-700 font-semibold shrink-0">
                            <XCircle className="w-3.5 h-3.5" /> FAIL
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium shrink-0">SKIP</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Deployment & Integration Modes (3 Clean Cards) */}
      <section className="py-16 bg-white">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#EFF6FF] border border-blue-200 text-[#1D6CE0] text-xs font-semibold">
              Deployment &amp; Modes
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Start in Sandbox, scale to global payment ops
            </h2>
            <p className="text-sm text-slate-600">
              Built cleanly for hackathon evaluation, PayPal Sandbox verification, and production payment pipelines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Tier 1 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Local Sandbox</h3>
                  <p className="text-xs text-slate-500 mt-1">For deterministic testing &amp; prototyping.</p>
                </div>
                <div className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  MIT <span className="text-xs font-medium text-slate-500">open source</span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#1D6CE0] shrink-0" />
                    Deterministic C1–C7 policy arbiter
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#1D6CE0] shrink-0" />
                    15-scenario adversarial benchmark suite
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#1D6CE0] shrink-0" />
                    Simulated buyer dispute fixtures
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#1D6CE0] shrink-0" />
                    SQLite + append-only SHA-256 ledger
                  </li>
                </ul>
              </div>
              <button
                onClick={() => onNavigateTab('eval')}
                className="w-full py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition"
              >
                Run 15-Scenario Eval
              </button>
            </div>

            {/* Tier 2 (Highlighted Blue Border) */}
            <div className="rounded-2xl border-2 border-[#1D6CE0] bg-white p-6 flex flex-col justify-between space-y-6 shadow-lg shadow-blue-600/10 relative">
              <span className="absolute -top-3 right-5 px-2.5 py-0.5 rounded-full bg-[#1D6CE0] text-white text-[10px] font-bold tracking-wide">
                Active Live Mode
              </span>
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">PayPal Sandbox Cloud</h3>
                  <p className="text-xs text-slate-500 mt-1">Real PayPal Orders v2 &amp; Disputes API.</p>
                </div>
                <div className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  Live <span className="text-xs font-medium text-slate-500">Orders &amp; Webhooks</span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#1D6CE0] shrink-0" />
                    Real PayPal Sandbox checkout &amp; capture
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#1D6CE0] shrink-0" />
                    Cryptographic custom_id mandate binding
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#1D6CE0] shrink-0" />
                    Bryntum timeline + AG Grid registry
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#1D6CE0] shrink-0" />
                    HATEOAS action preview &amp; execution
                  </li>
                </ul>
              </div>
              <button
                onClick={() => onNavigateTab('purchase')}
                className="w-full py-2.5 rounded-xl bg-[#1D6CE0] hover:bg-[#1558BA] text-white text-xs font-semibold shadow-sm shadow-blue-600/20 transition"
              >
                Launch Agent Checkout
              </button>
            </div>

            {/* Tier 3 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Enterprise Payment Ops</h3>
                  <p className="text-xs text-slate-500 mt-1">For multi-merchant agent networks.</p>
                </div>
                <div className="text-3xl font-extrabold text-slate-900">
                  Custom <span className="text-xs font-medium text-slate-500">Architecture</span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#1D6CE0] shrink-0" />
                    Multi-merchant mandate registry
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#1D6CE0] shrink-0" />
                    Signed PayPal webhook signature guard
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#1D6CE0] shrink-0" />
                    Constrained LLM discrepancy review
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#1D6CE0] shrink-0" />
                    Exportable cryptographic audit proofs
                  </li>
                </ul>
              </div>
              <button
                onClick={() => onNavigateTab('cases')}
                className="w-full py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition"
              >
                Inspect Live Cases
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

