import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { newIdempotencyKey, request } from '@/api/client';
import type { Money } from '@/api/money';
import { memberKeys } from './members';

/**
 * Taking money at the counter (FR-FEE-9).
 *
 * THE PAYMENT IS CREATED PENDING, NOT COMPLETED, and the screen has to say so.
 * FR-PAY-2 requires it and the association's cash control depends on it: the
 * person who takes the money is not the person who confirms it was taken. A
 * collection screen that implied the money was banked would be lying about
 * where the payment actually is.
 */

export type DueLine = {
  fee_assign_id: number;
  fee_head: string;
  period: string;

  /** Never merged - see the note on the reports. */
  instalment_amount: Money;
  fine_amount: Money;

  /** Computed by the server, because the app does not add money. */
  total_due: Money;
  status: string;
};

export type MemberDues = {
  data: DueLine[];
  meta: {
    member_id: number;
    member_name: string;
    membership_no: string | null;
    member_status: string;
    instalment_total: Money;
    fine_total: Money;
    grand_total: Money;
  };
};

export type Collection = {
  id: number;
  invoice_no: string;
  member_id: number;
  status: string;
  payment_type: string;
  payable_amount: Money;
  fine_amount: Money;
  total_amount: Money;
  instalment_count: number;
};

export const collectionKeys = {
  dues: (memberId: number | null) => ['staff', 'collections', 'dues', memberId] as const,
};

export function useMemberDues(memberId: number | null) {
  return useQuery({
    queryKey: collectionKeys.dues(memberId),
    // Nothing to ask for until a member has been chosen.
    enabled: memberId !== null,
    queryFn: async () => await request<MemberDues>(`/staff/members/${memberId}/dues`),
  });
}

/**
 * Record a counter payment.
 *
 * The idempotency key is generated ONCE per attempt and reused for every retry
 * of that attempt, exactly as the member payment flow does it (FR-APP-2). A
 * fresh key per retry would defeat the whole mechanism - the server would see
 * each retry as a new payment, which is the duplicate-charge problem the key
 * exists to prevent, and at a counter it means taking the money twice.
 */
export function useCollect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      memberId: number;
      feeAssignIds: number[];
      ledgerId: number;
      idempotencyKey: string;
    }) =>
      (
        await request<{ data: Collection }>('/staff/collections', {
          method: 'POST',
          idempotencyKey: input.idempotencyKey,
          body: {
            member_id: input.memberId,
            fee_assign_ids: input.feeAssignIds,
            ledger_id: input.ledgerId,
          },
        })
      ).data,

    onSuccess: (_collection, input) => {
      /*
       * The dues have moved to Requested, so what the screen is showing is now
       * wrong. The approvals queue has a new row for the same reason, and the
       * member's own record shows the payment.
       */
      void queryClient.invalidateQueries({ queryKey: collectionKeys.dues(input.memberId) });
      void queryClient.invalidateQueries({ queryKey: ['staff', 'approvals'] });
      void queryClient.invalidateQueries({ queryKey: memberKeys.all });
    },
  });
}

/** A fresh key for one collection ATTEMPT. See useCollect. */
export { newIdempotencyKey };
