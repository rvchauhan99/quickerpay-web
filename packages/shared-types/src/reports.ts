/**
 * Reports JSON envelope, docs/03_MODULES_AND_SCREENS.md section 4.17.
 * Money in JSON is integer paise named `_minor`. Excel formats once at the file boundary.
 */

export const REPORT_TYPES = [
  'transactions',
  'breakdown',
  'commission',
  'inter_transfer',
  'ledger',
] as const
export type ReportType = (typeof REPORT_TYPES)[number]

export const EXPORT_FORMATS = ['xlsx', 'csv'] as const
export type ExportFormat = (typeof EXPORT_FORMATS)[number]

export interface ReportColumn {
  key: string
  heading: string
}

export interface ReportRun {
  columns: ReportColumn[]
  rows: Array<Record<string, string | number | null>>
  generated_at: string
}
