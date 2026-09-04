import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/api/client';

/**
 * The chart of accounts.
 *
 * Ledgers are retired rather than deleted - their history has to stay readable
 * - so the listing hides inactive ones unless asked. A picker choosing where a
 * fee posts must never offer a retired account; the screen that manages the
 * chart has to be able to see them.
 *
 * WHY EVERY LEDGER CARRIES ITS GROUP AND CATEGORY
 * A chart of accounts has several names that read alike - "Fine Income" and
 * "Subscription Income" sit next to each other, and a flat list of names makes
 * choosing between them guesswork. The group and category are what
 * disambiguate, so they travel with the ledger rather than being looked up.
 */

export type Ledger = {
  id: number;
  name: string;
  code: string | null;
  account_group_id: number;
  group: string | null;
  category: string | null;
  /** `income`, `asset`, and so on - what the category is, in accounting terms. */
  type: string | null;
  opening_balance: string;
  is_active: boolean;
};

export type AccountGroupOption = {
  id: number;
  name: string;
  category: string | null;
  type: string | null;
};

export type LedgerInput = {
  account_group_id: number;
  name: string;
  code?: string | null;
  opening_balance?: string;
  is_active?: boolean;
};

export const ledgerKeys = {
  all: ['staff', 'ledgers'] as const,
  list: (includeInactive: boolean) => ['staff', 'ledgers', { includeInactive }] as const,
  groups: ['staff', 'account-groups'] as const,
};

export function useLedgers(includeInactive = false) {
  return useQuery({
    queryKey: ledgerKeys.list(includeInactive),
    queryFn: async () =>
      (
        await request<{ data: Ledger[] }>(
          includeInactive ? '/staff/ledgers?include_inactive=true' : '/staff/ledgers',
        )
      ).data,

    // A chart of accounts changes about once a year. Refetching it on every
    // visit costs a request to tell the caller what it said last time.
    staleTime: 5 * 60_000,
  });
}

export function useAccountGroups() {
  return useQuery({
    queryKey: ledgerKeys.groups,
    queryFn: async () => (await request<{ data: AccountGroupOption[] }>('/staff/account-groups')).data,
    staleTime: 5 * 60_000,
  });
}

export function useSaveLedger() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...body }: LedgerInput & { id?: number }) =>
      (
        await request<{ data: Ledger }>(id ? `/staff/ledgers/${id}` : '/staff/ledgers', {
          method: id ? 'PUT' : 'POST',
          body,
        })
      ).data,

    // Both list variants, because a ledger that was just retired has moved
    // between them.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ledgerKeys.all }),
  });
}
