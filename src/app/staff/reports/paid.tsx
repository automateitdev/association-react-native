import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { formatMoney } from '@/api/money';
import { ExportButtons } from '@/features/staff/ExportButtons';
import {
  members,
  RANGE_PRESETS,
  useMemberwisePaid,
  type DateRange,
  type PaidRow,
} from '@/features/staff/reports';
import {
  Button,
  Cell,
  DataTable,
  DateField,
  humanDate,
  NumberCell,
  Icon,
  FilterSelect,
  Screen,
  ScreenHeader,
  SearchField,
  Section,
  StateView,
  Text,
  Toolbar,
  space,
  type,
  type Column,
} from '@/ui';

/**
 * Memberwise paid: what each member actually paid, over a period (FR-REP-1).
 *
 * THIS IS THE REPORT THE LEGACY SYSTEM GETS WRONG.
 * Its version sums `payable_amount`, which on an online payment already includes
 * the fine, and prints the result under a column headed "savings" (defect D-1).
 * Members have therefore been shown a savings figure inflated by their own
 * penalties.
 *
 * Here instalments and fines are separate columns with separate totals, and the
 * word "savings" appears nowhere. The total column is the server's `total_paid`,
 * not the two columns added together on this device.
 *
 * The instalment count is a count of DISTINCT assignments (FR-REP-4). The legacy
 * count is a row count, so a duplicated row, a fine-only row and an orphan row
 * each add one - which is why its counts exceed the number of months anyone has
 * been a member.
 */
/** The value standing for "whatever the calendar was set to". */
const CUSTOM = 'custom';

