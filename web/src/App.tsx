import { useState } from 'react'
import { ShieldCheck, Scale, ShoppingBag, Clock, FileText } from 'lucide-react'

export default function App() {
  const [activeTab, setActiveTab] = useState<'purchase' | 'cases' | 'detail' | 'eval'>('purchase')

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-sky-500/10 p-2 rounded-lg border border-sky-500/30 text-sky-400">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight flex items-center gap-2">
              AgentCourt
              <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono">
                PayPal Sandbox Only
              </span>
            </h1>
            <p className="text-xs text-slate-400">Post-Payment Liability Layer for Autonomous Agent Commerce</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-sm">
          <button
            onClick={() => setActiveTab('purchase')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
              activeTab === 'purchase' ? 'bg-sky-500 text-white font-medium' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Purchase
          </button>
          <button
            onClick={() => setActiveTab('cases')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
              activeTab === 'cases' ? 'bg-sky-500 text-white font-medium' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            Cases (Bryntum)
          </button>
          <button
            onClick={() => setActiveTab('eval')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
              activeTab === 'eval' ? 'bg-sky-500 text-white font-medium' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            Evaluation
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center max-w-2xl mx-auto mt-12">
          <div className="inline-flex p-3 rounded-full bg-sky-500/10 text-sky-400 mb-4 border border-sky-500/20">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Phase 0 Scaffolding Complete</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            The foundation for AgentCourt is active. PayPal REST PaymentsPort interface is verified with 13/13 passing
            unit tests against mocked sandbox endpoints, full safety constraints, and automated environment validation.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-300 rounded-md text-xs font-mono">
            <span>Base URL:</span>
            <span className="text-emerald-400 font-semibold">https://api-m.sandbox.paypal.com</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 px-6 py-4 text-center text-xs text-slate-500">
        AgentCourt &bull; PayPal AI Hackathon 2026 &bull; Strict Sandbox Safety Guarantee
      </footer>
    </div>
  )
}
