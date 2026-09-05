import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/api/client';

/**
 * Share balances and transfers (FR-SHR-3).
 *
 * A TRANSFER IS NOT A PAYMENT. Whatever the buyer paid the seller is between
 * those two members; the association took no money, so nothing posts to its
 * ledger. The amount is recorded because members ask what a transfer was
 * worth - not because it is income.
 *
 * The balances here are the ones D-19 corrupted in the legacy system: six
 * members holding shares nobody had bought. They are derived from completed
 * payments and moved by transfers, and no endpoint anywhere lets a number be
 * typed into them.
 */

export type ShareHolding = {
  fee_setup_id: number;
  fee_head: string;
  shares: number;
};

export type MemberShares = {
  member_id: number;
  member_name: string;
  total: number;
  /** Split by head, because "twelve shares" is not enough to choose what to move. */
  by_head: ShareHolding[];
};

export type ShareTransfer = {
  id: number;
  seller_id: number;
  seller_name: string | null;
  buyer_id: number;
  buyer_name: string | null;
  fee_head: string | null;
  shares: number;
  /** A string, like every figure the app displays. */
  amount: string;
  transferred_on: string | null;
};

export type TransferPage = {
  data: ShareTransfer[];
  meta: { current_page: number; total: number; last_page: number; per_page: number };
};

export const shareKeys = {
  all: ['staff', 'shares'] as const,
  transfers: (page: number) => ['staff', 'shares', 'transfers', page] as const,
  member: (memberId: number) => ['staff', 'shares', 'member', memberId] as const,
};

export function useShareTransfers(page: number) {
  return useQuery({
    queryKey: shareKeys.transfers(page),
    queryFn: async () => await request<TransferPage>(`/staff/shares/transfers?page=${page}`),
    placeholderData: (previous) => previous,
  });
}

/** Enabled only once a member is chosen - there is nothing to ask about before. */
export function useMemberShares(memberId: number | null) {
  return useQuery({
    queryKey: shareKeys.member(memberId ?? 0),
    queryFn: async () =>
      (await request<{ data: MemberShares }>(`/staff/shares/members/${memberId}`)).data,
    enabled: memberId !== null,
  });
}

export function useTransferShares() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      seller_id: number;
      buyer_id: number;
      fee_setup_id: number;
      shares: number;
      amount?: number;
      transferred_on?: string;
    }) =>
      (
        await request<{
          data: ShareTransfer & { seller_balance: number; buyer_balance: number };
        }>('/staff/shares/transfers', { method: 'POST', body })
      ).data,

    onSuccess: () => {
      // Both members' holdings and the transfer list have all moved.
      void queryClient.invalidateQueries({ queryKey: shareKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['staff', 'members'] });
    },
  });
}
