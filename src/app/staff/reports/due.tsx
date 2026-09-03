import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { formatMoney } from '@/api/money';
import { ExportButtons } from '@/features/staff/ExportButtons';
import { members, useDueInfo, type DueRow } from '@/features/staff/reports';
import {
  Button,
  Cell,
  DataTable,
  DateField,
  humanDate,
  NumberCell,
  FilterSelect,
  Screen,
  ScreenHeader,
  SearchField,
  Section,
  StateView,
  StatusBadge,
  Icon,
  Toolbar,
  type Column,
  type DateRange,
} from '@/ui';

/**
 * The default excludes inactive members, because someone the association has
 * not admitted is not a debtor. It is offered rather than hidden entirely -
 * staff occasionally need to see what an unapproved applicant was assigned.
 */
const STATUS_OPTIONS = [
  { value: 'all', label: 'Active and suspended' },
  { value: 'active', label: 'Active only' },
  { value: 'suspended', label: 'Suspended only' },
];

/**
 * Outstanding dues: who owes what, over a range of assignment dates (FR-REP-5).
 *
 * INSTALMENT AND FINE ARE SEPARATE COLUMNS, AND SO ARE THEIR TOTALS.
 * That is the whole difference between this and the legacy report. A single
 * "outstanding" column that quietly includes penalties is how an association
 * ends up unable to say how much of its debtor book is subscription and how much
 * is interest on lateness.
 *
 * Every total on this screen comes from the server's `meta`. None is added up
 * here - see DataTable, which has no way to sum a column even if a later change
 * wanted it to.
 */
