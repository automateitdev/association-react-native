import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/api/client';

/**
 * Adjusting a fine on an outstanding instalment (FR-FEE-9).
 *
 * WHAT THE SERVER WILL REFUSE, AND WHY IT MATTERS HERE
 * A fine on an instalment that has already been PAID cannot be edited. The
 * legacy screen allowed it - rewriting the fine on settled instalments and the
 * payments behind them - which does not refund anybody, it just makes the
 * receipt, the invoice and the ledger disagree about what changed hands.
 *
 * That is a refund, not an edit, and there is no refund flow yet. So this
 * screen only ever offers unpaid instalments, and the API refuses the rest with
 * FINE_ALREADY_PAID if anything slips through.
 *
 * A reason is required. A fine is a member-visible figure and this is the one
 * place staff can change it by hand, so "who reduced my fine, and why" has to
 * have an answer.
 */

export type Money = string;

export type FinedAssign = {
  fee_assign_id: number;
  member_id: number;
  member_name: string;
  fee_head: string;
  period: string;
  instalment_amount: Money;
  fine_amount: Money;
  total_due: Money;
  status: 'Unpaid' | 'Requested' | 'Paid';
};

export type FinedPage = {
  data: FinedAssign[];
  meta: {
    current_page: number;
    total: number;
    last_page: number;
    page_instalment_total: Money;
    page_fine_total: Money;
  };
};

export const fineKeys = {
  list: (status: string, page: number) => ['staff', 'fines', { status, page }] as const,
};

/**
 * Instalments that carry a fine.
 *
 * Filtered to unpaid by default because those are the only ones that can be
 * adjusted - offering a list where most rows refuse to change is a worse
 * screen than one that shows what can be acted on.
 */
export function useFinedAssigns(status: string, page: number) {
  return useQuery({
    queryKey: fineKeys.list(status, page),
    queryFn: async () => {
      // `fined` is a server filter, deliberately. Filtering these in the
      // client made the count line disagree with the rows on screen.
      const query = new URLSearchParams({ page: String(page), fined: 'true' });

      if (status !== 'all') {
        query.set('status', status);
      }

      return await request<FinedPage>(`/staff/fee-assigns?${query.toString()}`);
    },
    placeholderData: (previous) => previous,
  });
}

export function useAdjustFine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      feeAssignId,
      fineAmount,
      reason,
    }: {
      feeAssignId: number;
      fineAmount: string;
      reason: string;
    }) =>
      (
        await request<{ data: FinedAssign; meta: { previous_fine_amount: Money } }>(
          `/staff/fee-assigns/${feeAssignId}/fine-adjustment`,
          { method: 'POST', body: { fine_amount: fineAmount, reason } },
        )
      ).data,

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff', 'fines'] });
      // What a member owes has changed, so the dues and reports behind it have too.
      void queryClient.invalidateQueries({ queryKey: ['staff', 'reports'] });
    },
  });
}
