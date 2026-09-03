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
};

export type PaidMeta = {
  members: number;
  instalments_paid_count: number;
  instalments_paid_amount: Money;
  fines_paid_amount: Money;
  total_paid: Money;
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

export const reportKeys = {
  paid: (range: DateRange, q: string | undefined) =>
    ['staff', 'reports', 'paid', range, q ?? ''] as const,
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
