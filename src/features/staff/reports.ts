import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/client';
import type { Money } from '@/api/money';

/**
 * The two reports (FR-REP-1 … FR-REP-8).
 *
 * WHAT THESE REPORTS ARE FOR
 * The legacy versions of both are wrong, and wrong in a way that flatters the
 * association: "savings" sums `payable_amount`, which on an online payment
 * includes the fine (defect D-1), and an instalment count is a row count rather
 * than a count of distinct assignments, so a duplicated row, a fine-only row and
 * an orphan row each add one (D-7).
 *
 * So the shapes here are deliberate:
 *
 *   - instalment, fine and total are SEPARATE fields (FR-REP-3). There is no
 *     field on either report that merges an instalment with a fine, and the
 *     screens must not create one.
 *   - column totals arrive in `meta`, computed by the server with bcmath
 *     (FR-REP-8). The app does not add money, so a report that needed a total
 *     the API did not send would simply not show one.
 *
 * NEITHER REPORT IS PAGINATED. Both return every row. That is correct for a
 * report - a page-at-a-time report cannot be totalled or exported - but it means
 * a large association returns a large payload, and the screens render every row.
 * At COCSOL's 315 members that is fine; it is worth knowing before the first
 * association with several thousand.
 */

export type PaidRow = {
  member_id: number;
  /** Empty string when the office has not assigned one yet. */
  membership_no: string;
  member_name: string;
  /** DISTINCT assignments, never a row count. */
  instalments_paid_count: number;
  instalments_paid_amount: Money;
  fines_paid_amount: Money;
  total_paid: Money;
  /**
   * Instalments that arrived by transfer from another member.
   *
   * OUTSIDE `total_paid`, on purpose. The legacy report adds them in, which
   * states that this member paid money the association never received. They
   * are reported because a member holding instalments somebody handed them is
   * a real fact about their standing - and kept separate because it is not a
   * collection.
   */
  transfers_in_count: number;
  transfers_in_amount: Money;
};

export type PaidMeta = {
  members: number;
  instalments_paid_count: number;
  instalments_paid_amount: Money;
  fines_paid_amount: Money;
  total_paid: Money;
  transfers_in_count: number;
  transfers_in_amount: Money;
};

export type DueRow = {
  member_id: number;
  /** Empty string when the office has not assigned one yet. */
  membership_no: string;
  member_name: string;
  member_status: 'active' | 'inactive' | 'suspended';
  instalments_due_count: number;
  instalments_due: Money;
  fines_due: Money;
  total_due: Money;
};

export type DueMeta = {
  /** Null when the report is the open-ended snapshot. See useDueInfo. */
  from: string | null;
  /** The upper bound. Keeps its name: it is what this report has always meant. */
  as_of: string;
  /** People, not instalments. Never a column total - see due.tsx. */
  members: number;
  /** Instalments, not people. The total for the count COLUMN. */
  instalments_due_count: number;
  instalments_due: Money;
  fines_due: Money;
  total_due: Money;
};

/*
 * Re-exported rather than redeclared.
 *
 * The date picker in ui/ owns this shape, and an identical second definition
 * here is the kind of duplicate that stays in step right up until one of them
 * gains a field.
 */
import type { DateRange } from '@/ui';

export type { DateRange };

/**
 * One account's contribution to a period's result (parity P-9).
 *
 * `amount` IS SIGNED - income positive, expense negative - and that is the
 * server's single representation rather than a display choice made here. A
 * column of signed amounts sums to the surplus, so the figure a reader adds up
 * in the downloaded spreadsheet and the one the server printed are the same
 * number. The screen still shows the two subtotals as plain positive figures,
 * because those arrive named in `meta` rather than being re-derived.
 */
export type StatementRow = {
  section: 'income' | 'expense';
  account_group: string;
  ledger: string;
  amount: Money;
};

export type StatementMeta = {
  from: string;
  to: string;
  /** How many accounts moved in the period, not how many exist. */
  accounts: number;
  total_income: Money;
  total_expense: Money;
  /**
   * SURPLUS, not profit. A cooperative society does not trade for profit and
   * its own rules call what is left a surplus - which is the word its committee
   * will be looking for on the page.
   */
  net_surplus: Money;
};

