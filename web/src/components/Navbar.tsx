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

export function VeripactLogo({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path d="M5 7h6.2l4.8 13.5L20.8 7H25l-7.2 18.5h-4.6L5 7z" fill="#541827" />
      <path d="M21.5 18.5L26.5 14v11.5h-5V18.5z" fill="#BF4827" />
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
    { id: 'overview', label: 'Platform', icon: <LayoutGrid className="w-3.5 h-3.5" />, show: true },
    { id: 'purchase', label: 'Agent Checkout', icon: <ShoppingBag className="w-3.5 h-3.5" />, show: true },
    { id: 'cases', label: 'Dispute Cases', icon: <Clock className="w-3.5 h-3.5" />, show: true },
    { id: 'detail', label: 'Case Arbiter', icon: <Scale className="w-3.5 h-3.5" />, show: Boolean(selectedCaseId) },
    { id: 'eval', label: 'Eval (15)', icon: <FileText className="w-3.5 h-3.5" />, show: true },
  ]

  return (
    <header className="border-b border-[#DCCDBB] bg-[#F8F3EB]/95 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className="flex items-center gap-2.5 text-left group focus:outline-none"
        >
          <VeripactLogo className="w-6 h-6 shrink-0" />
          <div className="flex items-center gap-2.5">
            <span className="font-serif font-bold text-lg tracking-[0.06em] uppercase text-[#541827] group-hover:text-[#BF4827] transition">
              VERIPACT
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] bg-[#EDF2EE] text-[#52705C] border border-[#C5D3C9] px-2 py-0.5 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#52705C] animate-pulse" />
              PayPal Sandbox
            </span>
          </div>
        </button>

        {/* Center Navigation */}
        <nav className="hidden md:flex items-center gap-1 text-xs font-medium">
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const active = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap ${
                    active
                      ? 'bg-white text-[#541827] shadow-sm border border-[#DCCDBB] font-semibold'
                      : 'text-[#6E635D] hover:text-[#292522] hover:bg-white/70'
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
            className="px-3 py-1.5 bg-white hover:bg-[#F2EBE0] text-[#574D48] border border-[#DCCDBB] rounded-lg text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 text-[#6E635D] ${isSeeding ? 'animate-spin' : ''}`} />
            <span className="hidden lg:inline">Reset Demo</span>
          </button>

          <button
            onClick={onOpenSimulator}
            className="px-3 py-1.5 text-[#541827] hover:bg-white border border-transparent hover:border-[#DCCDBB] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <PlusCircle className="w-3.5 h-3.5 text-[#BF4827]" />
            <span className="hidden sm:inline">Simulate Dispute</span>
            <span className="sm:hidden">Dispute</span>
          </button>

          <button
            onClick={() => setActiveTab('purchase')}
            className="px-4 py-2 bg-[#BF4827] hover:bg-[#A33B1E] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
          >
            <span>Try Live Demo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mobile Navigation Strip */}
      <div className="md:hidden border-t border-[#DCCDBB] px-3 py-2 flex items-center gap-1 overflow-x-auto bg-[#F2EBE0]/80">
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
                    ? 'bg-white text-[#541827] border border-[#DCCDBB] font-semibold shadow-sm'
                    : 'text-[#6E635D]'
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
