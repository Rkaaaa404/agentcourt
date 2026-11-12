import { useState, useEffect, useMemo } from 'react'
import {
  FileText,
  CheckCircle2,
  XCircle,
  Search,
  RotateCw,
  AlertCircle,
} from 'lucide-react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import { veripactGridTheme, VERDICT_STYLES } from '../agGridSetup'
import { useCountUp, useInViewReveal } from '../hooks/useMotion'
import { EvalResultsResponse, EvalScenarioResult } from '../types'

export default function EvaluationView() {
  const [evalData, setEvalData] = useState<EvalResultsResponse | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchResults()
  }, [])

  const fetchResults = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/eval/results')
      if (!resp.ok) throw new Error('Failed to fetch evaluation metrics')
      const data = await resp.json()
      setEvalData(data)
    } catch (err: any) {
      setError(err.message || 'Error loading evaluation')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredResults = useMemo(
    () =>
      evalData?.results?.filter((r: EvalScenarioResult) => {
        const matchesCat = filterCategory === 'ALL' || r.category === filterCategory
        return matchesCat
      }) || [],
    [evalData, filterCategory]
  )

  const categories = useMemo(
    () => ['ALL', ...Array.from(new Set(evalData?.results?.map((r) => r.category) || []))],
    [evalData]
  )

  const animatedTotal = useCountUp(evalData?.total_scenarios || 0, 750, 0)
  const animatedAccuracy = useCountUp(evalData?.accuracy_pct || 0, 850, 0)
  const animatedElapsed = useCountUp(evalData?.elapsed_ms || 0, 800, 1)
  const gridReveal = useInViewReveal(0.08)

  const columnDefs = useMemo<ColDef<EvalScenarioResult>[]>(
    () => [
      {
        headerName: 'Scenario ID',
        field: 'id',
        width: 155,
        cellRenderer: (p: ICellRendererParams<EvalScenarioResult>) => (
          <span className="font-mono text-[11px] text-[#BF4827] font-semibold">{p.value}</span>
        ),
      },
      {
        headerName: 'Scenario Description',
        field: 'name',
        minWidth: 260,
        flex: 1.5,
        cellRenderer: (p: ICellRendererParams<EvalScenarioResult>) => (
          <span className="font-medium text-[#292522]">{p.value}</span>
        ),
      },
      {
        headerName: 'Category',
        field: 'category',
        width: 150,
        cellRenderer: (p: ICellRendererParams<EvalScenarioResult>) => (
          <span className="px-2 py-0.5 rounded-md bg-[#F8F3EB] border border-[#DCCDBB] text-[10px] font-semibold text-[#574D48]">
            {p.value}
          </span>
        ),
      },
      {
        headerName: 'Expected',
        field: 'expected',
        width: 190,
        cellRenderer: (p: ICellRendererParams<EvalScenarioResult>) => {
          const st = VERDICT_STYLES[p.value] || VERDICT_STYLES.NEEDS_HUMAN
          return (
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${st.badge}`}>
              {p.value}
            </span>
          )
        },
      },
      {
        headerName: 'Actual',
        field: 'actual',
        width: 190,
        cellRenderer: (p: ICellRendererParams<EvalScenarioResult>) => {
          const st = VERDICT_STYLES[p.value] || VERDICT_STYLES.NEEDS_HUMAN
          return (
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${st.badge}`}>
              {p.value}
            </span>
          )
        },
      },
      {
        headerName: 'Status',
        field: 'passed',
        width: 100,
        cellRenderer: (p: ICellRendererParams<EvalScenarioResult>) =>
          p.value ? (
            <span className="inline-flex items-center gap-1 text-[#52705C] font-bold text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" /> PASS
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[#BF4827] font-bold text-[11px]">
              <XCircle className="w-3.5 h-3.5" /> FAIL
            </span>
          ),
      },
    ],
    []
  )

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* View Header */}
      <div className="bg-white border border-[#DCCDBB] rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm veripact-stagger-1">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#541827] flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-[#BF4827]" />
            15-Scenario Adversarial Evaluation Matrix (AG Grid)
          </h2>
          <p className="text-xs text-[#6E635D] mt-1 max-w-2xl">
            Deterministic &amp; AI safety benchmark across baseline, tampered signature, price drift, replay attack,
            unauthorized merchant, prompt-injection shield, and regret scenarios.
          </p>
        </div>

        <button
          onClick={fetchResults}
          disabled={isLoading}
          className="px-4 py-2 bg-[#BF4827] hover:bg-[#A33B1E] text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50 self-start md:self-auto shadow-sm"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Evaluation
        </button>
      </div>

      {error && (
        <div className="p-4 bg-[#FAEDE9] border border-[#EBC4BA] rounded-xl text-xs text-[#BF4827] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      {evalData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-[#DCCDBB] rounded-2xl p-4 space-y-1 shadow-sm veripact-stagger-1 veripact-card-hover">
            <span className="text-[11px] text-[#6E635D] uppercase tracking-wider font-semibold">Total Scenarios</span>
            <div className="text-2xl font-extrabold text-[#541827] tabular-nums">{animatedTotal}</div>
            <span className="text-[10px] text-[#52705C] font-semibold">100% Reproducible Fixtures</span>
          </div>

          <div className="bg-white border border-[#DCCDBB] rounded-2xl p-4 space-y-1 shadow-sm veripact-stagger-2 veripact-card-hover">
            <span className="text-[11px] text-[#6E635D] uppercase tracking-wider font-semibold">Accuracy Score</span>
            <div className="text-2xl font-extrabold text-[#52705C] tabular-nums">{animatedAccuracy}%</div>
            <span className="text-[10px] text-[#6E635D]">{evalData.passed_scenarios} / {evalData.total_scenarios} Passed</span>
          </div>

          <div className="bg-white border border-[#DCCDBB] rounded-2xl p-4 space-y-1 shadow-sm veripact-stagger-3 veripact-card-hover">
            <span className="text-[11px] text-[#6E635D] uppercase tracking-wider font-semibold">Execution Time</span>
            <div className="text-2xl font-extrabold text-[#BF4827] tabular-nums">{animatedElapsed} ms</div>
            <span className="text-[10px] text-[#6E635D]">Pure In-Memory Evaluation</span>
          </div>

          <div className="bg-white border border-[#DCCDBB] rounded-2xl p-4 space-y-1 shadow-sm veripact-stagger-4 veripact-card-hover">
            <span className="text-[11px] text-[#6E635D] uppercase tracking-wider font-semibold">Verdict Classes</span>
            <div className="text-2xl font-extrabold text-[#541827] tabular-nums">5 / 5</div>
            <span className="text-[10px] text-[#6E635D]">All Verdict Categories Covered</span>
          </div>
        </div>
      )}

      {/* Verdict Class Breakdown Cards */}
      {evalData?.class_breakdown && (
        <div className="bg-white border border-[#DCCDBB] rounded-2xl p-5 shadow-sm space-y-3 veripact-stagger-5">
          <h3 className="text-xs font-bold text-[#541827] uppercase tracking-wider">
            Accuracy by Verdict Class
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            {Object.entries(evalData.class_breakdown).map(([clsName, stat], idx) => (
              <div
                key={clsName}
                style={{ animationDelay: `${idx * 70}ms` }}
                className="p-3 bg-[#F8F3EB] rounded-xl border border-[#DCCDBB] space-y-2 hover:border-[#BF4827]/70 transition veripact-card-hover animate-fade-up"
              >
                <div className="font-mono text-[11px] text-[#292522] font-bold truncate">{clsName}</div>
                <div className="flex justify-between text-[11px] text-[#6E635D] font-mono">
                  <span>{stat.correct}/{stat.total}</span>
                  <span className="text-[#52705C] font-bold">{stat.accuracy_pct}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#E6DCD0] overflow-hidden">
                  <div
                    className="h-full bg-[#52705C] rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${stat.accuracy_pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scenarios AG Grid */}
      <div
        ref={gridReveal.ref}
        className={`bg-white border border-[#DCCDBB] rounded-2xl overflow-hidden shadow-sm space-y-4 p-5 transition-all duration-700 ${
          gridReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-[#8C7F77] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search scenarios, IDs, or verdicts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-[#DCCDBB] rounded-xl pl-9 pr-4 py-2 text-xs text-[#292522] focus:outline-none focus:border-[#BF4827]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-lg transition font-semibold ${
                  filterCategory === cat
                    ? 'bg-[#BF4827] text-white'
                    : 'text-[#6E635D] hover:text-[#292522] bg-[#F8F3EB] border border-[#DCCDBB]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full rounded-xl overflow-hidden border border-[#DCCDBB]">
          <AgGridReact<EvalScenarioResult>
            theme={veripactGridTheme}
            rowData={filteredResults}
            columnDefs={columnDefs}
            quickFilterText={searchQuery}
            domLayout="autoHeight"
            defaultColDef={{
              sortable: true,
              resizable: true,
              filter: true,
            }}
          />
        </div>
      </div>
    </div>
  )
}
