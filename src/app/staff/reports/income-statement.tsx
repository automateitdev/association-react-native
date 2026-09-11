import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { formatMoney } from '@/api/money';
import { ExportButtons } from '@/features/staff/ExportButtons';
import {
  RANGE_PRESETS,
  useIncomeStatement,
  type DateRange,
  type StatementRow,
} from '@/features/staff/reports';
import {
  Amount,
  Button,
  Cell,
  DataTable,
  DateField,
  FilterSelect,
  Inline,
  NumberCell,
  Panel,
  Screen,
  ScreenHeader,
  Section,
  Stack,
  StateView,
  Text,
  Toolbar,
  type,
  type Column,
} from '@/ui';

/**
 * The income statement (parity P-9): what the association earned and spent.
 *
 * TWO TABLES, NOT ONE. Income and expenses are separate questions with separate
 * subtotals, and a single table with a "section" column would make the reader do
 * the grouping in their head - which is the one thing a statement exists to have
 * already done.
 *
 * THE SURPLUS IS THE SERVER'S. `net_surplus` arrives computed with bcmath, like
 * every other total in this app; the screen does not subtract one figure from
 * another. Two numbers that disagree about the association's result would be
 * worse than no number at all.
 *
 * WHY THE AMOUNTS COME BACK SIGNED, while these tables show them positive: the
 * API has ONE representation, so the column in a downloaded spreadsheet sums to
 * the same surplus the server printed. Here each table is already headed by what
 * it contains, and a column of negative numbers under "Expenses" says the minus
 * sign twice. See ui/reports for the note.
 */

/** The value standing for "whatever the calendar was set to". */
const CUSTOM = 'custom';

