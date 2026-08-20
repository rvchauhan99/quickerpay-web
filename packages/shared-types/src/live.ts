/** Live queue envelope pushed over SSE and stored in Redis Streams. */

export type LiveEntity = 'payin' | 'utr' | 'user' | 'bank_account' | 'payout'
export type LiveAction = 'created' | 'updated' | 'removed'

export interface LiveEventEnvelope {
  seq: string
  entity: LiveEntity
  action: LiveAction
  id: string
  status: string
  upi_account_id?: string | null
  /** Pay-Out source bank; used for Operator live scope. */
  bank_account_id?: string | null
  admin_user_id?: string | null
  assigned_operator_id?: string | null
  updated_at: string
}

export interface LiveChangesResponse<T> {
  items: T[]
  cursor: string
  has_more: boolean
}
