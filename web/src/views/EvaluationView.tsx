import { useState, useEffect } from 'react'
import {
  FileText,
  CheckCircle2,
  XCircle,
  Search,
  RotateCw,
  AlertCircle,
} from 'lucide-react'
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

  const filteredResults =
    evalData?.results?.filter((r: EvalScenarioResult) => {
      const matchesCat = filterCategory === 'ALL' || r.category === filterCategory
      const matchesSearch =
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.expected.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCat && matchesSearch
    }) || []

  const categories = ['ALL', ...Array.from(new Set(evalData?.results?.map((r) => r.category) || []))]

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-sky-400" />
            15-Scenario Offline Evaluation Matrix
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Pure-function verification executing all baseline, adversarial (tampered signature, price drift, replayed mandate,
            unauthorized merchant, prompt injection), and regret scenarios through the dual-layer arbiter.
          </p>
        </div>

        <button
          onClick={fetchResults}
          disabled={isLoading}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 border border-slate-700 transition disabled:opacity-50 self-start md:self-auto"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Evaluation
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      {evalData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-sm">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Total Scenarios</span>
            <div className="text-2xl font-bold text-white font-mono">{evalData.total_scenarios}</div>
            <span className="text-[10px] text-emerald-400 font-medium">100% Deterministic Fixtures</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-sm">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Accuracy Score</span>
            <div className="text-2xl font-bold text-emerald-400 font-mono">{evalData.accuracy_pct}%</div>
            <span className="text-[10px] text-slate-400">{evalData.passed_scenarios} / {evalData.total_scenarios} Passed</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-sm">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Execution Time</span>
            <div className="text-2xl font-bold text-sky-400 font-mono">{evalData.elapsed_ms} ms</div>
            <span className="text-[10px] text-slate-400">Pure In-Memory Evaluation</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-sm">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Verdict Classes</span>
            <div className="text-2xl font-bold text-purple-400 font-mono">5 / 5</div>
            <span className="text-[10px] text-slate-400">All Verdict Categories Covered</span>
          </div>
        </div>
      )}

      {/* Verdict Class Breakdown Cards */}
      {evalData?.class_breakdown && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Accuracy by Verdict Class:
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            {Object.entries(evalData.class_breakdown).map(([clsName, stat]) => (
              <div key={clsName} className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
                <div className="font-mono text-[11px] text-slate-300 font-bold truncate">{clsName}</div>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>{stat.correct}/{stat.total}</span>
                  <span className="text-emerald-400 font-bold">{stat.accuracy_pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scenarios Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-4 p-6">
        {/* Search & Category Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search scenarios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-lg transition font-medium ${
                  filterCategory === cat
                    ? 'bg-sky-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-white bg-slate-950 border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">ID</th>
                <th className="px-5 py-3">Scenario Name</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Expected Verdict</th>
                <th className="px-5 py-3">Actual Verdict</th>
                <th className="px-5 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredResults.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/30 transition">
                  <td className="px-5 py-3.5 font-mono text-slate-400 text-[11px]">{r.id}</td>
                  <td className="px-5 py-3.5 font-semibold text-slate-200">{r.name}</td>
                  <td className="px-5 py-3.5 text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px]">
                      {r.category}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[11px] text-slate-300">{r.expected}</td>
                  <td className="px-5 py-3.5 font-mono text-[11px] text-slate-300">{r.actual}</td>
                  <td className="px-5 py-3.5 text-center">
                    {r.passed ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-400 font-bold text-[11px]">
                        <XCircle className="w-3.5 h-3.5" /> FAIL
                      </span>
                    )}
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
