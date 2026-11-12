import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
} from 'ag-grid-community'

ModuleRegistry.registerModules([AllCommunityModule])

export const veripactGridTheme = themeQuartz.withParams({
  backgroundColor: '#ffffff',
  foregroundColor: '#292522',
  headerBackgroundColor: '#F2EBE0',
  headerTextColor: '#6e635d',
  oddRowBackgroundColor: '#ffffff',
  borderColor: '#DCCDBB',
  rowHoverColor: '#F8F3EB',
  selectedRowBackgroundColor: '#fdf2ee',
  fontFamily: '"Inter", system-ui, sans-serif',
  headerFontSize: 11,
  headerFontWeight: 600,
  fontSize: 12,
  rowHeight: 50,
  headerHeight: 42,
})

export const VERDICT_STYLES: Record<string, { badge: string; label: string; dot: string }> = {
  MERCHANT_AT_FAULT: {
    badge: 'bg-[#FAEDE9] text-[#BF4827] border-[#EBC4BA]',
    label: 'MERCHANT_AT_FAULT',
    dot: 'bg-[#BF4827]',
  },
  OPERATOR_AT_FAULT: {
    badge: 'bg-[#FAEDE9] text-[#541827] border-[#F2BEB5]',
    label: 'OPERATOR_AT_FAULT',
    dot: 'bg-[#BF4827]',
  },
  WITHIN_MANDATE_REGRET: {
    badge: 'bg-[#FEF3DC] text-[#9A5B13] border-[#F5DEB0]',
    label: 'WITHIN_MANDATE_REGRET',
    dot: 'bg-[#C97B18]',
  },
  NO_FAULT: {
    badge: 'bg-[#EDF2EE] text-[#52705C] border-[#C5D3C9]',
    label: 'NO_FAULT',
    dot: 'bg-[#52705C]',
  },
  NEEDS_HUMAN: {
    badge: 'bg-[#F2EBE0] text-[#541827] border-[#DCCDBB]',
    label: 'NEEDS_HUMAN',
    dot: 'bg-[#541827]',
  },
}
