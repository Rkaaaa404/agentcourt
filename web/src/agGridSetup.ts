import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
} from 'ag-grid-community'

ModuleRegistry.registerModules([AllCommunityModule])

export const veripactGridTheme = themeQuartz.withParams({
  backgroundColor: '#ffffff',
  foregroundColor: '#0f172a',
  headerBackgroundColor: '#f8fafc',
  headerTextColor: '#475569',
  oddRowBackgroundColor: '#ffffff',
  borderColor: '#e2e8f0',
  rowHoverColor: '#f8fafc',
  selectedRowBackgroundColor: '#eff6ff',
  fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
  headerFontSize: 11,
  headerFontWeight: 600,
  fontSize: 12,
  rowHeight: 50,
  headerHeight: 42,
})

export const VERDICT_STYLES: Record<string, { badge: string; label: string; dot: string }> = {
  MERCHANT_AT_FAULT: {
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    label: 'MERCHANT_AT_FAULT',
    dot: 'bg-rose-500',
  },
  OPERATOR_AT_FAULT: {
    badge: 'bg-red-50 text-red-700 border-red-200',
    label: 'OPERATOR_AT_FAULT',
    dot: 'bg-red-500',
  },
  WITHIN_MANDATE_REGRET: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    label: 'WITHIN_MANDATE_REGRET',
    dot: 'bg-amber-500',
  },
  NO_FAULT: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    label: 'NO_FAULT',
    dot: 'bg-emerald-500',
  },
  NEEDS_HUMAN: {
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    label: 'NEEDS_HUMAN',
    dot: 'bg-sky-500',
  },
}
