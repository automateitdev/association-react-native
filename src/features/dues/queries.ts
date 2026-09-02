import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/client';
import type { Money } from '@/api/money';

/**
 * Dues, summary and payment instructions.
 *
 * Every money field below is a STRING, and instalment and fine are always
 * separate. There is deliberately no `amount` field anywhere in these types -
 * if one appeared, a screen could render it without knowing whether a fine was
 * folded in, which is the exact defect this platform exists to correct.
 */

export type Due = {
  fee_assign_id: number;
  fee_head: string;
  /** YYYY-MM */
  period: string;
  instalment_amount: Money;
  fine_amount: Money;
  /** Server-computed convenience. Never recalculated here. */
  total_due: Money;
  status: 'Unpaid' | 'Requested';
  overdue_periods: number;
};

export type DuesResponse = {
  data: Due[];
  meta: {
    instalment_total: Money;
    fine_total: Money;
    grand_total: Money;
  };
};

export type Summary = {
  /** DISTINCT assignments, not a row count. */
  instalments_paid_count: number;
  instalments_paid_amount: Money;
  fines_paid_amount: Money;
  shares: number;
};

export type PaymentInstructions = {
  manual: {
    /** False when the association has not filled its bank details in. */
    available: boolean;
    bank: {
      account_name: string;
      account_number: string;
      bank_name: string;
      branch: string;
      routing_number: string;
      instructions: string;
    };
  };
  online: {
    available: boolean;
    provider: string;
  };
};

export const duesKeys = {
  all: ['dues'] as const,
  summary: ['dues', 'summary'] as const,
  instructions: ['dues', 'instructions'] as const,
};

export function useDues() {
  return useQuery({
    queryKey: duesKeys.all,
    queryFn: () => request<DuesResponse>('/fees/dues'),
  });
}

export function useSummary() {
  return useQuery({
    queryKey: duesKeys.summary,
    queryFn: async () => (await request<{ data: Summary }>('/fees/summary')).data,
  });
}

/**
 * Where to pay, and which routes are offered at all.
 *
 * Cached longer than dues: an association's bank account changes about never,
 * and this is fetched on the pay screen where a spinner is most unwelcome.
 */
export function usePaymentInstructions() {
  return useQuery({
    queryKey: duesKeys.instructions,
    queryFn: async () =>
      (await request<{ data: PaymentInstructions }>('/fees/payment-instructions')).data,
    staleTime: 10 * 60 * 1000,
  });
}

export type Quote = {
  instalment_count: number;
  instalment_total: Money;
  fine_total: Money;
  grand_total: Money;
};

/**
 * What a chosen set of instalments comes to.
 *
 * The server does this arithmetic, not the app. A member must be told the
 * amount to transfer BEFORE the payment exists, and the only alternative was a
 * client-side sum - which would mean parsing decimal strings into floats and
 * breaking the one rule this app has about money.
 *
 * Disabled until something is selected, so an empty selection makes no request.
 */
export function useQuote(feeAssignIds: number[]) {
  return useQuery({
    queryKey: ['dues', 'quote', [...feeAssignIds].sort()],
    enabled: feeAssignIds.length > 0,
    queryFn: async () =>
      (
        await request<{ data: Quote }>('/fees/quote', {
          method: 'POST',
          body: { fee_assign_ids: feeAssignIds },
        })
      ).data,
  });
}
