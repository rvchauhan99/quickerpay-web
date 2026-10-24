/** SafePay247 ops Telegram bot contract. docs/12_TELEGRAM_BOT.md */

export const BOT_TOKEN_HEADER = 'x-qp-bot-token'
export const TELEGRAM_USER_HEADER = 'x-qp-telegram-user-id'

export const BOT_OPS_ROLES = ['SUPER_ADMIN', 'ADMIN'] as const
export type BotOpsRole = (typeof BOT_OPS_ROLES)[number]

export const BOT_EVENTS = [
  'hawala.completed',
  'hawala.pending_approval',
  'hawala.rejected',
  'payin.completed',
  'payin.rejected',
  'payout.completed',
  'payout.rejected',
  'utr.unclaimed',
  'banker.offline',
] as const
export type BotEvent = (typeof BOT_EVENTS)[number]

export interface BotHawalaPayload {
  debit_code: string
  credit_code: string
  amount_minor: number
  remark?: string
  utr?: string
}

export interface BotResolvedParty {
  kind: 'PARTY' | 'MERCHANT' | 'BANKER' | 'AGENT'
  id: string
  code: string
  label: string
  balance_minor: number
}

export interface BotEventPayload {
  id: string
  event: BotEvent
  created_at: string
  timestamp: string
  data: {
    entity_type: string
    entity_id: string
    amount_minor?: number
    reference?: string | null
    status?: string
    debit_code?: string | null
    credit_code?: string | null
    merchant_code?: string | null
    banker_username?: string | null
    remark?: string | null
    debit_kind?: string | null
    credit_kind?: string | null
    debit_balance_minor?: number | null
    credit_balance_minor?: number | null
    utr?: string | null
  }
}
