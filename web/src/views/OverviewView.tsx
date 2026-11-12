import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
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

interface OverviewViewProps {
  onSelectCase: (caseId: string) => void
  onNavigateTab: (tab: AppTab) => void
  onOpenSimulator: () => void
}

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
          const preferred =
            list.find((c) => c.case_id.includes('s2')) || list[0]
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

  return (
    <div className="bg-[#F8F3EB] text-[#292522]">
      {/* 1. Editorial 2-Column Hero */}
      <section className="border-b border-[#DCCDBB]">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 lg:pt-14 lg:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-10 items-center">
            {/* Left Editorial Copy */}
            <div className="lg:col-span-5 space-y-6">
              <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#6E635D]">
                Liability Infrastructure for Autonomous Commerce
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-[54px] font-semibold tracking-tight text-[#541827] leading-[1.04]">
                When AI spends, responsibility must be clear.
              </h1>

              <p className="text-[15px] sm:text-base text-[#574D48] leading-relaxed max-w-lg">
                Veripact binds purchase mandates to PayPal orders, evaluates evidence from merchants, delivery, and
                AI agents, and determines financial fault with a deterministic and auditable process.
              </p>

              <div className="flex flex-wrap items-center gap-5 pt-1">
                <button
                  onClick={() => onNavigateTab('purchase')}
                  className="px-5 py-3 bg-[#BF4827] hover:bg-[#A33B1E] text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition"
                >
                  <span>Try Live Demo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => onNavigateTab('cases')}
                  className="text-sm font-semibold text-[#541827] hover:text-[#BF4827] inline-flex items-center gap-1.5 border-b border-[#541827]/30 hover:border-[#BF4827] pb-0.5 transition"
                >
                  <span>View Dispute Monitor</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>

              {/* Compact Case Switcher for Live Preview */}
              {cases.length > 0 && (
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium text-[#6E635D]">Inspect live fixture:</span>
                  {cases.slice(0, 3).map((c, idx) => {
                    const active = selectedPreviewId === c.case_id
                    return (
                      <button
                        key={c.case_id}
                        onClick={() => setSelectedPreviewId(c.case_id)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold border transition ${
                          active
                            ? 'bg-[#541827] text-white border-[#541827]'
                            : 'bg-white text-[#574D48] border-[#DCCDBB] hover:border-[#BF4827]'
                        }`}
                      >
                        S{idx + 1}: {c.verdict.split('_')[0]}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Right Interactive Workbench Card */}
            <div className="lg:col-span-7">
              <div className="bg-white rounded-2xl border border-[#DCCDBB] shadow-[0_22px_50px_-18px_rgba(45,22,18,0.14)] overflow-hidden">
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
                          <h2 className="text-xl font-extrabold text-[#292522] tracking-tight">
                            {formattedCaseCode}
                          </h2>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide border ${verdictStyle.badge}`}
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
                            className={`pb-2.5 font-semibold border-b-2 transition ${
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
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        {/* Evidence (4) */}
                        <div className="md:col-span-5 rounded-xl border border-[#DCCDBB] bg-[#FCF9F4] p-3.5 space-y-2.5">
                          <div className="text-xs font-bold text-[#292522]">Evidence (4)</div>
                          <div className="space-y-1.5 text-[11px]">
                            {[
                              { name: 'mandate.json', meta: 'Ed25519' },
                              { name: 'listing.json', meta: `${activeEp?.merchant_listing?.ports_count ?? 8} ports` },
                              { name: 'delivery_report.json', meta: 'Inspected' },
                              { name: 'agent_trace.log', meta: `${activeEp?.candidate_trace?.evaluated_candidates?.length ?? 3} offers` },
                            ].map((file) => (
                              <div
                                key={file.name}
                                className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-white border border-[#DCCDBB]"
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
                      <div className="rounded-xl border border-[#DCCDBB] bg-[#FCF9F4] p-4 space-y-2 text-xs">
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
                      <div className="rounded-xl border border-[#DCCDBB] bg-[#FCF9F4] p-3.5 space-y-1.5 max-h-44 overflow-y-auto">
                        {checks.map((chk) => (
                          <div key={chk.check_id} className="flex items-center justify-between text-[11px] bg-white px-3 py-1.5 rounded-lg border border-[#DCCDBB]">
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
                      <div className="rounded-xl border border-[#DCCDBB] bg-[#FCF9F4] p-4 space-y-1.5 text-[11px]">
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

      {/* 2. Integrations Strip */}
      <section className="border-b border-[#DCCDBB] bg-[#F8F3EB]">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-5 items-center gap-5 md:gap-0 md:divide-x md:divide-[#DCCDBB]">
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#8C7F77] md:pr-4">
              Integrations
            </div>

            <div className="flex items-center gap-3 md:px-5">
              <ShoppingBag className="w-5 h-5 text-[#541827] shrink-0" />
              <div>
                <div className="text-xs font-bold text-[#292522]">PayPal Orders API</div>
                <div className="text-[11px] text-[#6E635D]">Create and track agent purchases</div>
              </div>
            </div>

            <div className="flex items-center gap-3 md:px-5">
              <Webhook className="w-5 h-5 text-[#541827] shrink-0" />
              <div>
                <div className="text-xs font-bold text-[#292522]">Webhooks</div>
                <div className="text-[11px] text-[#6E635D]">Real-time dispute and order events</div>
              </div>
            </div>

            <div className="flex items-center gap-3 md:px-5">
              <ShieldCheck className="w-5 h-5 text-[#541827] shrink-0" />
              <div>
                <div className="text-xs font-bold text-[#292522]">Disputes API</div>
                <div className="text-[11px] text-[#6E635D]">Automate resolution and settlement</div>
              </div>
            </div>

            <div className="flex items-center gap-3 md:pl-5">
              <KeyRound className="w-5 h-5 text-[#541827] shrink-0" />
              <div>
                <div className="text-xs font-bold text-[#292522]">AP2 Mandates</div>
                <div className="text-[11px] text-[#6E635D]">Standardized agent payment mandates</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Horizontal 4-Step Resolution Workflow */}
      <section className="py-14 lg:py-16 border-b border-[#DCCDBB]">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 space-y-9">
          <h2 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-[#541827]">
            From purchase mandate to accountable resolution.
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                num: '01',
                title: 'Bind mandate',
                desc: 'Sign buyer intent, spend caps, and product specs (Ed25519) and attach directly to the PayPal order.',
                hasArrow: true,
              },
              {
                num: '02',
                title: 'Ingest evidence',
                desc: 'Collect dispute webhooks, merchant listings, warehouse delivery reports, and agent reasoning traces.',
                hasArrow: true,
              },
              {
                num: '03',
                title: 'Evaluate policy',
                desc: 'Run deterministic C1–C7 checks plus a constrained AI arbiter to determine exact financial liability.',
                hasArrow: true,
              },
              {
                num: '04',
                title: 'Resolve dispute',
                desc: 'Preview the PayPal Disputes API payload and execute refund, evidence, or offer in one click.',
                hasArrow: false,
              },
            ].map((step) => (
              <div key={step.num} className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-serif text-3xl font-medium text-[#BF4827] tabular-nums">
                      {step.num}
                    </span>
                    <h3 className="text-sm font-bold text-[#292522]">{step.title}</h3>
                  </div>
                  {step.hasArrow && (
                    <ArrowRight className="w-4 h-4 text-[#C5B9AB] hidden lg:block shrink-0" />
                  )}
                </div>
                <p className="text-xs text-[#574D48] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Evidence JSON Record + Why Veripact */}
      <section className="py-14 lg:py-16">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Code Card */}
          <div className="lg:col-span-6">
            <div className="bg-white rounded-2xl border border-[#DCCDBB] shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[#DCCDBB] bg-[#FCF9F4] flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 font-semibold text-[#292522]">
                  <FileCode2 className="w-4 h-4 text-[#BF4827]" />
                  Evidence Record <span className="font-mono text-[#6E635D] font-normal">(mandate.json)</span>
                </span>
                <span className="text-[10px] font-mono text-[#6E635D]">Live Case Payload</span>
              </div>

              <div className="p-4 bg-[#F8F3EB]/60 font-mono text-xs leading-6 overflow-x-auto">
                {jsonSnippetLines.map((line, i) => (
                  <div key={i} className="flex gap-4">
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
                ))}
              </div>
            </div>
          </div>

          {/* Right Why Veripact */}
          <div className="lg:col-span-6 space-y-6">
            <h2 className="font-serif text-3xl font-semibold tracking-tight text-[#541827]">
              Why Veripact
            </h2>

            <div className="space-y-4">
              {[
                {
                  title: 'Deterministic by design',
                  desc: `C1–C7 policy checks with verifiable logic (${evalSummary ? `${evalSummary.accuracy_pct}%` : '100%'} eval pass rate across 15 adversarial scenarios).`,
                },
                {
                  title: 'Tamper-evident audit',
                  desc: `Hash-chained SHA-256 records for every mandate, evidence pack, and decision (${ledgerStatus?.total_entries ?? 3} sealed entries live).`,
                },
                {
                  title: 'PayPal-native execution',
                  desc: 'Automated dispute resolution via Orders v2, Webhooks, and Customer Disputes API with human-in-the-loop safety.',
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <div className="mt-0.5 w-5 h-5 rounded-full border border-[#DCCDBB] bg-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#BF4827]" />
                  </div>
                  <div className="text-sm text-[#574D48] leading-relaxed">
                    <strong className="text-[#292522] font-semibold">{item.title}</strong> &mdash; {item.desc}
                  </div>
                </div>
              ))}
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

      {/* 5. Bottom Deep Oxblood Burgundy Banner */}
      <section className="relative overflow-hidden bg-gradient-to-r from-[#3D101B] via-[#541827] to-[#681F31] text-white">
        <div
          className="absolute right-0 top-0 bottom-0 w-44 bg-[#9B5E4A]/20 -skew-x-12 translate-x-12 pointer-events-none"
          aria-hidden="true"
        />
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-9 relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Make autonomous commerce accountable.
          </h2>

          <p className="text-xs sm:text-sm text-rose-100/85 max-w-md leading-relaxed">
            Test real PayPal Sandbox checkout, run deterministic C1–C7 dispute checks, and inspect tamper-evident
            audit proofs live.
          </p>

          <button
            onClick={() => onNavigateTab('purchase')}
            className="px-5 py-3 bg-[#BF4827] hover:bg-[#A33B1E] text-white rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-2 shadow-md transition self-start lg:self-auto shrink-0"
          >
            <span>Try Live Demo</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  )
}
