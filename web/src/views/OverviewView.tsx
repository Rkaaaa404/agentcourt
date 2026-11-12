import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  FileCode2,
  FileText,
  KeyRound,
  LayoutDashboard,
  Lock,
  Scale,
  ShieldCheck,
  ShoppingBag,
  Webhook,
  XCircle,
} from 'lucide-react'
import { VERDICT_STYLES } from '../agGridSetup'
import type { CaseDetail, CaseSummary, EvalResultsResponse } from '../types'
import { VeripactLogo, type AppTab } from '../components/Navbar'
import { useCountUp, useInViewReveal } from '../hooks/useMotion'
import CollaborationStrip from '../components/CollaborationStrip'
import ScrollReveal from '../components/ScrollReveal'

interface OverviewViewProps {
  onSelectCase: (caseId: string) => void
  onNavigateTab: (tab: AppTab) => void
  onOpenSimulator: () => void
}

const CHART_SERIES = [
  { label: 'D-6', verified: 68, breach: 18, regret: 14 },
  { label: 'D-5', verified: 74, breach: 20, regret: 12 },
  { label: 'D-4', verified: 79, breach: 16, regret: 15 },
  { label: 'D-3', verified: 84, breach: 14, regret: 11 },
  { label: 'D-2', verified: 91, breach: 11, regret: 9 },
  { label: 'D-1', verified: 96, breach: 8, regret: 7 },
  { label: 'Live', verified: 100, breach: 6, regret: 5 },
]

const MARQUEE_ITEMS = [
  { icon: ShoppingBag, title: 'PayPal Orders API v2', sub: 'Create & capture agent purchases' },
  { icon: Webhook, title: 'Verified Webhooks', sub: 'Real-time dispute & order sync' },
  { icon: ShieldCheck, title: 'Customer Disputes API', sub: 'Automated settlement execution' },
  { icon: KeyRound, title: 'AP2 Mandates', sub: 'Signed intent & cart bindings' },
  { icon: Lock, title: 'SHA-256 Audit Ledger', sub: 'Tamper-evident hash chain' },
  { icon: Cpu, title: 'Deterministic C1–C7', sub: 'Pure-function policy guardrails' },
]