/**
 * The three statements that go with the income statement.
 *
 * TWO ARE POSITIONS, ONE IS A PERIOD, and the types say so rather than leaving
 * a caller to pass the wrong pair of dates. A balance sheet and a trial balance
 * are what is true on ONE day; a cash summary, like the income statement, is
 * what happened between two.
 *
 * `balanced` is the answer a trial balance exists to give, and it is a boolean
 * rather than something the screen derives by comparing two totals - the server
 * did the arithmetic with bcmath and the app does not re-do money.
 */
export type TrialBalanceRow = {
  ledger: string;
  account_group: string;
  category: string;
  /** One of these is a figure and the other is 0.00; never both. */
  debit: Money;
  credit: Money;
};

export type TrialBalanceMeta = {
  as_of: string;
  accounts: number;
  total_debit: Money;
  total_credit: Money;
  balanced: boolean;
  /** What to go looking for when it is not. */
  difference: Money;
};

export type BalanceSheetRow = {
  section: 'asset' | 'liability' | 'equity';
  account_group: string;
  ledger: string;
  amount: Money;
};

export type BalanceSheetMeta = {
  as_of: string;
  total_assets: Money;
  total_liabilities: Money;
  total_equity: Money;
  /**
   * Everything earned less everything spent, since the beginning. Part of what
   * the association is worth, and its own line rather than folded into share
   * capital - nobody subscribed for it.
   */
  accumulated_surplus: Money;
  balanced: boolean;
  difference: Money;
};

export type CashSummaryRow = {
  ledger: string;
  account_group: string;
  opening: Money;
  received: Money;
  paid: Money;
  closing: Money;
};

export type CashSummaryMeta = {
  from: string;
  to: string;
  accounts: number;
  total_opening: Money;
  total_received: Money;
  total_paid: Money;
  total_closing: Money;
};

/**
 * The voucher-wise report: the ledger read document by document.
 *
 * A DOCUMENT IS NOT AN ENTRY, and this is the whole point of the type. Every
 * trace records what produced it, so a payment of three instalments is ONE row
 * here with six entries behind it. The legacy report returns one row per entry
 * while showing each of them the document's full total - 15,720 rows standing
 * for 3,378 documents in COCSOL's data - so a reader adding up its amounts
 * would count the same money several times over.
 *
 * `kind` IS A WORD, NOT A CLASS NAME. The server groups on the source's class,
 * which names its own namespace layout and changes when a model moves. The wire
 * carries `payment` / `voucher` / `other`, and `kind_label` carries the same
 * thing spelled for a person.
 *
 * IT IS PAGINATED, unlike the four statements. Those return every row because a
 * statement that cannot be totalled is not a statement; this is a listing, and
 * three years of it runs to tens of thousands of documents. `total_amount`
 * covers the whole RANGE rather than the page in hand - a footer that changed
 * as you paged through would look like a total and answer nothing.
 */
export type DocumentKind = 'payment' | 'voucher' | 'other';

export type VoucherwiseRow = {
  /**
   * The drill-in key, and a trace rather than the document.
   *
   * A document's real key is a class name and an id, which is not something to
   * put in a URL. A trace id identifies the group unambiguously and is the one
   * identifier a reader has in front of them.
   */
  trace_id: number;
  posted_on: string;
  kind: DocumentKind;
  kind_label: string;
  /** Invoice number or voucher number - whichever this document has. */
  number: string;
  /** The member who paid, or what the person who wrote the voucher said. */
  description: string;
  /** Present on a payment, so the row can lead to the member. */
  member_id: number | null;
  entries: number;
  amount: Money;
  is_reversal: boolean;
  balanced: boolean;
  /**
   * The flags as one phrase, computed by the SERVER.
   *
   * So the download and the screen cannot come to disagree about which
   * documents were worth remarking on - the same rule as the column totals.
   */
  note: string;
};

export type VoucherwiseMeta = {
  from: string;
  to: string;
  /** Over the range, not the page. */
  total_amount: Money;
  current_page: number;
  last_page: number;
  per_page: number;
  /** Documents in the range - the paginator's count, not a row count. */
  total: number;
};

