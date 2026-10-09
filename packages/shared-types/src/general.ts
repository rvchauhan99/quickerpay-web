/**
 * General Management position sheet — docs/03_MODULES_AND_SCREENS.md.
 * Money is integer paise named `_minor`. Amounts in rows are absolute;
 * the column (credit vs debit) encodes the operational sign.
 */

export const GENERAL_SECTION_KEYS = ['PARTY', 'BANKER', 'EXCHANGE'] as const
export type GeneralSectionKey = (typeof GENERAL_SECTION_KEYS)[number]

export const GENERAL_SYNTHETIC_KEYS = [
  'PENDING_WITHDRAWAL',
  'IN_PROCESS_WITHDRAWAL',
  'ADVANCE_CHARGES',
  'LEDGER_ADJUSTMENTS',
  'POSITION_CLEARING',
] as const
export type GeneralSyntheticKey = (typeof GENERAL_SYNTHETIC_KEYS)[number]

export interface GeneralRow {
  id: string
  code: string
  name: string
  /** Absolute paise; side is encoded by the parent column. */
  amount_minor: number
}

export interface GeneralSection {
  key: GeneralSectionKey
  rows: GeneralRow[]
}

export interface GeneralSynthetic {
  key: GeneralSyntheticKey
  amount_minor: number
}

export interface GeneralSide {
  sections: GeneralSection[]
  synthetics: GeneralSynthetic[]
  total_minor: number
}

export interface GeneralPosition {
  as_of: string
  credit: GeneralSide
  debit: GeneralSide
  /** credit.total_minor - debit.total_minor; zero when the sheet balances. */
  difference_minor: number
}
