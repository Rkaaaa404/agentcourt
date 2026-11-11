import {
  AllCommunityModule,
  ModuleRegistry,
  colorSchemeDarkBlue,
  themeQuartz,
} from 'ag-grid-community'

ModuleRegistry.registerModules([AllCommunityModule])

export const agentCourtGridTheme = themeQuartz.withPart(colorSchemeDarkBlue).withParams({
  backgroundColor: '#050a16',
  headerBackgroundColor: '#0b1222',
  oddRowBackgroundColor: '#081020',
  borderColor: '#1e293b',
  rowHoverColor: 'rgba(14, 165, 233, 0.08)',
  selectedRowBackgroundColor: 'rgba(14, 165, 233, 0.14)',
  fontFamily: '"Inter", system-ui, sans-serif',
  headerFontSize: 11,
  fontSize: 12,
  rowHeight: 46,
  headerHeight: 40,
})

export const VERDICT_STYLES: Record<string, { badge: string; label: string; dot: string }> = {
  MERCHANT_AT_FAULT: {
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    label: 'MERCHANT_AT_FAULT',
    dot: 'bg-amber-400',
  },
  OPERATOR_AT_FAULT: {
    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/35',
    label: 'OPERATOR_AT_FAULT',
    dot: 'bg-purple-400',
  },
  WITHIN_MANDATE_REGRET: {
    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35',
    label: 'WITHIN_MANDATE_REGRET',
    dot: 'bg-cyan-400',
  },
  NO_FAULT: {
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
    label: 'NO_FAULT',
    dot: 'bg-emerald-400',
  },
  NEEDS_HUMAN: {
    badge: 'bg-orange-500/15 text-orange-300 border-orange-500/35',
    label: 'NEEDS_HUMAN',
    dot: 'bg-orange-400',
  },
}

