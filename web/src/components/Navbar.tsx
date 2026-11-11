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
    <header className="border-b border-slate-800/80 bg-[#050a16]/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Sandbox Status */}
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-sky-500/20 to-indigo-500/20 p-2 rounded-xl border border-sky-400/30 text-sky-400 shadow-inner shadow-sky-500/10">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base md:text-lg tracking-tight text-white">
                AgentCourt
              </h1>
              <span className="inline-flex items-center gap-1.5 text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 px-2 py-0.5 rounded-full font-mono font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                PayPal Sandbox
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Post-Payment Liability Layer for Autonomous Agentic Commerce
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800/90 text-xs font-medium">
          <button
            onClick={() => setActiveTab('purchase')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === 'purchase'
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>1. Checkout</span>
          </button>

          <button
            onClick={() => setActiveTab('cases')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === 'cases'
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>2. Timeline &amp; Grid</span>
          </button>

          {selectedCaseId && (
            <button
              onClick={() => setActiveTab('detail')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'detail'
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>3. Arbiter</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('eval')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === 'eval'
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>4. Eval (15)</span>
          </button>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSimulator}
            className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Simulate Dispute</span>
            <span className="sm:hidden">Dispute</span>
          </button>

          <button
            onClick={onSeedDemo}
            disabled={isSeeding}
            title="Reset demo cases S1–S3"
            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-lg text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Reset Demo</span>
          </button>
        </div>
      </div>
    </header>
  )
}
