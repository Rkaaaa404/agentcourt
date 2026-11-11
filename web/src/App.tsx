import { useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import BuyerSimulatorModal from './components/BuyerSimulatorModal'
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
  const [activeTab, setActiveTab] = useState<'purchase' | 'cases' | 'detail' | 'eval'>('cases')
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

    if (tab === 'purchase' || tab === 'cases' || tab === 'detail' || tab === 'eval') {
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedCaseId={selectedCaseId}
        onOpenSimulator={() => handleOpenSimulatorForOrder(undefined)}
        onSeedDemo={handleSeedDemo}
        isSeeding={isSeeding}
      />

      {/* Main Screen Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
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
            onBack={() => setActiveTab('cases')}
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
      <footer className="border-t border-slate-900 bg-slate-950/60 px-6 py-4 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-400">AgentCourt</span>
          <span>&bull;</span>
          <span>Post-Payment Liability Layer for Autonomous Agent Commerce</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-amber-400/80 font-mono">PayPal Sandbox Mode Only</span>
          <span>&bull;</span>
          <span>MIT License</span>
        </div>
      </footer>
    </div>
  )
}
