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
  /**
   * What one instalment of this head cost.
   *
   * The transfer form multiplies by it to show what a line is worth. The
   * server does the same arithmetic from the same column and stores THAT -
   * this is a preview, never the figure of record.
   */
  price: string;
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
  /**
   * Why it happened, in the officer's words.
   *
   * This is printed on the member's statement rather than kept internally: it
   * is the line explaining why instalments they paid for now belong to
   * somebody else - an inheritance, a gift within a family, a settlement.
   */
  note: string | null;
  transferred_on: string | null;
  /**
   * Which way it went FOR THE MEMBER ASKED ABOUT, and null when nobody was.
   *
   * Sent and received are opposite readings of one row; the row cannot say
   * which on its own, because it depends whose history is being read.
   */
  direction: 'sent' | 'received' | null;
};

/** What a recorded document reports back: every line, and both sides' new positions. */
export type TransferResult = {
  seller_id: number;
  transferred_on: string;
  note: string | null;
  transfers: {
    id: number;
    buyer_id: number;
    fee_setup_id: number;
    shares: number;
    amount: string;
    buyer_balance: number;
  }[];
  /** The document's totals, so the confirmation can say what happened in one line. */
  shares: number;
  amount: string;
  seller_balance: number;
};

export type TransferPage = {
  data: ShareTransfer[];
  meta: { current_page: number; total: number; last_page: number; per_page: number };
};

export const shareKeys = {
  all: ['staff', 'shares'] as const,
  transfers: (page: number) => ['staff', 'shares', 'transfers', page] as const,
  member: (memberId: number) => ['staff', 'shares', 'member', memberId] as const,
  memberTransfers: (memberId: number) => ['staff', 'shares', 'member-transfers', memberId] as const,
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

/**
 * One member's transfers, both directions.
 *
 * The legacy system printed these on the member's invoice as "Instalment
 * Transfers Sent" and "Instalment Transfers Received". Nothing in the rewrite
 * showed them anywhere, so instalments could leave a member's holding with no
 * trace on the member's own record.
 */
export function useMemberTransfers(memberId: number | null) {
  return useQuery({
    queryKey: shareKeys.memberTransfers(memberId ?? 0),
    queryFn: async () =>
      await request<TransferPage>(`/staff/shares/transfers?member_id=${memberId}&per_page=100`),
    enabled: memberId !== null,
  });
}

export function useTransferShares() {
  const queryClient = useQueryClient();

  return useMutation({
    /**
     * ONE DOCUMENT, not one transfer.
     *
     * A seller, a date and a reason, with a line per buyer - the shape of the
     * legacy screen and of the act it records. It is also the only way to
     * promise that a holding cannot be overdrawn: three separate requests each
     * see a balance the other two have not spent yet.
     *
     * No `amount` anywhere. The server computes what each line is worth from
     * the fee head, because that figure reaches the member's statement and the
     * paid report.
     */
    mutationFn: async (body: {
      seller_id: number;
      transferred_on?: string;
      note?: string;
      transfers: { buyer_id: number; fee_setup_id: number; shares: number }[];
    }) =>
      (
        await request<{ data: TransferResult }>('/staff/shares/transfers', {
          method: 'POST',
          body,
        })
      ).data,

    onSuccess: () => {
      // Both members' holdings and the transfer list have all moved.
      void queryClient.invalidateQueries({ queryKey: shareKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['staff', 'members'] });
    },
  });
}
