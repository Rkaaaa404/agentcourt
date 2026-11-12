import ScrollReveal from './ScrollReveal'

const REAL_SPONSORS = [
  { name: 'AP2 Protocol', src: '/logos/ap2.png', heightClass: 'h-7 sm:h-8' },
  { name: 'Bryntum', src: '/logos/bryntum.png', heightClass: 'h-7 sm:h-8' },
  { name: 'AG Grid', src: '/logos/ag-grid.png', heightClass: 'h-8 sm:h-9' },
  { name: 'Render', src: '/logos/render.png', heightClass: 'h-7 sm:h-8' },
]

export default function CollaborationStrip() {
  const repeatedSponsors = [...REAL_SPONSORS, ...REAL_SPONSORS, ...REAL_SPONSORS]

  return (
    <section className="border-b border-[#DCCDBB] bg-[#FCF9F4] py-8 overflow-hidden">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <ScrollReveal delayMs={0}>
          <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
            {/* Primary Collaboration: PayPal (No Card, Clear & Prominent) */}
            <div className="shrink-0 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6E635D]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0079C1] animate-pulse" />
                  In Collaboration With
                </div>
                <p className="text-xs text-[#6E635D]">Primary payment &amp; disputes partner</p>
              </div>

              <div className="flex items-center gap-3 transition-transform duration-300 hover:scale-[1.03]">
                <img
                  src="/logos/paypal.png"
                  alt="PayPal"
                  className="h-10 sm:h-11 w-auto object-contain mix-blend-multiply"
                />
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl font-extrabold tracking-tight leading-none">
                    <span className="text-[#003087]">Pay</span>
                    <span className="text-[#0079C1]">Pal</span>
                  </span>
                  <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#EEF5FB] text-[#003087] border border-[#C6DCF0]">
                    Main Partner
                  </span>
                </div>
              </div>
            </div>

            {/* Vertical editorial divider on large screens */}
            <div className="hidden lg:block w-px h-10 bg-[#DCCDBB] shrink-0" aria-hidden="true" />

            {/* Supporting Sponsors: Slow Smooth Sliding Stream (No Cards) */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8C7F77]">
                Ecosystem &amp; Infrastructure Sponsors
              </div>

              <div className="relative marquee-wrapper overflow-hidden py-1.5">
                {/* Soft left/right fade edges matching #FCF9F4 */}
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#FCF9F4] to-transparent z-10"
                  aria-hidden="true"
                />
                <div
                  className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#FCF9F4] to-transparent z-10"
                  aria-hidden="true"
                />

                <div className="animate-marquee-slow flex items-center gap-12 sm:gap-16">
                  {repeatedSponsors.map((sp, idx) => (
                    <div
                      key={`${sp.name}-${idx}`}
                      className="shrink-0 flex items-center transition-transform duration-300 hover:scale-105"
                      title={sp.name}
                    >
                      <img
                        src={sp.src}
                        alt={sp.name}
                        className={`${sp.heightClass} w-auto object-contain mix-blend-multiply`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
