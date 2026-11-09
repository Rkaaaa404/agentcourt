import { Scale, ShoppingBag, Clock, FileText, PlusCircle, RotateCw } from 'lucide-react'

interface NavbarProps {
  activeTab: 'purchase' | 'cases' | 'detail' | 'eval'
  setActiveTab: (tab: 'purchase' | 'cases' | 'detail' | 'eval') => void
  selectedCaseId: string | null
  onOpenSimulator: () => void
  onSeedDemo: () => void
  isSeeding: boolean
}

export default function Navbar({
  activeTab,
  setActiveTab,
  selectedCaseId,
  onOpenSimulator,
  onSeedDemo,
  isSeeding,
}: NavbarProps) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
      {/* Brand & Security Badge */}
      <div className="flex items-center gap-3">
        <div className="bg-sky-500/10 p-2.5 rounded-xl border border-sky-500/30 text-sky-400 shadow-inner shadow-sky-500/20">
          <Scale className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-bold text-lg tracking-tight text-white flex items-center gap-2">
              AgentCourt
            </h1>
            <span className="text-[11px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-mono font-medium tracking-wide">
              PayPal Sandbox Only
            </span>
          </div>
          <p className="text-xs text-slate-400">Post-Payment Liability Layer for Autonomous Agent Commerce</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs font-medium">
        <button
          onClick={() => setActiveTab('purchase')}
          className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition ${
            activeTab === 'purchase'
              ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          1. Purchase (Agent)
        </button>

        <button
          onClick={() => setActiveTab('cases')}
          className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition ${
            activeTab === 'cases'
              ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          2. Cases (Bryntum Timeline)
        </button>

        {selectedCaseId && (
          <button
            onClick={() => setActiveTab('detail')}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition ${
              activeTab === 'detail'
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Scale className="w-4 h-4" />
            3. Case Detail
          </button>
        )}

        <button
          onClick={() => setActiveTab('eval')}
          className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition ${
            activeTab === 'eval'
              ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          4. Evaluation (15 Cases)
        </button>
      </nav>

      {/* Simulator & Action Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSimulator}
          className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Simulate Buyer Dispute
        </button>

        <button
          onClick={onSeedDemo}
          disabled={isSeeding}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
          Reset Demo Cases
        </button>
      </div>
    </header>
  )
}