export default function IncomeStatementScreen() {
  const [presetKey, setPresetKey] = useState<string | null>('this-year');

  /*
   * `draft` is mid-selection; `custom` is committed. The calendar reports the
   * first press as `{from, to: undefined}`, and this report REFUSES a half
   * range - the API requires both bounds - so running on the draft would mean
   * a 422 between the two presses.
   */
  const [draft, setDraft] = useState<DateRange>({});
  const [custom, setCustom] = useState<DateRange | null>(null);

  const range = useMemo(() => {
    if (custom?.from && custom.to) return { from: custom.from, to: custom.to };

    const preset = RANGE_PRESETS.find((p) => p.key === presetKey);
    const resolved = preset ? preset.range(new Date()) : {};

    /*
     * A period, always. "All time" is offered on the listings and is not a
     * question a statement can answer, so if the preset leaves a bound open
     * this falls back to the year - which is what the report opens on anyway.
     */
    const today = new Date();
    const yearStart = `${today.getFullYear()}-01-01`;

    return {
      from: resolved.from ?? yearStart,
      to: resolved.to ?? today.toISOString().slice(0, 10),
    };
  }, [presetKey, custom]);

  const report = useIncomeStatement(range.from, range.to);
  const meta = report.data?.meta;
  const rows = report.data?.data ?? [];

  // Positive on screen; the sign is the API's single representation, not a
  // second opinion about what an expense is. See the note at the top.
  const magnitude = (row: StatementRow) => row.amount.replace(/^-/, '');

  const columns = useMemo<Column<StatementRow>[]>(
    () => [
      {
        key: 'ledger',
        header: 'Account',
        width: 240,
        frozen: true,
        render: (row) => <Cell>{row.ledger}</Cell>,
        sort: (row) => row.ledger,
      },
      {
        key: 'group',
        header: 'Group',
        width: 200,
        render: (row) => <Cell>{row.account_group}</Cell>,
        sort: (row) => row.account_group,
      },
      {
        key: 'amount',
        header: 'Amount',
        width: 150,
        align: 'right',
        render: (row) => <NumberCell>{formatMoney(magnitude(row))}</NumberCell>,
        sort: (row) => Number(row.amount),
      },
    ],
    [],
  );

  const income = rows.filter((row) => row.section === 'income');
  const expense = rows.filter((row) => row.section === 'expense');

  return (
    <Screen>
      <ScreenHeader
        title="Income statement"
        subtitle={meta ? `${meta.from} to ${meta.to}` : undefined}
        action={
          <Button size="sm" variant="tertiary" onPress={() => router.back()}>
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      <Section first>
        <Toolbar
          filters={
            <>
              <FilterSelect
                icon="calendar"
                value={custom ? CUSTOM : (presetKey ?? CUSTOM)}
                options={[
                  // "All time" is deliberately absent: see the note on `range`.
                  ...RANGE_PRESETS.filter((p) => p.key !== 'all').map((p) => ({
                    value: p.key,
                    label: p.label,
                  })),
                  { value: CUSTOM, label: 'Chosen dates' },
                ]}
                onChange={(value) => {
                  if (value === CUSTOM) return;

                  setPresetKey(value);
                  setCustom(null);
                  setDraft({});
                }}
              />

              <DateField
                value={custom ?? draft}
                onChange={(next) => {
                  setDraft(next);

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
              path="/staff/reports/income-statement/export"
              name="income-statement"
              scope="Every account that moved in this period, with the surplus."
              query={{ from: range.from, to: range.to }}
              disabled={report.isLoading || rows.length === 0}
            />
          }
        />

        <Stack gap="md">
          {/*
            Said here for the same reason the paid report says its own: a
            statement read against a bank balance will not match unless the
            reader knows what it counts. An approved voucher is in; a draft is
            not, because nothing is posted until it is approved.
          */}
          <Text tone="muted" style={type.rowMeta}>
            Counted by posting date, and only from approved documents. A draft voucher is not in the
            accounts yet, so it is not here either.
          </Text>

          <StateView
            loading={report.isLoading}
            error={report.error}
            empty={rows.length === 0}
            emptyTitle="Nothing posted"
            emptyMessage="No income or expense account moved in this period."
            onRetry={() => void report.refetch()}
          >
            <Stack gap="xl">
              <Stack gap="sm">
                <Text tone="muted" style={{ ...type.section, textTransform: 'uppercase' }}>
                  Income
                </Text>

                {income.length === 0 ? (
                  <Text tone="muted" style={type.rowMeta}>
                    No income account moved in this period.
                  </Text>
                ) : (
                  <DataTable
                    columns={columns}
                    rows={income}
                    keyExtractor={(row) => `${row.account_group}:${row.ledger}`}
                  />
                )}

                <Total label="Total income" value={meta?.total_income} />
              </Stack>

              <Stack gap="sm">
                <Text tone="muted" style={{ ...type.section, textTransform: 'uppercase' }}>
                  Expenses
                </Text>

                {expense.length === 0 ? (
                  <Text tone="muted" style={type.rowMeta}>
                    No expense account moved in this period.
                  </Text>
                ) : (
                  <DataTable
                    columns={columns}
                    rows={expense}
                    keyExtractor={(row) => `${row.account_group}:${row.ledger}`}
                  />
                )}

                <Total label="Total expenses" value={meta?.total_expense} />
              </Stack>

              {/*
                THE BOTTOM LINE, in a Panel, because it is the one figure the
                committee came for and a fourth row of the same weight as the
                subtotals would hide it among them.

                A deficit is not an error, so the panel stays neutral: an
                association that spent more than it took in a quarter has a fact
                to discuss, not a fault to fix.
              */}
              <Panel>
                <Inline gap="md" justify="between">
                  <Text style={type.rowTitle}>
                    {meta && meta.net_surplus.startsWith('-') ? 'Net deficit' : 'Net surplus'}
                  </Text>

                  {meta ? (
                    <Amount value={meta.net_surplus.replace(/^-/, '')} />
                  ) : (
                    <Text tone="muted" style={type.body}>
                      —
                    </Text>
                  )}
                </Inline>

                <Text tone="muted" style={type.rowMeta}>
                  Income less expenses for this period. Computed by the server, not by adding the
                  two totals above on this device.
                </Text>
              </Panel>
            </Stack>
          </StateView>
        </Stack>
      </Section>
    </Screen>
  );
}

/**
 * A section's subtotal, under its table.
 *
 * Its own row rather than the table's totals row: the table shows the accounts
 * that MOVED, and its footer would read as a total of what is on screen. This
 * is the server's figure for the section, which is the same thing today and
 * would not be if the table ever paged.
 */
function Total({ label, value }: { label: string; value?: string }) {
  return (
    <Inline gap="md" justify="between">
      <Text tone="muted" style={type.rowMeta}>
        {label}
      </Text>

      {value ? (
        <Text style={type.rowTitle}>{formatMoney(value)}</Text>
      ) : (
        <Text tone="muted" style={type.rowMeta}>
          —
        </Text>
      )}
    </Inline>
  );
}
