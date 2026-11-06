/**
 * Sidebar work-queue badges — open IN_PROCESS pay-ins and INITIATE pay-outs.
 * Counts are SQL-scoped; Merchants always get nulls (no pending-work pressure).
 */

export interface NavQueueCounts {
  /** Pay-in rows with status IN_PROCESS in actor scope. Null when no PAYIN.can_view or MERCHANT. */
  pending_deposit: number | null
  /**
   * INITIATE pay-outs for Pending Withdrawal.
   * SA/Admin: unassigned only. Banker/others: scoped INITIATE (Banker = assigned-self).
   * Null when no PAYOUT.can_view or MERCHANT.
   */
  pending_withdrawal: number | null
  /**
   * INITIATE pay-outs with banker_user_id set — In Process Withdrawal dual-nav only.
   * Null for MERCHANT, BANKER, or when dual-nav does not apply / no PAYOUT.can_view.
   */
  in_process_withdrawal: number | null
}
