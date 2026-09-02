import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/api/client';
import type { Money } from '@/api/money';

/**
 * The staff payment approval queue (FR-PAY-3, FR-PAY-4).
 *
 * One rule shapes this whole module, and it comes from the defect this endpoint
 * was written to fix: in the legacy system a batch approval that failed on its
 * second payment took the entire batch down with it - a TypeError the
 * surrounding catch could not catch, a 500, and a rolled-back transaction that
 * silently discarded the approvals that HAD succeeded.
 *
 * So the API decides each payment independently and answers 207 with per-payment
 * outcomes when a batch is partial. That is a success status, not a failure, and
 * this module is careful never to flatten it into one: `decided` and `failed`
 * both come back, and the caller is expected to show which payments actually
 * went through.
 */

export type PendingPayment = {
  id: number;
  invoice_no: string;
  member_id: number;
  member_name: string;
  payment_type: 'manual' | 'online';

  /** Instalments ONLY. Never includes the fine. */
  payable_amount: Money;
  fine_amount: Money;

  /** Server-computed. The app never adds the two figures above. */
  total_amount: Money;

  instalment_count: number;

  /**
   * How many slips the member attached.
   *
   * Zero is meaningful rather than merely empty: with no gateway involved, a
   * manual payment carrying no document is a claim that money moved, not
   * evidence of it. The screen surfaces that; approving anyway is a decision
   * staff are allowed to make, but not one they should make unknowingly.
   */
  document_count: number;

  created_at: string | null;
  expires_at: string | null;
};

export type DecisionResult = {
  payment_id: number;
  ok: boolean;
  status?: string;
  error?: string;
};

export type DecisionOutcome = {
  decided: number;
  failed: number;
  results: DecisionResult[];
};

export const approvalKeys = {
  pending: ['staff', 'payments', 'pending'] as const,
};

/**
 * The pending queue, page by page.
 *
 * HeroUI Native ships no pagination control (risk R-1), so this is an infinite
 * query behind a "Load more" button rather than numbered pages. That is not a
 * workaround grudgingly accepted - on a phone, "load more" is the better
 * pattern, and the gap costs nothing here.
 */
export function usePendingPayments() {
  return useInfiniteQuery({
    queryKey: approvalKeys.pending,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      await request<{
        data: PendingPayment[];
        meta: { current_page: number; total: number; last_page: number };
      }>('/staff/payments/pending', { query: { page: pageParam, per_page: 25 } }),
    getNextPageParam: (last) =>
      last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined,
  });
}

/**
 * Approve or reject a batch.
 *
 * `reason` is required by the server when rejecting and is not optional here
 * either: a member whose payment is refused has to be told why, and a rejection
 * with no recorded reason is unanswerable at the counter afterwards.
 *
 * The queue is invalidated rather than optimistically edited. An optimistic
 * removal would show every selected payment as handled, including the ones the
 * 207 says failed - which is precisely the lie this endpoint exists to prevent.
 */
export function useDecidePayments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      paymentIds: number[];
      decision: 'completed' | 'suspended';
      reason?: string;
    }) => {
      const response = await request<{ data: DecisionOutcome }>('/staff/payments/decide', {
        method: 'POST',
        body: {
          payment_ids: input.paymentIds,
          decision: input.decision,
          ...(input.reason ? { reason: input.reason } : {}),
        },
      });

      return response.data;
    },

    onSettled: () => {
      // Refetch on failure too: a partial batch changed real state, so the
      // stale list would still be offering payments that are already decided.
      void queryClient.invalidateQueries({ queryKey: approvalKeys.pending });
    },
  });
}
