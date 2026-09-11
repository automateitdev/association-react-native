import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ImagePickerAsset } from 'expo-image-picker';
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
      /**
       * The slip, when somebody brought one to the counter.
       *
       * OPTIONAL HERE, where a member's own manual payment requires it - the
       * split the legacy system makes, and for a reason. A member filing a
       * payment is asserting that money left their account; a clerk recording a
       * collection took the money themselves. But often there IS a slip, and
       * until now there was nowhere to put it at the moment it was in the
       * clerk's hand.
       */
      slips?: ImagePickerAsset[];
    }) => {
      const slips = input.slips ?? [];

      /*
       * FormData only when there is a file. A multipart body for the common
       * case - a clerk taking cash, with nothing to attach - would make every
       * ordinary collection a larger request for no reason, and the JSON path
       * is the one every existing test and client exercises.
       */
      if (slips.length === 0) {
        return (
          await request<{ data: Collection }>('/staff/collections', {
            method: 'POST',
            idempotencyKey: input.idempotencyKey,
            body: {
              member_id: input.memberId,
              fee_assign_ids: input.feeAssignIds,
              ledger_id: input.ledgerId,
            },
          })
        ).data;
      }

      const form = new FormData();

      form.append('member_id', String(input.memberId));
      form.append('ledger_id', String(input.ledgerId));
      input.feeAssignIds.forEach((id) => form.append('fee_assign_ids[]', String(id)));

      slips.forEach((asset, index) => {
        // The three keys React Native's FormData needs for a file; the cast is
        // unavoidable and is the same one the member's pay screen uses.
        form.append('documents[]', {
          uri: asset.uri,
          name: asset.fileName ?? `slip-${index + 1}.jpg`,
          type: asset.mimeType ?? 'image/jpeg',
        } as unknown as Blob);
      });

      return (
        await request<{ data: Collection }>('/staff/collections', {
          method: 'POST',
          idempotencyKey: input.idempotencyKey,
          formData: form,
        })
      ).data;
    },

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
