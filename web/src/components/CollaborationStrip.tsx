import ScrollReveal from './ScrollReveal'

const SPONSORS = [
  {
    name: 'Google AP2',
    role: 'Agent Mandate Standard',
    mark: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" aria-hidden="true">
        <path d="M12 3L4 7.5v9L12 21l8-4.5v-9L12 3z" stroke="#541827" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" stroke="#BF4827" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    name: 'Bryntum',
    role: 'Dispute Scheduler',
    mark: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="3" stroke="#541827" strokeWidth="1.8" />
        <path d="M7 10h6M10 14h7" stroke="#52705C" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: 'AG Grid',
    role: 'Telemetry Matrix',
    mark: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" stroke="#541827" strokeWidth="1.8" />
        <path d="M3 10h18M9 10v10M15 10v10" stroke="#BF4827" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    name: 'Ed25519',
    role: 'Cryptographic Proofs',
    mark: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" aria-hidden="true">
        <circle cx="8.5" cy="12" r="4.5" stroke="#541827" strokeWidth="1.8" />
        <path d="M13 12h8M18 12v3M21 12v2" stroke="#52705C" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: 'Render',
    role: 'Cloud Runtime',
    mark: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" aria-hidden="true">
        <path d="M5 17V7h7a4 4 0 010 8H9l6 5" stroke="#541827" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="17.5" cy="7.5" r="2" fill="#BF4827" />
      </svg>
    ),
  },
]

export function PayPalLogoMark({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      {/* Back overlapping P */}
      <path
        d="M12.2 6h7.1c3.8 0 6.2 1.9 5.5 5.6-.6 3.5-3.2 5.4-6.9 5.4h-2.2l-1.1 6.5H10l2.2-17.5z"
        fill="#0079C1"
        opacity="0.88"
      />
      {/* Front primary P */}
      <path
        d="M8.5 8.5h7.2c3.8 0 6.1 1.9 5.5 5.5-.7 3.5-3.3 5.5-7 5.5H12l-1.2 6.8H6.2l2.3-17.8z"
        fill="#003087"
      />
    </svg>
  )
}

export default function CollaborationStrip() {
  return (
    <section className="border-b border-[#DCCDBB] bg-[#FCF9F4] py-8">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
        <ScrollReveal delayMs={0}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            {/* Primary Collaboration: PayPal */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#6E635D]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0079C1] animate-pulse" />
                  In Collaboration With
                </div>
                <p className="text-xs text-[#6E635D]">
                  Powered by our primary payment infrastructure partner &amp; ecosystem sponsors
                </p>
              </div>

              <div className="inline-flex items-center gap-3.5 px-5 py-3 rounded-2xl bg-white border border-[#DCCDBB] shadow-sm veripact-card-hover">
                <PayPalLogoMark className="w-7 h-7 shrink-0" />
                <div className="flex items-center gap-2.5">
                  <span className="text-lg font-extrabold tracking-tight">
                    <span className="text-[#003087]">Pay</span>
                    <span className="text-[#0079C1]">Pal</span>
                  </span>
                  <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#EEF5FB] text-[#003087] border border-[#C6DCF0]">
                    Main Partner
                  </span>
                </div>
              </div>
            </div>

            {/* Arrow / Divider */}
            <div className="hidden xl:flex items-center gap-2 text-[11px] font-mono text-[#8C7F77]">
              <span className="w-8 h-px bg-[#DCCDBB]" />
              <span>&amp; Ecosystem Sponsors</span>
              <span className="w-8 h-px bg-[#DCCDBB]" />
            </div>

            {/* Sequenced Supporting Sponsors */}
            <div className="flex flex-wrap items-center gap-2.5">
              {SPONSORS.map((sp, idx) => (
                <ScrollReveal key={sp.name} delayMs={140 + idx * 75} className="inline-block">
                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white border border-[#DCCDBB] shadow-sm veripact-card-hover">
                    <div className="p-1.5 rounded-lg bg-[#F8F3EB] border border-[#E8DDD0]">
                      {sp.mark}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#292522] leading-tight">{sp.name}</div>
                      <div className="text-[10px] text-[#6E635D] leading-tight">{sp.role}</div>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}

