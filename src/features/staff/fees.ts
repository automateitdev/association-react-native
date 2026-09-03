import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { request } from '@/api/client';
import type { Money } from '@/api/money';
import type { PickerOption } from '@/ui';

/**
 * Fee heads, the chart of accounts behind them, and bulk assignment
 * (FR-FEE-1 … FR-FEE-9).
 *
 * THREE RULES THIS MODULE EXISTS TO KEEP VISIBLE
 *
 * 1. A FEE HEAD NAMES TWO LEDGERS, AND THEY MUST DIFFER.
 *    Instalment income and fine income post to separate accounts (FR-FEE-2).
 *    The legacy system stamps the fine ledger from a config value, which is why
 *    its fines and subscriptions are indistinguishable in the income statement
 *    and why it could never serve a second association. The server enforces
 *    `different:ledger_id` on create.
 *
 * 2. CHANGING THE AMOUNT DOES NOT REWRITE HISTORY.
 *    Each assignment copies the amount at the moment it is made (FR-FEE-4), so
 *    editing a fee head changes what will be assigned NEXT and nothing that
 *    already exists. Staff reliably assume the opposite, which is why the screen
 *    says so rather than leaving it to be discovered.
 *
 * 3. FEE HEADS ARE DEACTIVATED, NEVER DELETED.
 *    Assignments reference them (FR-FEE-3). There is no delete endpoint, and
 *    that is deliberate rather than missing.
 */

export type Ledger = {
  id: number;
  name: string;
  code: string | null;
  group: string | null;
  category: string | null;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense' | null;
};

export type FeeSetup = {
  id: number;
  fee_head: string;
  monthly: boolean;
  amount: Money;
  is_share: boolean;
  is_active: boolean;
  ledger: { id: number | null; name: string | null };

  /** Never the same account as `ledger`. See rule 1. */
  fine_ledger: { id: number | null; name: string | null };
};

/**
 * Creating a fee head. `monthly` and `is_share` appear ONLY here.
 *
 * The update endpoint does not validate them, so they cannot be changed after
 * the fact through this API - a form offering them on edit would accept the
 * change, report success and discard it. See `UpdatableFeeSetupFields`.
 */
export type NewFeeSetupFields = {
  fee_head: string;
  monthly: boolean;
  amount: string;
  is_share?: boolean;
  ledger_id: number;
  fine_ledger_id: number;
};

/** Exactly what `PUT /staff/fee-setups/{id}` will act on. */
export type UpdatableFeeSetupFields = {
  fee_head?: string;
  amount?: string;
  ledger_id?: number;
  fine_ledger_id?: number;
  is_active?: boolean;
};

export type AssignSummary = {
  created: number;
  skipped_duplicate: number;

  /**
   * An ARRAY of messages, not a count.
   *
   * Each entry reads "member 3, period 2026-08: <reason>" - the service
   * contains a failure per member/period so one bad member cannot abandon the
   * other 199, and keeps the reason rather than tallying it.
   *
   * Typed as a number first time round, which made `failed > 0` always false:
   * comparing an array to a number coerces it to a string and yields NaN. The
   * screen would have reported a clean run over a batch that had failures in
   * it - the exact class of silence this endpoint's shape exists to prevent.
   */
  failed: string[];
};

export const feeKeys = {
  setups: ['staff', 'fee-setups'] as const,
  ledgers: ['staff', 'ledgers'] as const,
};

export function useFeeSetups() {
  return useQuery({
    queryKey: feeKeys.setups,
    queryFn: async () => (await request<{ data: FeeSetup[] }>('/staff/fee-setups')).data,
  });
}

/**
 * The chart of accounts.
 *
 * Unfiltered by default. A fee head almost always credits an income account, but
 * an association's chart is its own and the API does not impose that - so the
 * screen groups by category and lets income sort first rather than hiding the
 * rest.
 */
/**
 * The chart of accounts, optionally narrowed to one kind.
 *
 * `type` matters at the counter: a collection asks where the money LANDED, and
 * that is an asset account - a cash box or a bank. Offering income ledgers
 * there would invite crediting the same account twice, since the fee head has
 * already named where the instalment posts.
 */
export function useLedgers(type?: 'asset' | 'income' | 'expense' | 'liability' | 'equity') {
  return useQuery({
    queryKey: [...feeKeys.ledgers, type ?? 'all'] as const,
    queryFn: async () =>
      (
        await request<{ data: Ledger[] }>('/staff/ledgers', {
          query: type ? { type } : undefined,
        })
      ).data,

    // A chart of accounts changes about never.
    staleTime: 5 * 60_000,
  });
}

export function useCreateFeeSetup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fields: NewFeeSetupFields) =>
      (await request<{ data: FeeSetup }>('/staff/fee-setups', { method: 'POST', body: fields }))
        .data,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: feeKeys.setups }),
  });
}

export function useUpdateFeeSetup(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fields: UpdatableFeeSetupFields) =>
      (
        await request<{ data: FeeSetup }>(`/staff/fee-setups/${id}`, {
          method: 'PUT',
          body: fields,
        })
      ).data,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: feeKeys.setups }),
  });
}

/**
 * Assign a fee head to many members across many periods.
 *
 * Returns a summary rather than a bare success, and the screen shows all three
 * numbers. "40 of 200 skipped as already assigned" is the answer staff need;
 * silence about it reads as "all 200 were created", which is how a month gets
 * quietly double-billed or quietly missed.
 */
export function useAssignFees() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      feeSetupId: number;
      memberIds: number[];
      periods: string[];
    }) =>
      (
        await request<{ data: AssignSummary }>('/staff/fee-assigns', {
          method: 'POST',
          body: {
            fee_setup_id: input.feeSetupId,
            member_ids: input.memberIds,
            periods: input.periods,
          },
        })
      ).data,

    onSettled: () => {
      // Assignment changes what members owe, so the dashboard and member lists
      // are stale too. Invalidated on settle rather than success: a partial
      // failure still created rows.
      void queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

/**
 * The months a bulk assignment will cover, newest first.
 *
 * Generated here rather than typed, because the server validates `YYYY-MM`
 * strictly and a hand-typed "2026-6" is refused with a regex error that means
 * nothing to the person who typed it. HeroUI Native ships no date picker (R-1),
 * and for whole months a list of the last N is both simpler and more accurate.
 */
export function recentPeriods(from: Date, count = 18): string[] {
  const periods: string[] = [];

  for (let i = 0; i < count; i++) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  return periods;
}

/**
 * The chart of accounts as picker options, income first.
 *
 * A fee head almost always credits income, so those accounts are put where the
 * thumb lands. The rest stay reachable rather than hidden - the API does not
 * restrict the choice, and an association's chart is its own.
 */
export function useLedgerOptions(ledgers: Ledger[] | undefined): PickerOption[] {
  return useMemo(() => {
    if (!ledgers) return [];

    const order = ['income', 'asset', 'liability', 'equity', 'expense'];

    return [...ledgers]
      .sort((a, b) => {
        const byType = order.indexOf(a.type ?? '') - order.indexOf(b.type ?? '');
        return byType !== 0 ? byType : a.name.localeCompare(b.name);
      })
      .map((ledger) => ({
        value: String(ledger.id),
        label: ledger.name,
        // Several account names read alike; the group is what tells them apart.
        group: ledger.category ?? undefined,
      }));
  }, [ledgers]);
}
