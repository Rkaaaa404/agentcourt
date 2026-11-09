import { useState } from 'react'
import Navbar from './components/Navbar'
import BuyerSimulatorModal from './components/BuyerSimulatorModal'
import PurchaseView from './views/PurchaseView'
import CasesTimelineView from './views/CasesTimelineView'
import CaseDetailView from './views/CaseDetailView'
import EvaluationView from './views/EvaluationView'

export default function App() {
  const [activeTab, setActiveTab] = useState<'purchase' | 'cases' | 'detail' | 'eval'>('cases')
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>('case-s1-merchant-breach')
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)

  const handleSeedDemo = async () => {
    setIsSeeding(true)
    try {
      await fetch('/api/cases/seed', { method: 'POST' })
      // Auto-reload current view
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedCaseId={selectedCaseId}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onSeedDemo={handleSeedDemo}
        isSeeding={isSeeding}
      />

      {/* Main Screen Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
        {activeTab === 'purchase' && <PurchaseView />}
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