export default function DueReportScreen() {
  /*
   * A RANGE over when instalments were ASSIGNED, not a single "as at" date.
   *
   * The report is still the snapshot it has always been when the range is open
   * at the start - which is its default: everything still unpaid up to a date.
   * Choosing both ends narrows it to instalments assigned IN that window and
   * still unpaid, which is a different question and a useful one.
   *
   * `draft` is what the calendar shows mid-selection; `assigned` is what the
   * report actually runs on. Keeping them apart stops a half-drawn range from
   * firing a request for "everything from X onwards".
   */
  const [assigned, setAssigned] = useState<DateRange>({});
  const [draft, setDraft] = useState<DateRange>({});
  const [status, setStatus] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Debounced, so typing does not fire a request per keystroke.
  const query = useDebounced(search, 300);

  const report = useDueInfo(assigned, status, query || undefined);
  const meta = report.data?.meta;
  const rows = report.data?.data ?? [];

  const columns = useMemo<Column<DueRow>[]>(
    () => [
      {
        key: 'member',
        header: 'Member',
        width: 180,
        // Frozen: scrolling right to reach the fines column used to take the
        // name with it, leaving a row of figures belonging to nobody.
        frozen: true,
        render: (row) => <Cell>{row.member_name}</Cell>,
        sort: (row) => row.member_name,
      },
      {
        key: 'membership_no',
        header: 'No.',
        width: 90,
        /*
          A dash rather than a blank. A member legitimately exists before the
          office assigns a number, and an empty cell reads as data that failed
          to load rather than as a state someone has to act on.
        */
        render: (row) => <Cell>{row.membership_no || '—'}</Cell>,
        sort: (row) => row.membership_no,
      },
      {
        key: 'status',
        header: 'Status',
        width: 130,
        render: (row) => <StatusBadge status={row.member_status} />,
        sort: (row) => row.member_status,
      },
      {
        key: 'count',
        // "Due" rather than "Instalments": the full word wrapped to
        // "INSTALMENT / S" at this column width once the type scale changed,
        // and a header that breaks mid-word is worse than a shorter one.
        header: 'Due',
        width: 90,
        align: 'right',
        render: (row) => <NumberCell>{String(row.instalments_due_count)}</NumberCell>,
        sort: (row) => row.instalments_due_count,
        /*
         * `instalments_due_count`, and NOT `members`.
         *
         * An earlier version of this file had no total here at all, because the
         * server sent none - and before that, briefly, it had `meta.members`,
         * which is a count of PEOPLE. That would have printed the number of
         * debtors under a column of instalment counts and looked entirely
         * plausible.
         *
         * The server now sends a real sum for this column (FR-REP-8 asks for
         * one on every summable column, and a count is summable). The rule that
         * saved it in the meantime still holds: a total must be a figure the
         * server sent for THAT column.
         */
        total: meta ? (
          <NumberCell bold>{String(meta.instalments_due_count)}</NumberCell>
        ) : undefined,
      },
      {
        key: 'instalments',
        header: 'Instalments due',
        width: 140,
        align: 'right',
        render: (row) => <NumberCell>{formatMoney(row.instalments_due)}</NumberCell>,
        // Sorted on the RAW value: formatMoney gives "৳1,000.00", which orders
        // as text into nothing anyone expects.
        sort: (row) => row.instalments_due,
        sortType: 'decimal',
        total: meta ? <NumberCell bold>{formatMoney(meta.instalments_due)}</NumberCell> : undefined,
      },
      {
        key: 'fines',
        header: 'Fines due',
        width: 130,
        align: 'right',
        render: (row) => <NumberCell>{formatMoney(row.fines_due)}</NumberCell>,
        // Sorted on the RAW value: formatMoney gives "৳1,000.00", which orders
        // as text into nothing anyone expects.
        sort: (row) => row.fines_due,
        sortType: 'decimal',
        total: meta ? <NumberCell bold>{formatMoney(meta.fines_due)}</NumberCell> : undefined,
      },
      {
        key: 'total',
        header: 'Total due',
        width: 140,
        align: 'right',
        render: (row) => <NumberCell bold>{formatMoney(row.total_due)}</NumberCell>,
        // Sorted on the RAW value: formatMoney gives "৳1,000.00", which orders
        // as text into nothing anyone expects.
        sort: (row) => row.total_due,
        sortType: 'decimal',
        total: meta ? <NumberCell bold>{formatMoney(meta.total_due)}</NumberCell> : undefined,
      },
    ],
    [meta],
  );

  return (
    <Screen onRefresh={() => void report.refetch()} refreshing={report.isRefetching}>
      <ScreenHeader
        title="Outstanding dues"
        /*
          Says which of the two questions was asked. "As at 3 Sep" and
          "Assigned 1 Mar – 3 Sep" are different reports, and a heading that
          named only the end date could not tell them apart.
        */
        subtitle={
          meta
            ? `${
                meta.from
                  ? `Assigned ${humanDate(meta.from)} – ${humanDate(meta.as_of)}`
                  : `As at ${humanDate(meta.as_of)}`
              } · ${members(meta.members)}`
            : undefined
        }
        action={
          <Button size="sm" variant="tertiary" onPress={() => router.back()}>
            <Icon name="back" size={15} tone="muted" />
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      <Section title="Report">
        {/*
          The toolbar sits OUTSIDE the StateView below it, and that is not a
          layout preference.

          StateView replaces its children with the empty state. With the
          filters inside it, narrowing a list to nothing took the controls
          away along with the rows - so a filter returning no matches could
          not be undone, and the only way out was to reload the page.
          Filtering into a dead end is precisely when those controls are
          needed most.
        */}
        <Toolbar
          filters={
            <>
              {/*
                Name OR membership number. The number is how the office
                identifies a member; the name is what staff have when the
                member is standing in front of them.
              */}
              <SearchField
                value={search}
                onChangeText={setSearch}
                placeholder="Search name or membership no."
              />

              <FilterSelect
                icon="members"
                width={210}
                options={STATUS_OPTIONS}
                value={status ?? 'all'}
                onChange={(next) => setStatus(next === 'all' ? null : next)}
              />

              <DateField
                value={assigned.from && assigned.to ? assigned : draft}
                onChange={(next) => {
                  setDraft(next);
                  if (next.from && next.to) setAssigned(next);
                }}
                placeholder="Assigned: up to today"
                // Clearing returns to the open-ended snapshot, which is this
                // report's own default rather than an absence of one.
                onClear={() => {
                  setAssigned({});
                  setDraft({});
                }}
              />
            </>
          }
          actions={
            <ExportButtons
              path="/staff/reports/due-info/export"
              name="outstanding-dues"
                scope="Every row in the report, with the totals."
              query={{
                ...(assigned.from ? { from: assigned.from } : {}),
                ...(assigned.to ? { as_of: assigned.to } : {}),
                ...(status ? { member_status: status } : {}),
              }}
              disabled={report.isLoading || rows.length === 0}
            />
          }
        />

        <StateView
          loading={report.isLoading}
          error={report.error}
          empty={rows.length === 0}
          emptyTitle="Nothing outstanding"
          emptyMessage="No member has an unpaid instalment at this date."
          onRetry={() => void report.refetch()}
        >
          <DataTable
            columns={columns}
            rows={rows}
            keyExtractor={(row) => row.member_id}
            totalsLabel={members(rows.length)}
          />
        </StateView>
      </Section>
    </Screen>
  );
}

/**
 * Delays a value until it stops changing, so search does not fire per keystroke.
 *
 * useEffect, NOT useMemo. useMemo does not run the cleanup it is handed, so a
 * memo-based version cancels nothing: typing "Fatema" would schedule six
 * timeouts and fire all six. It would look like it worked - the final value is
 * still correct - while sending exactly the requests the debounce exists to
 * prevent.
 */
function useDebounced<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
