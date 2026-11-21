/**
 * Ops Hawala view: Debit = receiver, Credit = giver.
 * API / DB stay FROM_TO: debit = From (giver), credit = To (receiver).
 * Map only at the UI / bot edge — never change ledger posting.
 */

export type HawalaSideRef = { kind: string; id: string }

/** Ops Debit (receiver) + Ops Credit (giver) → API create body sides. */
export function toApiHawalaSides<T extends HawalaSideRef>(
  opsDebitReceiver: T,
  opsCreditGiver: T,
): { debit: T; credit: T } {
  return {
    debit: opsCreditGiver,
    credit: opsDebitReceiver,
  }
}

/** API list/filter: ops Debit (receiver) → credit_*; ops Credit (giver) → debit_*. */
export function toApiHawalaFilterParams(ops: {
  debitKind?: string
  debitId?: string
  creditKind?: string
  creditId?: string
}): {
  debit_kind?: string
  debit_id?: string
  credit_kind?: string
  credit_id?: string
} {
  const out: {
    debit_kind?: string
    debit_id?: string
    credit_kind?: string
    credit_id?: string
  } = {}
  if (ops.debitKind) {
    out.credit_kind = ops.debitKind
    if (ops.debitId) out.credit_id = ops.debitId
  }
  if (ops.creditKind) {
    out.debit_kind = ops.creditKind
    if (ops.creditId) out.debit_id = ops.creditId
  }
  return out
}

/** Ops Debit column shows API credit (receiver); ops Credit column shows API debit (giver). */
export function opsDebitFromApi<T>(_apiDebit: T, apiCredit: T): T {
  return apiCredit
}

export function opsCreditFromApi<T>(apiDebit: T, _apiCredit: T): T {
  return apiDebit
}

/** Counterparties API side for an ops field (Agent only on receiver = API CREDIT). */
export function counterpartiesSideForOps(opsSide: 'DEBIT' | 'CREDIT'): 'DEBIT' | 'CREDIT' {
  return opsSide === 'DEBIT' ? 'CREDIT' : 'DEBIT'
}