export type VoucherwiseLine = {
  ledger: string;
  account_group: string;
  /** One is a figure and the other is 0.00; never both. */
  debit: Money;
  credit: Money;
  narration: string;
};

/**
 * One document in full - what the legacy's single-voucher page was.
 *
 * THE HEADING IS THE PART THE LEGACY HAS NONE OF. That page lists ledger, debit
 * and credit and says nothing about the document they belong to: not its date,
 * its number, its kind, nor whether it was later reversed. A page of figures
 * with no heading cannot be filed, checked or disputed afterwards.
 */
export type VoucherwiseDocument = {
  kind: DocumentKind;
  kind_label: string;
  number: string;
  posted_on: string;
  description: string;
  member_id: number | null;
  entries: number;
  /** This document undoes another one. */
  is_reversal: boolean;
  /** Another document has since undone THIS one. */
  reversed: boolean;
  lines: VoucherwiseLine[];
  total_debit: Money;
  total_credit: Money;
  balanced: boolean;
  /**
   * How far apart the two sides are, as a positive figure.
   *
   * From the server, with bcmath, because the app does not do money arithmetic
   * - the same rule that puts every column total in `meta`. "Does not balance"
   * without the figure sends the reader to add up the column themselves.
   */
  difference: Money;
};

export const reportKeys = {
  paid: (range: DateRange, q: string | undefined) =>
    ['staff', 'reports', 'paid', range, q ?? ''] as const,
  statement: (from: string, to: string) => ['staff', 'reports', 'statement', from, to] as const,
  trial: (asOf: string) => ['staff', 'reports', 'trial-balance', asOf] as const,
  sheet: (asOf: string) => ['staff', 'reports', 'balance-sheet', asOf] as const,
  cash: (from: string, to: string) => ['staff', 'reports', 'cash-summary', from, to] as const,
  voucherwise: (from: string, to: string, kind: string | null, q: string, page: number) =>
    ['staff', 'reports', 'voucherwise', from, to, kind, q, page] as const,
  document: (trace: number | null) =>
    ['staff', 'reports', 'voucherwise', 'document', trace] as const,
  due: (assigned: DateRange, status: string | null, q: string | undefined) =>
    [
      'staff',
      'reports',
      'due',
      assigned.from ?? 'open',
      assigned.to ?? 'today',
      status,
      q ?? '',
    ] as const,
};

/**
 * The income statement over a period (P-9).
 *
 * BOTH BOUNDS ARE REQUIRED, which is why this takes two strings rather than the
 * `DateRange` the listings use. "All time" is a reasonable thing to ask of a
 * list of members and a meaningless thing to ask of a statement: the answer
 * only means anything over a stated period, and the API refuses a request
 * without one.
 */
export function useIncomeStatement(from: string, to: string) {
  return useQuery({
    queryKey: reportKeys.statement(from, to),
    queryFn: async () =>
      await request<{ data: StatementRow[]; meta: StatementMeta }>(
        '/staff/reports/income-statement',
        { query: { from, to } },
      ),
  });
}

/** As at one day, because a trial balance over a range is not a thing. */
export function useTrialBalance(asOf: string) {
  return useQuery({
    queryKey: reportKeys.trial(asOf),
    queryFn: async () =>
      await request<{ data: TrialBalanceRow[]; meta: TrialBalanceMeta }>(
        '/staff/reports/trial-balance',
        { query: { as_of: asOf } },
      ),
  });
}

/** The same: what the association owns and owes on ONE day. */
export function useBalanceSheet(asOf: string) {
  return useQuery({
    queryKey: reportKeys.sheet(asOf),
    queryFn: async () =>
      await request<{ data: BalanceSheetRow[]; meta: BalanceSheetMeta }>(
        '/staff/reports/balance-sheet',
        { query: { as_of: asOf } },
      ),
  });
}

/** A period, like the income statement: what moved, and what is left. */
export function useCashSummary(from: string, to: string) {
  return useQuery({
    queryKey: reportKeys.cash(from, to),
    queryFn: async () =>
      await request<{ data: CashSummaryRow[]; meta: CashSummaryMeta }>(
        '/staff/reports/cash-summary',
        { query: { from, to } },
      ),
  });
}