export default function PaidReportScreen() {
  const [presetKey, setPresetKey] = useState<string | null>('this-year');

  /*
   * A range drawn on the calendar, which overrides the preset when present.
   *
   * `draft` is what the calendar is currently showing mid-selection; `custom`
   * is the committed range the report actually runs on. Keeping them apart
   * matters: the calendar reports the first press as `{from, to: undefined}`,
   * and running the report on that would fetch "from X onwards" for a moment
   * before the reader has said where the period ends.
   */
  const [draft, setDraft] = useState<DateRange>({});
  const [custom, setCustom] = useState<DateRange | null>(null);

  const range = useMemo<DateRange>(() => {
    if (custom) return custom;

    const preset = RANGE_PRESETS.find((p) => p.key === presetKey);
    return preset ? preset.range(new Date()) : {};
  }, [presetKey, custom]);

  const [search, setSearch] = useState('');

  // Debounced, so typing does not fire a request per keystroke.
  const query = useDebounced(search, 300);

  const report = useMemberwisePaid(range, query || undefined);
  const meta = report.data?.meta;
  const rows = report.data?.data ?? [];

  const columns = useMemo<Column<PaidRow>[]>(
    () => [
      {
        key: 'member',
        header: 'Member',
        width: 200,
        // Frozen, so the name stays put while the money columns scroll.
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
        key: 'count',
        // Short, for the same reason as the dues report: the full word wraps.
        header: 'Paid',
        width: 90,
        align: 'right',
        render: (row) => <NumberCell>{String(row.instalments_paid_count)}</NumberCell>,
        sort: (row) => row.instalments_paid_count,
        // This report DOES carry a count total - unlike the dues report, whose
        // meta has only a member count. Each column takes its total from the
        // field the server sent for it, or has none.
        total: meta ? <NumberCell bold>{String(meta.instalments_paid_count)}</NumberCell> : undefined,
      },
      {
        key: 'instalments',
        header: 'Instalments paid',
        width: 150,
        align: 'right',
        render: (row) => <NumberCell>{formatMoney(row.instalments_paid_amount)}</NumberCell>,
        // The raw value, not the formatted one - see the dues report.
        sort: (row) => row.instalments_paid_amount,
        sortType: 'decimal',
        total: meta ? (
          <NumberCell bold>{formatMoney(meta.instalments_paid_amount)}</NumberCell>
        ) : undefined,
      },
      {
        key: 'fines',
        header: 'Fines paid',
        width: 130,
        align: 'right',
        render: (row) => <NumberCell>{formatMoney(row.fines_paid_amount)}</NumberCell>,
        // The raw value, not the formatted one - see the dues report.
        sort: (row) => row.fines_paid_amount,
        sortType: 'decimal',
        total: meta ? <NumberCell bold>{formatMoney(meta.fines_paid_amount)}</NumberCell> : undefined,
      },
      {
        key: 'total',
        header: 'Total paid',
        width: 140,
        align: 'right',
        render: (row) => <NumberCell bold>{formatMoney(row.total_paid)}</NumberCell>,
        // The raw value, not the formatted one - see the dues report.
        sort: (row) => row.total_paid,
        sortType: 'decimal',
        total: meta ? <NumberCell bold>{formatMoney(meta.total_paid)}</NumberCell> : undefined,
      },
    ],
    [meta],
  );

  const activeRange = RANGE_PRESETS.find((p) => p.key === presetKey);
  const periodLabel = custom ? 'Custom period' : activeRange?.label;

  return (
    <Screen onRefresh={() => void report.refetch()} refreshing={report.isRefetching}>
      <ScreenHeader
        title="Memberwise paid"
        subtitle={
          meta
            ? [
                periodLabel,
                range.from && range.to
                  ? `${humanDate(range.from)} – ${humanDate(range.to)}`
                  : 'no date limit',
                members(meta.members),
              ]
                .filter(Boolean)
                .join(' · ')
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

              {/*
                Named periods in a dropdown, not a row of chips: one of them
                is true at a time, which is what a select is for.

                These are RELATIVE periods - "this month" means something
                different next month - so they earn their place beside the
                calendar rather than duplicating it. Fixed dates would not:
                the range picker says those better.
              */}
              <FilterSelect
                icon="calendar"
                width={175}
                options={[
                  ...RANGE_PRESETS.map((preset) => ({
                    value: preset.key,
                    label: preset.label,
                  })),
                  /*
                    Only offered once a range has been drawn, because it is
                    not a period you can CHOOSE here - it is the one the
                    calendar beside this set. Listing it permanently would be
                    an option that does nothing when picked.
                  */
                  ...(custom ? [{ value: CUSTOM, label: 'Custom period' }] : []),
                ]}
                value={custom ? CUSTOM : (presetKey ?? 'this-year')}
                onChange={(next) => {
                  if (next === CUSTOM) return;

                  setPresetKey(next);
                  setCustom(null);
                  setDraft({});
                }}
              />

              {/*
                The presets STAY alongside the calendar. "This month" is one
                tap and cannot be mistyped; the calendar covers what the
                presets cannot express at all - the period since the last
                general meeting, an auditor's window.
              */}
              <DateField
                  value={custom ?? draft}
                onChange={(next) => {
                  setDraft(next);

                  // Committed only once BOTH ends are chosen - see the note
                  // on `draft` above.
                  if (next.from && next.to) {
                    setCustom(next);
                    setPresetKey(null);
                  }
                }}
                placeholder="Choose a period"
                onClear={() => {
                  setCustom(null);
                  setDraft({});
                  setPresetKey('this-year');
                }}
              />
            </>
          }
          actions={
            <ExportButtons
              path="/staff/reports/memberwise-paid/export"
              name="memberwise-paid"
                scope="Every row in the report, with the totals."
              query={{
                ...(range.from ? { from: range.from } : {}),
                ...(range.to ? { to: range.to } : {}),
              }}
              disabled={report.isLoading || rows.length === 0}
            />
          }
        />

        {/*
          Said on the screen, because the alternative is someone reconciling
          against a bank statement and quietly concluding the report is
          wrong. A payment approved in September for August's instalment
          counts in September - which is the honest answer for a cash report
          and a surprising one if nobody says so.
        */}
        <Text tone="muted" style={{ ...type.rowMeta, marginBottom: space.sm }}>
          Counted by payment date, so a payment approved this month for last
          month&apos;s instalment falls in this month.
        </Text>

        <StateView
          loading={report.isLoading}
          error={report.error}
          empty={rows.length === 0}
          emptyTitle="Nothing paid"
          emptyMessage="No completed payments fall in this period."
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
