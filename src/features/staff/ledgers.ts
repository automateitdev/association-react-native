import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/client';

/**
 * The chart of accounts.
 *
 * Read-only here, deliberately: the API exposes a listing and nothing else, so
 * the screen shows what exists rather than pretending to an edit it cannot
 * perform. Creating and editing ledgers is P-6 on the parity list.
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
  group: string | null;
  category: string | null;
  /** `income`, `asset`, and so on - what the category is, in accounting terms. */
  type: string | null;
};

export const ledgerKeys = {
  all: ['staff', 'ledgers'] as const,
  byType: (type?: string) => ['staff', 'ledgers', type ?? 'all'] as const,
};

export function useLedgers(type?: string) {
  return useQuery({
    queryKey: ledgerKeys.byType(type),
    queryFn: async () =>
      (
        await request<{ data: Ledger[] }>(
          type ? `/staff/ledgers?type=${encodeURIComponent(type)}` : '/staff/ledgers',
        )
      ).data,

    // A chart of accounts changes about once a year. Refetching it on every
    // visit costs a request to tell the caller what it said last time.
    staleTime: 5 * 60_000,
  });
}
