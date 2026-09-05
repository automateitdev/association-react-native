import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/api/client';

/**
 * Manual accounting documents (FR-ACC-4).
 *
 * Payments post themselves. A voucher is for everything else an association
 * does with money — the electricity bill, bank interest, correcting a
 * misposting — and it is the one place a PERSON, not a payment, decides what
 * the ledger says.
 *
 * WHICH IS WHY IT IS DRAFTED AND THEN APPROVED. A draft posts nothing;
 * approval is the moment it reaches the accounts. `vouchers.create` and
 * `vouchers.approve` are separate permissions so an association can put the
 * two in different hands.
 *
 * AN APPROVED VOUCHER IS NEVER EDITED. Its entries are in the ledger and
 * reports have been read off them, so undoing one means posting its reverse —
 * a dated, attributable act rather than history quietly changing.
 *
 * TOTALS COME FROM THE SERVER. The app never adds a column of money (FR-MON-4),
 * and a balance the screen computed itself could disagree with the one the
 * server enforces — which is the only one that decides whether it posts.
 */

export type Money = string;

export type VoucherLine = {
  id?: number;
  ledger_id: number;
  ledger?: string | null;
  debit: Money;
  credit: Money;
  narration?: string | null;
};

export type Voucher = {
  id: number;
  voucher_no: string;
  type: 'payment' | 'receipt' | 'journal';
  voucher_date: string | null;
  narration: string | null;
  status: 'draft' | 'approved' | 'rejected';
  /** Set on a reversal: the voucher_no of the document it undoes. */
  reverses: string | null;
  /**
   * Set on a voucher that has been reversed.
   *
   * The screen uses it to stop offering Reverse. The server refuses a second
   * reversal either way — this is so the button is never there to press, since
   * an action whose only outcome is a refusal is not a choice.
   */
  reversed_by: string | null;
  lines: VoucherLine[];
  total_debit: Money;
  total_credit: Money;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  /** Written and approved by the same person — shown, never blocked. */
  self_approved: boolean;
};

export type VoucherPage = {
  data: Voucher[];
  meta: {
    current_page: number;
    total: number;
    last_page: number;
    per_page: number;
    drafts: number;
  };
};

export type VoucherInput = {
  type: string;
  voucher_date: string;
  narration?: string | null;
  lines: { ledger_id: number; debit?: string; credit?: string; narration?: string | null }[];
};

export const voucherKeys = {
  all: ['staff', 'vouchers'] as const,
  list: (status: string, page: number) => ['staff', 'vouchers', { status, page }] as const,
};

export function useVouchers(status: string, page: number) {
  return useQuery({
    queryKey: voucherKeys.list(status, page),
    queryFn: async () => {
      const query = new URLSearchParams({ page: String(page) });

      if (status !== 'all') {
        query.set('status', status);
      }

      return await request<VoucherPage>(`/staff/vouchers?${query.toString()}`);
    },
    placeholderData: (previous) => previous,
  });
}

export function useSaveVoucher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...body }: VoucherInput & { id?: number }) =>
      (
        await request<{ data: Voucher }>(id ? `/staff/vouchers/${id}` : '/staff/vouchers', {
          method: id ? 'PUT' : 'POST',
          body,
        })
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: voucherKeys.all }),
  });
}

export function useDecideVoucher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, decision }: { id: number; decision: 'approve' | 'reject' }) =>
      (
        await request<{ data: Voucher }>(`/staff/vouchers/${id}/decide`, {
          method: 'POST',
          body: { decision },
        })
      ).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: voucherKeys.all });
      // Approving wrote to the ledger.
      void queryClient.invalidateQueries({ queryKey: ['staff', 'ledgers'] });
    },
  });
}

export function useReverseVoucher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) =>
      (
        await request<{ data: Voucher }>(`/staff/vouchers/${id}/reverse`, {
          method: 'POST',
          body: { reason },
        })
      ).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: voucherKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['staff', 'ledgers'] });
    },
  });
}

export function useDeleteVoucher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) =>
      await request<{ data: { deleted: boolean } }>(`/staff/vouchers/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: voucherKeys.all }),
  });
}
