import { useEffect, useState } from 'react'
import Navbar, { type AppTab } from './components/Navbar'
import BuyerSimulatorModal from './components/BuyerSimulatorModal'
import OverviewView from './views/OverviewView'
import PurchaseView from './views/PurchaseView'
import CasesTimelineView from './views/CasesTimelineView'
import CaseDetailView from './views/CaseDetailView'
import EvaluationView from './views/EvaluationView'

interface SimulatorSeed {
  orderId?: string
  captureId?: string
  amount?: string
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('overview')
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>('case-s1-merchant-breach')
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false)
  const [simulatorSeed, setSimulatorSeed] = useState<SimulatorSeed | undefined>(undefined)
  const [isSeeding, setIsSeeding] = useState(false)
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null)
  const [checkoutNotice, setCheckoutNotice] = useState<{ status: string; message?: string } | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    const orderId = params.get('order_id')
    const checkout = params.get('checkout')
    const msg = params.get('msg') || undefined

    if (tab === 'overview' || tab === 'purchase' || tab === 'cases' || tab === 'detail' || tab === 'eval') {
      setActiveTab(tab)
    }
    if (orderId) {
      setCheckoutOrderId(orderId)
    }
    if (checkout) {
      setCheckoutNotice({ status: checkout, message: msg })
      setActiveTab('purchase')
    }
    if (tab || orderId || checkout) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleSeedDemo = async () => {
    setIsSeeding(true)
    try {
      await fetch('/api/cases/seed', { method: 'POST' })
      window.location.reload()
    } catch (err) {
      console.error('Failed to seed demo cases', err)
    } finally {
      setIsSeeding(false)
    }
  }

  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId)
    setActiveTab('detail')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNavigateTab = (tab: AppTab) => {
    setActiveTab(tab)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDisputeCreated = (caseId: string) => {
    setSelectedCaseId(caseId)
    setActiveTab('detail')
  }

  const handleOpenSimulatorForOrder = (seed?: SimulatorSeed) => {
    setSimulatorSeed(seed)
    setIsSimulatorOpen(true)
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleNavigateTab}
        selectedCaseId={selectedCaseId}
        onOpenSimulator={() => handleOpenSimulatorForOrder(undefined)}
        onSeedDemo={handleSeedDemo}
        isSeeding={isSeeding}
      />

      {/* Main Screen Content */}
      <main className="flex-1 w-full">
        {activeTab === 'overview' && (
          <OverviewView
            onSelectCase={handleSelectCase}
            onNavigateTab={handleNavigateTab}
            onOpenSimulator={() => handleOpenSimulatorForOrder(undefined)}
          />
        )}
        {activeTab === 'purchase' && (
          <PurchaseView
            initialOrderId={checkoutOrderId}
            checkoutNotice={checkoutNotice}
            onSimulateDispute={(seed) => handleOpenSimulatorForOrder(seed)}
          />
        )}
        {activeTab === 'cases' && <CasesTimelineView onSelectCase={handleSelectCase} />}
        {activeTab === 'detail' && (
          <CaseDetailView
            caseId={selectedCaseId || 'case-s1-merchant-breach'}
            onBack={() => handleNavigateTab('cases')}
          />
        )}
        {activeTab === 'eval' && <EvaluationView />}
      </main>

      {/* Sandbox Buyer Simulator Modal */}
      <BuyerSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onDisputeCreated={handleDisputeCreated}
        initialOrderId={simulatorSeed?.orderId}
        initialCaptureId={simulatorSeed?.captureId}
        initialAmount={simulatorSeed?.amount}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50/70 px-6 py-5">
        <div className="max-w-[1320px] mx-auto flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">Veripact</span>
            <span>&bull;</span>
            <span>Autonomous Liability &amp; Dispute Resolution for AI Commerce</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 text-[11px]">
            <span className="text-[#1D6CE0] font-mono font-medium">PayPal Orders v2 &amp; Disputes</span>
            <span>&bull;</span>
            <span className="text-emerald-700 font-mono font-medium">Bryntum Scheduler</span>
            <span>&bull;</span>
            <span className="text-slate-700 font-mono font-medium">AG Grid</span>
            <span>&bull;</span>
            <span>MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