export default function OverviewView({
  onSelectCase,
  onNavigateTab,
  onOpenSimulator,
}: OverviewViewProps) {
  const [cases, setCases] = useState<CaseSummary[]>([])
  const [selectedPreviewId, setSelectedPreviewId] = useState<string>('case-s2-operator-price-drift')
  const [previewDetail, setPreviewDetail] = useState<CaseDetail | null>(null)
  const [ledgerStatus, setLedgerStatus] = useState<{
    intact: boolean
    total_entries: number
    latest_hash: string | null
  } | null>(null)
  const [evalSummary, setEvalSummary] = useState<EvalResultsResponse | null>(null)
  const [previewSubTab, setPreviewSubTab] = useState<'overview' | 'evidence' | 'checks' | 'audit'>('overview')
  const [expandedStep, setExpandedStep] = useState<string>('01')
  const [expandedWhy, setExpandedWhy] = useState<number>(0)
  const [hoveredChartIdx, setHoveredChartIdx] = useState<number>(6)
  const [isChartHovered, setIsChartHovered] = useState(false)
  const [activeCodeLine, setActiveCodeLine] = useState<number>(1)
  const [isCodeHovered, setIsCodeHovered] = useState(false)
  const [barsMounted, setBarsMounted] = useState(false)

  const workflowReveal = useInViewReveal(0.1)
  const chartReveal = useInViewReveal(0.1)
  const evidenceReveal = useInViewReveal(0.1)

  useEffect(() => {
    const timer = setTimeout(() => setBarsMounted(true), 150)
    return () => clearTimeout(timer)
  }, [])

  // Auto-cycle chart checkpoint subtly until hovered
  useEffect(() => {
    if (isChartHovered) return
    const id = setInterval(() => {
      setHoveredChartIdx((prev) => (prev + 1) % CHART_SERIES.length)
    }, 2300)
    return () => clearInterval(id)
  }, [isChartHovered])

  // Subtle live code line scanner
  useEffect(() => {
    if (isCodeHovered) return
    const id = setInterval(() => {
      setActiveCodeLine((prev) => (prev >= 8 ? 1 : prev + 1))
    }, 1400)
    return () => clearInterval(id)
  }, [isCodeHovered])

  useEffect(() => {
    const loadData = async () => {
      try {
        const [casesResp, ledgerResp, evalResp] = await Promise.all([
          fetch('/api/cases'),
          fetch('/api/cases/ledger/verify'),
          fetch('/api/eval/results'),
        ])

        if (casesResp.ok) {
          const list: CaseSummary[] = await casesResp.json()
          setCases(list)
          const preferred = list.find((c) => c.case_id.includes('s2')) || list[0]
          if (preferred) {
            setSelectedPreviewId(preferred.case_id)
          }
        }
        if (ledgerResp.ok) {
          setLedgerStatus(await ledgerResp.json())
        }
        if (evalResp.ok) {
          setEvalSummary(await evalResp.json())
        }
      } catch (err) {
        console.error('Failed to load Veripact overview data:', err)
      }
    }
    loadData()
  }, [])

  useEffect(() => {
    if (!selectedPreviewId) return
    const loadDetail = async () => {
      try {
        const resp = await fetch(`/api/cases/${encodeURIComponent(selectedPreviewId)}`)
        if (resp.ok) {
          setPreviewDetail(await resp.json())
        }
      } catch (err) {
        console.error('Failed to load spotlight case detail:', err)
      }
    }
    loadDetail()
  }, [selectedPreviewId])

  const animatedAccuracy = useCountUp(Math.round(evalSummary?.accuracy_pct ?? 100), 850)
  const animatedCases = useCountUp(cases.length || 3, 650)
  const animatedLedger = useCountUp(ledgerStatus?.total_entries ?? 3, 750)

  const activeCase = previewDetail?.case
  const activeEp = activeCase?.evidence_pack
  const checks = activeCase?.verdict?.deterministic_checks || []
  const verdictStyle =
    VERDICT_STYLES[activeCase?.verdict?.verdict || 'OPERATOR_AT_FAULT'] || VERDICT_STYLES.NEEDS_HUMAN

  const formattedCaseCode = useMemo(() => {
    const raw = activeCase?.case_id || selectedPreviewId
    if (raw.includes('s1')) return 'CASE-S1'
    if (raw.includes('s2')) return 'CASE-S2'
    if (raw.includes('s3')) return 'CASE-S3'
    return raw.toUpperCase()
  }, [activeCase, selectedPreviewId])

  const jsonSnippetLines = useMemo(() => {
    const obj = {
      case_id: formattedCaseCode,
      paypal_order_id: activeEp?.paypal_order_id || 'ORDER-SANDBOX-S2',
      merchant_id: activeEp?.mandate_pack?.cart?.merchant_id || 'voltport-simulated',
      spend_cap: Number(activeEp?.mandate_pack?.intent?.spend_cap || 100.0),
      captured_amount: Number(activeEp?.captured_amount || activeCase?.disputed_amount || 112.4),
      signature: activeEp?.mandate_pack?.intent?.signature
        ? `ed25519:${activeEp.mandate_pack.intent.signature.slice(0, 8)}...${activeEp.mandate_pack.intent.signature.slice(-4)}`
        : 'ed25519:984d...e31f',
      verdict: activeCase?.verdict?.verdict || 'OPERATOR_AT_FAULT',
    }
    return JSON.stringify(obj, null, 2).split('\n')
  }, [activeCase, activeEp, formattedCaseCode])

  const chartPoints = useMemo(() => {
    const width = 440
    const height = 145
    const padX = 24
    const padY = 18
    const usableW = width - padX * 2
    const usableH = height - padY * 2

    const toCoords = (vals: number[]) =>
      vals.map((v, idx) => {
        const x = padX + (idx / (vals.length - 1)) * usableW
        const y = padY + (1 - v / 100) * usableH
        return { x, y, val: v }
      })

    const buildSmoothPath = (pts: Array<{ x: number; y: number }>) =>
      pts
        .map((p, i) => {
          if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
          const prev = pts[i - 1]
          const cx = ((prev.x + p.x) / 2).toFixed(1)
          return `C ${cx} ${prev.y.toFixed(1)}, ${cx} ${p.y.toFixed(1)}, ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
        })
        .join(' ')

    const verifiedPts = toCoords(CHART_SERIES.map((d) => d.verified))
    const breachPts = toCoords(CHART_SERIES.map((d) => d.breach))
    const regretPts = toCoords(CHART_SERIES.map((d) => d.regret))

    const verifiedLine = buildSmoothPath(verifiedPts)
    const verifiedArea = `${verifiedLine} L ${verifiedPts[verifiedPts.length - 1].x.toFixed(1)} ${height - padY} L ${verifiedPts[0].x.toFixed(1)} ${height - padY} Z`

    return {
      width,
      height,
      padY,
      verifiedPts,
      breachPts,
      regretPts,
      verifiedLine,
      verifiedArea,
      breachLine: buildSmoothPath(breachPts),
      regretLine: buildSmoothPath(regretPts),
    }
  }, [])

  const evalBreakdownEntries = useMemo(() => {
    if (evalSummary?.class_breakdown) {
      return Object.entries(evalSummary.class_breakdown).map(([cls, st]) => ({
        name: cls,
        count: `${st.correct}/${st.total}`,
        pct: st.accuracy_pct,
      }))
    }
    return [
      { name: 'MERCHANT_AT_FAULT', count: '4/4', pct: 100 },
      { name: 'OPERATOR_AT_FAULT', count: '4/4', pct: 100 },
      { name: 'WITHIN_MANDATE_REGRET', count: '3/3', pct: 100 },
      { name: 'NO_FAULT', count: '2/2', pct: 100 },
      { name: 'NEEDS_HUMAN', count: '2/2', pct: 100 },
    ]
  }, [evalSummary])

  return (
    <div className="bg-[#F8F3EB] text-[#292522] overflow-x-hidden">
      {/* 1. Editorial 2-Column Hero with Ambient Glow & Floating Workbench */}
      <section className="relative border-b border-[#DCCDBB] overflow-hidden">
        {/* Subtle shifting editorial ambient glow */}
        <div
          className="pointer-events-none absolute -top-24 right-[-6%] w-[460px] h-[460px] rounded-full bg-gradient-to-br from-[#BF4827]/12 via-[#541827]/8 to-[#52705C]/10 blur-3xl animate-ambient-shift"
          aria-hidden="true"
        />

        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 lg:pt-14 lg:pb-16 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-10 items-center">
            {/* Left Editorial Copy */}
            <div className="lg:col-span-5 space-y-6">
              <ScrollReveal delayMs={0}>
                <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] uppercase text-[#6E635D]">
                  <span className="w-2 h-2 rounded-full bg-[#BF4827] animate-pulse" />
                  Liability Infrastructure for Autonomous Commerce
                </div>
              </ScrollReveal>

              <ScrollReveal delayMs={60}>
                <h1 className="font-serif editorial-expand-title text-4xl sm:text-5xl lg:text-[54px] font-semibold tracking-tight text-[#541827] leading-[1.04]">
                  When AI spends, responsibility must be clear.
                </h1>
              </ScrollReveal>

              <ScrollReveal delayMs={120}>
                <p className="text-[15px] sm:text-base text-[#574D48] leading-relaxed max-w-lg">
                  Veripact binds purchase mandates to PayPal orders, evaluates evidence from merchants, delivery, and
                  AI agents, and determines financial fault with a deterministic and auditable process.
                </p>
              </ScrollReveal>

              <div className="flex flex-wrap items-center gap-5 pt-1 animate-fade-up-delay-2">
                <button
                  onClick={() => onNavigateTab('purchase')}
                  className="group px-5 py-3 bg-[#BF4827] hover:bg-[#A33B1E] text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  <span>Try Live Demo</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={() => onNavigateTab('cases')}
                  className="text-sm font-semibold text-[#541827] hover:text-[#BF4827] inline-flex items-center gap-1.5 border-b border-[#541827]/30 hover:border-[#BF4827] pb-0.5 transition"
                >
                  <span>View Dispute Monitor</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>

              {/* Compact Case Switcher + Live Count-Up Metrics */}
              <div className="pt-3 space-y-3 animate-fade-up-delay-3">
                {cases.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium text-[#6E635D]">Inspect live fixture:</span>
                    {cases.slice(0, 3).map((c, idx) => {
                      const active = selectedPreviewId === c.case_id
                      return (
                        <button
                          key={c.case_id}
                          onClick={() => setSelectedPreviewId(c.case_id)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold border transition-all duration-200 ${
                            active
                              ? 'bg-[#541827] text-white border-[#541827] scale-[1.03]'
                              : 'bg-white text-[#574D48] border-[#DCCDBB] hover:border-[#BF4827]'
                          }`}
                        >
                          S{idx + 1}: {c.verdict.split('_')[0]}
                        </button>
                      )
                    })}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4 pt-3 border-t border-[#DCCDBB] max-w-md">
                  <div>
                    <div className="font-serif text-2xl font-bold text-[#541827] tabular-nums">
                      {animatedAccuracy}%
                    </div>
                    <div className="text-[11px] text-[#6E635D]">Policy accuracy</div>
                  </div>
                  <div>
                    <div className="font-serif text-2xl font-bold text-[#BF4827] tabular-nums">
                      {animatedCases} Cases
                    </div>
                    <div className="text-[11px] text-[#6E635D]">Active sandbox</div>
                  </div>
                  <div>
                    <div className="font-serif text-2xl font-bold text-[#52705C] tabular-nums">
                      {animatedLedger} Sealed
                    </div>
                    <div className="text-[11px] text-[#6E635D]">SHA-256 ledger</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Floating Interactive Workbench Card */}
            <div className="lg:col-span-7 animate-fade-up-delay-1">
              <div className="animate-float-slow bg-white rounded-2xl border border-[#DCCDBB] shadow-[0_22px_50px_-18px_rgba(45,22,18,0.14)] overflow-hidden transition-shadow duration-300 hover:shadow-[0_28px_60px_-16px_rgba(84,24,39,0.18)]">
                <div className="grid grid-cols-12">
                  {/* Embedded Sidebar */}
                  <div className="hidden sm:flex sm:col-span-3 bg-[#FCF9F4] border-r border-[#DCCDBB] p-4 flex-col justify-between min-h-[395px]">
                    <div className="space-y-5">
                      <div className="flex items-center gap-2 px-1">
                        <VeripactLogo className="w-4 h-4" />
                        <span className="font-serif font-bold text-xs tracking-[0.06em] text-[#541827]">
                          VERIPACT
                        </span>
                      </div>

                      <div className="space-y-1 text-[11px] font-medium">
                        <button
                          onClick={() => setPreviewSubTab('overview')}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[#6E635D] hover:text-[#292522] hover:bg-[#F2EBE0]/70 transition text-left"
                        >
                          <LayoutDashboard className="w-3.5 h-3.5" />
                          <span>Overview</span>
                        </button>
                        <button
                          onClick={() => onNavigateTab('cases')}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#F5EFE6] text-[#541827] font-semibold text-left"
                        >
                          <Scale className="w-3.5 h-3.5 text-[#BF4827]" />
                          <span>Dispute Cases</span>
                        </button>
                        <button
                          onClick={() => onNavigateTab('purchase')}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[#6E635D] hover:text-[#292522] hover:bg-[#F2EBE0]/70 transition text-left"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Agent Checkout</span>
                        </button>
                        <button
                          onClick={() => setPreviewSubTab('audit')}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[#6E635D] hover:text-[#292522] hover:bg-[#F2EBE0]/70 transition text-left"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Audit Ledger</span>
                        </button>
                        <button
                          onClick={() => onNavigateTab('eval')}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[#6E635D] hover:text-[#292522] hover:bg-[#F2EBE0]/70 transition text-left"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Evaluation</span>
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={onOpenSimulator}
                      className="text-[11px] text-[#6E635D] hover:text-[#BF4827] font-medium text-left px-2 py-1.5 rounded-lg hover:bg-[#F2EBE0] transition"
                    >
                      + Simulate Dispute
                    </button>
                  </div>

                  {/* Embedded Case Detail Surface */}
                  <div className="col-span-12 sm:col-span-9 p-5 space-y-4">
                    {/* Case Header */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-[11px] text-[#8C7F77]">
                          Disputes &rsaquo; <span className="text-[#574D48] font-medium">{formattedCaseCode}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h2 className="text-xl font-extrabold text-[#292522] tracking-tight transition-all duration-300">
                            {formattedCaseCode}
                          </h2>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide border transition-colors ${verdictStyle.badge}`}
                          >
                            {activeCase?.verdict?.verdict || 'OPERATOR_AT_FAULT'}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#6E635D] flex flex-wrap items-center gap-2 font-mono">
                          <span>PayPal Order: {activeEp?.paypal_order_id || 'ORDER-SANDBOX'}</span>
                          <span>&bull;</span>
                          <span>Amount: ${activeCase?.disputed_amount || '112.40'}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => onSelectCase(activeCase?.case_id || selectedPreviewId)}
                        className="px-3.5 py-2 bg-[#BF4827] hover:bg-[#A33B1E] text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-sm"
                      >
                        <span>Execute via PayPal</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Sub-tabs */}
                    <div className="flex items-center gap-5 border-b border-[#DCCDBB] text-xs">
                      {[
                        { id: 'overview', label: 'Overview' },
                        { id: 'evidence', label: 'Evidence' },
                        { id: 'checks', label: 'Policy Checks' },
                        { id: 'audit', label: 'Audit Trail' },
                      ].map((t) => {
                        const active = previewSubTab === t.id
                        return (
                          <button
                            key={t.id}
                            onClick={() => setPreviewSubTab(t.id as any)}
                            className={`pb-2.5 font-semibold border-b-2 transition-all duration-200 ${
                              active
                                ? 'border-[#BF4827] text-[#292522]'
                                : 'border-transparent text-[#8C7F77] hover:text-[#292522]'
                            }`}
                          >
                            {t.label}
                          </button>
                        )
                      })}
                    </div>

                    {/* Sub-tab Body */}
                    {previewSubTab === 'overview' && (
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 animate-fade-up">
                        {/* Evidence (4) */}
                        <div className="md:col-span-5 rounded-xl border border-[#DCCDBB] bg-[#FCF9F4] p-3.5 space-y-2.5">
                          <div className="text-xs font-bold text-[#292522]">Evidence (4)</div>
                          <div className="space-y-1.5 text-[11px]">
                            {[
                              { name: 'mandate.json', meta: 'Ed25519' },
                              { name: 'listing.json', meta: `${activeEp?.merchant_listing?.ports_count ?? 8} ports` },
                              { name: 'delivery_report.json', meta: 'Inspected' },
                              {
                                name: 'agent_trace.log',
                                meta: `${activeEp?.candidate_trace?.evaluated_candidates?.length ?? 3} offers`,
                              },
                            ].map((file) => (
                              <div
                                key={file.name}
                                className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-white border border-[#DCCDBB] hover:border-[#BF4827]/60 transition"
                              >
                                <span className="flex items-center gap-2 font-mono text-[#292522] truncate">
                                  <FileCode2 className="w-3.5 h-3.5 text-[#8C7F77] shrink-0" />
                                  <span className="truncate">{file.name}</span>
                                </span>
                                <span className="text-[10px] text-[#8C7F77] font-mono shrink-0">{file.meta}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Deterministic Policy (C1 - C7) */}
                        <div className="md:col-span-7 rounded-xl border border-[#DCCDBB] bg-[#FCF9F4] p-3.5 space-y-2.5">
                          <div className="text-xs font-bold text-[#292522]">Deterministic Policy (C1 – C7)</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                            {(checks.length > 0
                              ? checks
                              : [
                                  { check_id: 'C1', name: 'Signature valid', status: 'PASS' },
                                  { check_id: 'C2', name: 'Not expired', status: 'PASS' },
                                  { check_id: 'C3', name: 'Hash match', status: 'PASS' },
                                  { check_id: 'C4', name: 'Within spend cap', status: 'FAIL' },
                                  { check_id: 'C5', name: 'Merchant allowed', status: 'PASS' },
                                  { check_id: 'C6', name: 'Evidence complete', status: 'PASS' },
                                  { check_id: 'C7', name: 'Trace integrity', status: 'PASS' },
                                ]
                            ).map((chk: any) => (
                              <div key={chk.check_id} className="flex items-center gap-1.5 min-w-0">
                                {chk.status === 'FAIL' ? (
                                  <XCircle className="w-4 h-4 text-[#BF4827] shrink-0" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4 text-[#52705C] shrink-0" />
                                )}
                                <span className="font-mono font-bold text-[#292522] shrink-0">{chk.check_id}</span>
                                <span
                                  className={`truncate ${
                                    chk.status === 'FAIL' ? 'text-[#BF4827] font-semibold' : 'text-[#574D48]'
                                  }`}
                                >
                                  {chk.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {previewSubTab === 'evidence' && (
                      <div className="rounded-xl border border-[#DCCDBB] bg-[#FCF9F4] p-4 space-y-2 text-xs animate-fade-up">
                        <div className="font-bold text-[#292522]">Intent &amp; Delivery Evidence Summary</div>
                        <p className="text-[#574D48] italic">
                          &ldquo;{activeEp?.mandate_pack?.intent?.user_request || 'USB-C docking station request'}&rdquo;
                        </p>
                        <div className="text-[11px] font-mono text-[#6E635D]">
                          Inspector notes: {activeEp?.delivery_report?.inspection_notes || 'Warehouse verified.'}
                        </div>
                      </div>
                    )}

                    {previewSubTab === 'checks' && (
                      <div className="rounded-xl border border-[#DCCDBB] bg-[#FCF9F4] p-3.5 space-y-1.5 max-h-44 overflow-y-auto animate-fade-up">
                        {checks.map((chk) => (
                          <div
                            key={chk.check_id}
                            className="flex items-center justify-between text-[11px] bg-white px-3 py-1.5 rounded-lg border border-[#DCCDBB]"
                          >
                            <span className="font-mono text-[#292522]">
                              <strong>{chk.check_id}</strong> {chk.name}
                            </span>
                            <span className={chk.status === 'FAIL' ? 'text-[#BF4827] font-bold' : 'text-[#52705C] font-bold'}>
                              {chk.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {previewSubTab === 'audit' && (
                      <div className="rounded-xl border border-[#DCCDBB] bg-[#FCF9F4] p-4 space-y-1.5 text-[11px] animate-fade-up">
                        <div className="font-bold text-[#292522]">
                          Ledger Integrity: {ledgerStatus?.intact ? 'INTACT (SHA-256 Verified)' : 'Verified'}
                        </div>
                        <div className="font-mono text-[#6E635D] break-all">
                          Total entries: {ledgerStatus?.total_entries ?? previewDetail?.ledger_events?.length ?? 3}
                        </div>
                      </div>
                    )}

                    {/* Bottom Audit Trail Strip */}
                    <div className="rounded-xl border border-[#DCCDBB] bg-[#FCF9F4] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <Lock className="w-3.5 h-3.5 text-[#6E635D] shrink-0" />
                        <span className="font-semibold text-[#292522] shrink-0">Audit Trail</span>
                        <span className="font-mono text-[11px] text-[#6E635D] truncate">
                          {ledgerStatus?.latest_hash || '7f4c0e6d2b43e9a1e7f291b1c7e0d3a5a2f8e46d9...'}
                        </span>
                      </div>
                      <button
                        onClick={() => onSelectCase(activeCase?.case_id || selectedPreviewId)}
                        className="text-[11px] font-semibold text-[#541827] hover:text-[#BF4827] inline-flex items-center gap-1 shrink-0"
                      >
                        <span>View full trail</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. In Collaboration With PayPal & Sponsors */}
      <CollaborationStrip />

      {/* 3. Continuous Infinite Integrations Marquee */}
      <section className="border-b border-[#DCCDBB] bg-white/55 marquee-wrapper overflow-hidden py-5">
        <div className="animate-marquee flex items-center gap-6">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, idx) => {
            const Icon = item.icon
            return (
              <div
                key={`${item.title}-${idx}`}
                className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-white border border-[#DCCDBB] shadow-sm shrink-0 hover:border-[#BF4827] transition-colors"
              >
                <div className="p-2 rounded-lg bg-[#F8F3EB] text-[#541827]">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#292522] whitespace-nowrap">{item.title}</div>
                  <div className="text-[11px] text-[#6E635D] whitespace-nowrap">{item.sub}</div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 3. Interactive Expandable 4-Step Workflow with Continuous SVG Beam */}
      <section
        ref={workflowReveal.ref}
        className={`py-14 lg:py-16 border-b border-[#DCCDBB] transition-all duration-700 ease-out ${
          workflowReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <h2 className="font-serif editorial-expand-title text-3xl sm:text-4xl font-semibold tracking-tight text-[#541827]">
              From purchase mandate to accountable resolution.
            </h2>
            <span className="text-xs text-[#6E635D]">Live cryptographic pipeline &bull; Click any step</span>
          </div>

          {/* Continuous SVG Data-Packet Beam Connector */}
          <div className="hidden lg:block px-8">
            <svg viewBox="0 0 1000 32" className="w-full h-8 overflow-visible" aria-hidden="true">
              <line x1="60" y1="16" x2="940" y2="16" stroke="#DCCDBB" strokeWidth="2" />
              <path
                id="veripactPipelineBeam"
                d="M 60 16 L 940 16"
                fill="none"
                stroke="#BF4827"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="animate-beam-flow"
              />
              {/* Traveling glowing packet */}
              <circle r="5" fill="#BF4827">
                <animateMotion dur="3.6s" repeatCount="indefinite" path="M 60 16 L 940 16" />
              </circle>
              <circle r="5" fill="#52705C">
                <animateMotion dur="3.6s" begin="1.8s" repeatCount="indefinite" path="M 60 16 L 940 16" />
              </circle>
              {[60, 353, 646, 940].map((cx, i) => (
                <g key={cx}>
                  <circle cx={cx} cy="16" r="7" fill="#F8F3EB" stroke={i === 3 ? '#52705C' : '#541827'} strokeWidth="2.2" />
                  <circle cx={cx} cy="16" r="2.8" fill={i === 3 ? '#52705C' : '#BF4827'} />
                </g>
              ))}
            </svg>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                num: '01',
                title: 'Bind mandate',
                desc: 'Sign buyer intent, spend caps, and product specs (Ed25519) and attach directly to the PayPal order.',
                detail: 'IntentMandate + CartMandate canonical JSON hashed with SHA-256 and bound to Orders v2 custom_id.',
                hasArrow: true,
              },
              {
                num: '02',
                title: 'Ingest evidence',
                desc: 'Collect dispute webhooks, merchant listings, warehouse delivery reports, and agent reasoning traces.',
                detail: 'PayPal webhook signatures are verified via /v1/notifications/verify-webhook-signature.',
                hasArrow: true,
              },
              {
                num: '03',
                title: 'Evaluate policy',
                desc: 'Run deterministic C1–C7 checks plus a constrained AI arbiter to determine exact financial liability.',
                detail: 'Deterministic rules take strict precedence over LLM classification (prompt-injection shielded).',
                hasArrow: true,
              },
              {
                num: '04',
                title: 'Resolve dispute',
                desc: 'Preview the PayPal Disputes API payload and execute refund, evidence, or offer in one click.',
                detail: 'HATEOAS-validated execution writes a permanent SHA-256 chained audit event to the ledger.',
                hasArrow: false,
              },
            ].map((step) => {
              const isOpen = expandedStep === step.num
              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => setExpandedStep(isOpen ? '' : step.num)}
                  className={`text-left rounded-2xl p-5 border transition-all duration-300 ${
                    isOpen
                      ? 'bg-white border-[#BF4827] shadow-md -translate-y-0.5'
                      : 'bg-white/70 border-[#DCCDBB] hover:bg-white hover:border-[#BF4827]/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-baseline gap-2.5">
                      <span
                        className={`font-serif font-medium tabular-nums transition-all duration-300 ${
                          isOpen ? 'text-4xl text-[#BF4827]' : 'text-3xl text-[#541827]'
                        }`}
                      >
                        {step.num}
                      </span>
                      <h3
                        className={`font-bold transition-all duration-300 ${
                          isOpen ? 'text-base text-[#541827] tracking-[0.012em]' : 'text-sm text-[#292522]'
                        }`}
                      >
                        {step.title}
                      </h3>
                    </div>
                    {step.hasArrow && (
                      <ArrowRight
                        className={`w-4 h-4 hidden lg:block shrink-0 transition-transform duration-300 ${
                          isOpen ? 'text-[#BF4827] translate-x-1' : 'text-[#C5B9AB]'
                        }`}
                      />
                    )}
                  </div>
                  <p className="text-xs text-[#574D48] leading-relaxed">{step.desc}</p>

                  {/* Smooth CSS Grid Expand */}
                  <div
                    className={`grid transition-all duration-300 ease-out ${
                      isOpen ? 'grid-rows-[1fr] opacity-100 mt-3 pt-3 border-t border-[#DCCDBB]' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden text-[11px] font-mono text-[#541827] leading-relaxed">
                      {step.detail}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* 4. Interactive Animated Telemetry Chart & Verdict Matrix Section */}
      <section
        ref={chartReveal.ref}
        className={`py-14 lg:py-16 border-b border-[#DCCDBB] bg-white/60 transition-all duration-700 ease-out ${
          chartReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#BF4827] flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" />
                Live Telemetry &amp; Fault Distribution
              </div>
              <h2 className="font-serif editorial-expand-title text-3xl font-semibold tracking-tight text-[#541827]">
                Auditable arbiter signals at a glance.
              </h2>
            </div>
            <button
              onClick={() => onNavigateTab('eval')}
              className="text-xs font-semibold text-[#541827] hover:text-[#BF4827] inline-flex items-center gap-1.5 transition"
            >
              <span>Inspect full 15-scenario matrix</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Animated Curved SVG Chart with Live Pulse & Auto-Cycle */}
            <div
              onMouseEnter={() => setIsChartHovered(true)}
              onMouseLeave={() => setIsChartHovered(false)}
              className="lg:col-span-7 bg-white rounded-2xl border border-[#DCCDBB] p-6 shadow-sm space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#292522]">Verification Accuracy &amp; Fault Trajectory</h3>
                  <p className="text-xs text-[#6E635D]">
                    Auto-sweeping checkpoints (hover any dot to lock inspection).
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-[#574D48]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#52705C]" /> Verified
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#BF4827]" /> Breach
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#541827]" /> Regret
                  </span>
                </div>
              </div>

              <div className="relative bg-[#FCF9F4] rounded-xl border border-[#DCCDBB] p-4">
                <svg
                  viewBox={`0 0 ${chartPoints.width} ${chartPoints.height}`}
                  className="w-full h-44 overflow-visible"
                  role="img"
                  aria-label="Verification accuracy and fault trend chart"
                >
                  <defs>
                    <linearGradient id="veripactForestArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#52705C" stopOpacity="0.24" />
                      <stop offset="100%" stopColor="#52705C" stopOpacity="0.01" />
                    </linearGradient>
                  </defs>

                  {[0.2, 0.5, 0.8].map((ratio) => (
                    <line
                      key={ratio}
                      x1={20}
                      y1={chartPoints.padY + ratio * (chartPoints.height - chartPoints.padY * 2)}
                      x2={chartPoints.width - 20}
                      y2={chartPoints.padY + ratio * (chartPoints.height - chartPoints.padY * 2)}
                      stroke="#DCCDBB"
                      strokeDasharray="3 4"
                      strokeWidth="0.9"
                    />
                  ))}

                  <path d={chartPoints.verifiedArea} fill="url(#veripactForestArea)" className="animate-area-fade" />
                  <path
                    d={chartPoints.verifiedLine}
                    fill="none"
                    stroke="#52705C"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    className="animate-draw-path"
                  />
                  {/* Continuous subtle pulse beam along Verified path */}
                  <path
                    d={chartPoints.verifiedLine}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeOpacity="0.55"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    className="animate-beam-flow"
                  />
                  <path
                    d={chartPoints.breachLine}
                    fill="none"
                    stroke="#BF4827"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="animate-draw-path"
                  />
                  <path
                    d={chartPoints.regretLine}
                    fill="none"
                    stroke="#541827"
                    strokeWidth="1.8"
                    strokeDasharray="4 3"
                    strokeLinecap="round"
                    className="animate-draw-path"
                  />

                  {chartPoints.verifiedPts.map((pt, idx) => {
                    const isHovered = hoveredChartIdx === idx
                    const bPt = chartPoints.breachPts[idx]
                    return (
                      <g
                        key={idx}
                        onMouseEnter={() => setHoveredChartIdx(idx)}
                        className="cursor-pointer"
                      >
                        {isHovered && (
                          <>
                            <line
                              x1={pt.x}
                              y1={chartPoints.padY}
                              x2={pt.x}
                              y2={chartPoints.height - chartPoints.padY}
                              stroke="#541827"
                              strokeOpacity="0.25"
                              strokeWidth="1"
                            />
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r="6"
                              fill="none"
                              stroke="#52705C"
                              strokeWidth="1.5"
                              className="animate-ping-slow"
                            />
                          </>
                        )}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 5.5 : 3.5}
                          fill="#FFFFFF"
                          stroke="#52705C"
                          strokeWidth="2.2"
                          className="transition-all duration-200"
                        />
                        <circle
                          cx={bPt.x}
                          cy={bPt.y}
                          r={isHovered ? 4.5 : 2.8}
                          fill="#FFFFFF"
                          stroke="#BF4827"
                          strokeWidth="2"
                          className="transition-all duration-200"
                        />
                        <text
                          x={pt.x}
                          y={chartPoints.height - 2}
                          textAnchor="middle"
                          fontSize="9"
                          fill={isHovered ? '#541827' : '#8C7F77'}
                          fontWeight={isHovered ? '700' : '500'}
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {CHART_SERIES[idx].label}
                        </text>
                      </g>
                    )
                  })}
                </svg>

                {/* Live Interactive Checkpoint Readout */}
                <div className="mt-2 pt-2.5 border-t border-[#DCCDBB] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <span className="text-[#541827] font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#52705C] animate-pulse" />
                    Checkpoint {CHART_SERIES[hoveredChartIdx].label}
                  </span>
                  <div className="flex flex-wrap items-center gap-4 text-[11px]">
                    <span className="text-[#52705C] font-semibold">
                      Verified: {CHART_SERIES[hoveredChartIdx].verified}%
                    </span>
                    <span className="text-[#BF4827] font-semibold">
                      Breach Rate: {CHART_SERIES[hoveredChartIdx].breach}%
                    </span>
                    <span className="text-[#541827] font-semibold">
                      Regret: {CHART_SERIES[hoveredChartIdx].regret}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Animated Verdict Class Accuracy Bars */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-[#DCCDBB] p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#292522]">Eval Accuracy by Verdict Class</h3>
                <p className="text-xs text-[#6E635D]">
                  Live benchmark pass rates ({evalSummary ? `${evalSummary.passed_scenarios}/${evalSummary.total_scenarios}` : '15/15'} scenarios).
                </p>
              </div>

              <div className="space-y-3.5 pt-1">
                {evalBreakdownEntries.map((item, idx) => {
                  const barColor =
                    item.name === 'MERCHANT_AT_FAULT'
                      ? 'bg-[#BF4827]'
                      : item.name === 'OPERATOR_AT_FAULT'
                      ? 'bg-[#541827]'
                      : item.name === 'NO_FAULT'
                      ? 'bg-[#52705C]'
                      : 'bg-[#8C5B2B]'
                  return (
                    <div key={item.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="font-semibold text-[#292522]">{item.name}</span>
                        <span className="text-[#52705C] font-bold tabular-nums">
                          {item.count} ({item.pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-[#F2EBE0] overflow-hidden border border-[#DCCDBB]/60">
                        <div
                          className={`h-full rounded-full ${barColor} transition-all duration-1000 ease-out`}
                          style={{
                            width: barsMounted ? `${item.pct}%` : '0%',
                            transitionDelay: `${idx * 100}ms`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Live Animated Evidence JSON Record + Expandable Why Veripact */}
      <section
        ref={evidenceReveal.ref}
        className={`py-14 lg:py-16 transition-all duration-700 ease-out ${
          evidenceReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Animated Code Scanner Card */}
          <div
            onMouseEnter={() => setIsCodeHovered(true)}
            onMouseLeave={() => setIsCodeHovered(false)}
            className="lg:col-span-6"
          >
            <div className="bg-white rounded-2xl border border-[#DCCDBB] shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
              <div className="px-4 py-2.5 border-b border-[#DCCDBB] bg-[#FCF9F4] flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 font-semibold text-[#292522]">
                  <FileCode2 className="w-4 h-4 text-[#BF4827]" />
                  Evidence Record <span className="font-mono text-[#6E635D] font-normal">(mandate.json)</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[#52705C] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#52705C] animate-pulse" />
                  LIVE VERIFIED
                </span>
              </div>

              <div className="p-4 bg-[#F8F3EB]/60 font-mono text-xs leading-6 overflow-x-auto">
                {jsonSnippetLines.map((line, i) => {
                  const isScanned = activeCodeLine === i
                  return (
                    <div
                      key={i}
                      onMouseEnter={() => setActiveCodeLine(i)}
                      className={`flex gap-4 px-2 rounded transition-all duration-300 border-l-2 ${
                        isScanned
                          ? 'bg-white/90 border-[#BF4827] shadow-[0_1px_4px_rgba(84,24,39,0.06)]'
                          : 'border-transparent'
                      }`}
                    >
                      <span className="w-4 text-right text-[#B3A69A] select-none shrink-0">{i + 1}</span>
                      <span
                        className={
                          line.includes('"verdict"') || line.includes('"captured_amount"')
                            ? 'text-[#BF4827] font-semibold'
                            : line.includes(':')
                            ? 'text-[#541827]'
                            : 'text-[#6E635D]'
                        }
                      >
                        {line}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right Expandable Why Veripact */}
          <div className="lg:col-span-6 space-y-5">
            <h2 className="font-serif editorial-expand-title text-3xl font-semibold tracking-tight text-[#541827]">
              Why Veripact
            </h2>

            <div className="space-y-3">
              {[
                {
                  title: 'Deterministic by design',
                  summary: `C1–C7 policy checks with verifiable logic (${evalSummary ? `${evalSummary.accuracy_pct}%` : '100%'} eval pass rate).`,
                  more: 'Every intent signature, nonce expiry, SHA-256 cart digest, allowed merchant list, and spend cap is verified via pure Python functions before any LLM runs.',
                },
                {
                  title: 'Tamper-evident audit',
                  summary: `Hash-chained SHA-256 records for every mandate and decision (${ledgerStatus?.total_entries ?? 3} sealed entries live).`,
                  more: 'Each ledger entry embeds prev_hash and entry_hash so modifying any historical verdict or evidence field is detected immediately via /api/cases/ledger/verify.',
                },
                {
                  title: 'PayPal-native execution',
                  summary: 'Automated dispute resolution via Orders v2, Webhooks, and Customer Disputes API.',
                  more: 'Action plans strictly inspect PayPal HATEOAS links and allowed response options before dispatching accept-claim, provide-evidence, or make-offer.',
                },
              ].map((item, idx) => {
                const open = expandedWhy === idx
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => setExpandedWhy(open ? -1 : idx)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-300 ${
                      open
                        ? 'bg-white border-[#BF4827]/70 shadow-sm'
                        : 'bg-white/60 border-[#DCCDBB] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 w-5 h-5 rounded-full border border-[#DCCDBB] bg-[#F8F3EB] flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#52705C]" />
                        </div>
                        <div className="text-sm text-[#574D48] leading-relaxed">
                          <strong
                            className={`font-semibold transition-all duration-300 ${
                              open ? 'text-[#541827] text-[15px] tracking-[0.01em]' : 'text-[#292522]'
                            }`}
                          >
                            {item.title}
                          </strong>{' '}
                          &mdash; {item.summary}
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-[#6E635D] shrink-0 mt-1 transition-transform duration-300 ${
                          open ? 'rotate-180 text-[#BF4827]' : ''
                        }`}
                      />
                    </div>

                    <div
                      className={`grid transition-all duration-300 ease-out ${
                        open ? 'grid-rows-[1fr] opacity-100 mt-2.5 pt-2.5 border-t border-[#DCCDBB]/70' : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden pl-8 text-xs text-[#6E635D] leading-relaxed">
                        {item.more}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => onSelectCase(activeCase?.case_id || selectedPreviewId)}
                className="px-4 py-2 bg-white hover:bg-[#F2EBE0] border border-[#DCCDBB] rounded-lg text-xs font-semibold text-[#541827] inline-flex items-center gap-1.5 transition"
              >
                <Clock className="w-3.5 h-3.5 text-[#BF4827]" />
                <span>Inspect Full Case Evidence</span>
              </button>
              <button
                onClick={() => onNavigateTab('eval')}
                className="px-4 py-2 bg-white hover:bg-[#F2EBE0] border border-[#DCCDBB] rounded-lg text-xs font-semibold text-[#292522] inline-flex items-center gap-1.5 transition"
              >
                <span>Open 15-Scenario Eval Matrix</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#BF4827]" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Bottom Deep Oxblood Burgundy Banner */}
      <section className="relative overflow-hidden bg-gradient-to-r from-[#3D101B] via-[#541827] to-[#681F31] text-white">
        <div
          className="absolute right-0 top-0 bottom-0 w-44 bg-[#BF4827]/20 -skew-x-12 translate-x-12 pointer-events-none"
          aria-hidden="true"
        />
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-9 relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <h2 className="font-serif editorial-expand-title text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Make autonomous commerce accountable.
          </h2>

          <p className="text-xs sm:text-sm text-rose-100/85 max-w-md leading-relaxed">
            Test real PayPal Sandbox checkout, run deterministic C1–C7 dispute checks, and inspect tamper-evident
            audit proofs live.
          </p>

          <button
            onClick={() => onNavigateTab('purchase')}
            className="group px-5 py-3 bg-[#BF4827] hover:bg-[#A33B1E] text-white rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-2 shadow-md transition-all self-start lg:self-auto shrink-0"
          >
            <span>Try Live Demo</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>
    </div>
  )
}
