import { ShoppingBag, Clock, Scale, FileText, PlusCircle, RotateCw, LayoutGrid, ArrowRight } from 'lucide-react'

export type AppTab = 'overview' | 'purchase' | 'cases' | 'detail' | 'eval'

interface NavbarProps {
  activeTab: AppTab
  setActiveTab: (tab: AppTab) => void
  selectedCaseId: string | null
  onOpenSimulator: () => void
  onSeedDemo: () => void
  isSeeding: boolean
}

export function VeripactLogo({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path
        d="M9.5 11L21.5 8.5M9.5 11L15.5 22.5M21.5 8.5L15.5 22.5M15.5 22.5L23.5 20.5"
        stroke="#1D6CE0"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.5" cy="11" r="4" fill="#1D6CE0" />
      <circle cx="21.5" cy="8.5" r="3.4" fill="#3B82F6" />
      <circle cx="15.5" cy="22.5" r="4" fill="#1D6CE0" />
      <circle cx="24" cy="20.5" r="2.6" fill="#60A5FA" />
    </svg>
  )
}

export default function Navbar({
  activeTab,
  setActiveTab,
  selectedCaseId,
  onOpenSimulator,
  onSeedDemo,
  isSeeding,
}: NavbarProps) {
  const navItems: Array<{ id: AppTab; label: string; icon: React.ReactNode; show?: boolean }> = [
    { id: 'overview', label: 'Overview', icon: <LayoutGrid className="w-3.5 h-3.5" />, show: true },
    { id: 'purchase', label: 'Agent Checkout', icon: <ShoppingBag className="w-3.5 h-3.5" />, show: true },
    { id: 'cases', label: 'Live Monitor', icon: <Clock className="w-3.5 h-3.5" />, show: true },
    { id: 'detail', label: 'Case Arbiter', icon: <Scale className="w-3.5 h-3.5" />, show: Boolean(selectedCaseId) },
    { id: 'eval', label: 'Eval (15)', icon: <FileText className="w-3.5 h-3.5" />, show: true },
  ]

  return (
    <header className="border-b border-slate-200/90 bg-white/95 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className="flex items-center gap-2.5 text-left group focus:outline-none"
        >
          <VeripactLogo className="w-7 h-7 shrink-0" />
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-lg tracking-tight text-slate-900 group-hover:text-[#1D6CE0] transition">
              Veripact
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              PayPal Sandbox
            </span>
          </div>
        </button>

        {/* Center Navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/80 text-xs font-medium">
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const active = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap ${
                    active
                      ? 'bg-white text-[#1D6CE0] shadow-sm border border-slate-200/80 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              )
            })}
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSeedDemo}
            disabled={isSeeding}
            title="Reset demo cases S1–S3"
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 text-slate-500 ${isSeeding ? 'animate-spin' : ''}`} />
            <span className="hidden lg:inline">Reset Demo</span>
          </button>

          <button
            onClick={onOpenSimulator}
            className="px-3 py-1.5 bg-[#EFF6FF] hover:bg-blue-100 text-[#1D6CE0] border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Simulate Dispute</span>
            <span className="sm:hidden">Dispute</span>
          </button>

          <button
            onClick={() => setActiveTab('purchase')}
            className="px-3.5 py-1.5 bg-[#1D6CE0] hover:bg-[#1558BA] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-blue-600/20 transition"
          >
            <span>Try Live Demo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mobile Navigation Strip */}
      <div className="md:hidden border-t border-slate-100 px-3 py-2 flex items-center gap-1 overflow-x-auto bg-slate-50/70">
        {navItems
          .filter((item) => item.show)
          .map((item) => {
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs whitespace-nowrap transition ${
                  active
                    ? 'bg-white text-[#1D6CE0] border border-slate-200 font-semibold shadow-sm'
                    : 'text-slate-600'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            )
          })}
      </div>
    </header>
  )
}