/**
 * A page of documents over a period.
 *
 * NO SORT PARAMETER, deliberately. The order is the one this report is read in
 * - newest first - and it is the server's. Offering to sort by amount would
 * mean paging through an ordering the reader did not ask for on every other
 * column, which is how a listing stops being a record of what happened.
 */
export function useVoucherwise(
  from: string,
  to: string,
  kind: DocumentKind | null,
  q: string,
  page: number,
) {
  return useQuery({
    queryKey: reportKeys.voucherwise(from, to, kind, q, page),
    queryFn: async () =>
      await request<{ data: VoucherwiseRow[]; meta: VoucherwiseMeta }>(
        '/staff/reports/voucherwise',
        {
          query: {
            from,
            to,
            page,
            ...(kind ? { kind } : {}),
            ...(q ? { q } : {}),
          },
        },
      ),
  });
}

/** One document, by a trace that belongs to it. */
export function useVoucherwiseDocument(trace: number | null) {
  return useQuery({
    queryKey: reportKeys.document(trace),
    queryFn: async () =>
      await request<{ data: VoucherwiseDocument }>(`/staff/reports/voucherwise/${trace}`),
    enabled: trace !== null,
  });
}

export function useMemberwisePaid(range: DateRange, q?: string) {
  return useQuery({
    queryKey: reportKeys.paid(range, q),
    queryFn: async () =>
      await request<{ data: PaidRow[]; meta: PaidMeta }>('/staff/reports/memberwise-paid', {
        query: {
          ...(range.from ? { from: range.from } : {}),
          ...(range.to ? { to: range.to } : {}),
          ...(q ? { q } : {}),
        },
      }),
  });
}

/**
 * Outstanding dues over a range of ASSIGNMENT dates.
 *
 * `to` maps to `as_of`, which is the name the API has always used for the upper
 * bound and which the exports and the tests still use. `from` is new and
 * optional: without it this is the open-ended snapshot the report has always
 * been, so the original question is still askable and is still the default.
 */
export function useDueInfo(assigned: DateRange, memberStatus: string | null, q?: string) {
  return useQuery({
    queryKey: reportKeys.due(assigned, memberStatus, q),
    queryFn: async () =>
      await request<{ data: DueRow[]; meta: DueMeta }>('/staff/reports/due-info', {
        query: {
          ...(assigned.from ? { from: assigned.from } : {}),
          ...(assigned.to ? { as_of: assigned.to } : {}),
          ...(memberStatus ? { member_status: memberStatus } : {}),
          ...(q ? { q } : {}),
        },
      }),
  });
}

/**
 * Named date ranges, instead of a date picker.
 *
 * HeroUI Native ships no date picker (R-1), and for a report this is the better
 * control regardless: "this month" is what someone actually wants, and it cannot
 * be mistyped. Both endpoints treat missing bounds as unbounded, so "all time"
 * is the absence of a filter rather than a pair of extreme dates.
 *
 * This is date arithmetic, not money arithmetic - the app is barred from adding
 * up amounts, not from working out when last month started.
 */
export type RangePreset = {
  key: string;
  label: string;
  range: (today: Date) => DateRange;
};

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const RANGE_PRESETS: RangePreset[] = [
  {
    key: 'this-month',
    label: 'This month',
    range: (t) => ({ from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(t) }),
  },
  {
    key: 'last-month',
    label: 'Last month',
    range: (t) => ({
      from: iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)),
      to: iso(new Date(t.getFullYear(), t.getMonth(), 0)),
    }),
  },
  {
    key: 'this-year',
    label: 'This year',
    range: (t) => ({ from: iso(new Date(t.getFullYear(), 0, 1)), to: iso(t) }),
  },
  {
    key: 'all',
    label: 'All time',
    // Unbounded, not a pair of extreme dates - the API treats absent bounds as
    // no filter, and inventing 1970-01-01 would be a lie in the header.
    range: () => ({}),
  },
];

/** "1 member", "3 members". Trivial, but it appears four times across two reports. */
export function members(count: number): string {
  return `${count} member${count === 1 ? '' : 's'}`;
}
