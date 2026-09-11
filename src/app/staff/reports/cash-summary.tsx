import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { formatMoney } from '@/api/money';
import { ExportButtons } from '@/features/staff/ExportButtons';
import {
  RANGE_PRESETS,
  useCashSummary,
  type CashSummaryRow,
  type DateRange,
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
 * Cash summary: what was there, what moved, what is left.
 *
 * THE COLUMNS ARE IN THE ORDER SOMEBODY SAYS IT OUT LOUD - opening, received,
 * paid, closing - because the question this answers is asked out loud, usually
 * just before a committee meeting: what have we actually got?
 *
 * CLOSING IS ARITHMETIC THE READER CAN CHECK. The server computes it from the
 * opening and the movement rather than reading a balance back, so a row that
 * does not add up is visible on the page rather than being something you have
 * to trust.
 *
 * WHICH ACCOUNTS COUNT is the association's own answer - `is_cash` on the
 * ledger - not a guess from a group name anybody may rename. When nothing is
 * marked, the screen says where to fix it rather than showing an empty table
 * that looks like a quiet quarter.
 */

/** The value standing for "whatever the calendar was set to". */
const CUSTOM = 'custom';

export default function CashSummaryScreen() {
  const [presetKey, setPresetKey] = useState<string | null>('this-year');
  const [draft, setDraft] = useState<DateRange>({});
  const [custom, setCustom] = useState<DateRange | null>(null);

  const range = useMemo(() => {
    if (custom?.from && custom.to) return { from: custom.from, to: custom.to };

    const preset = RANGE_PRESETS.find((p) => p.key === presetKey);
    const resolved = preset ? preset.range(new Date()) : {};
    const today = new Date();

    // A period, always: this report requires both bounds, as the income
    // statement does and for the same reason.
    return {
      from: resolved.from ?? `${today.getFullYear()}-01-01`,
      to: resolved.to ?? today.toISOString().slice(0, 10),
    };
  }, [presetKey, custom]);

  const report = useCashSummary(range.from, range.to);
  const meta = report.data?.meta;
  const rows = report.data?.data ?? [];

  const columns: Column<CashSummaryRow>[] = [
    {
      key: 'ledger',
      header: 'Account',
      width: 210,
      frozen: true,
      render: (row) => <Cell>{row.ledger}</Cell>,
      sort: (row) => row.ledger,
    },
    {
      key: 'opening',
      header: 'Opening',
      width: 140,
      align: 'right',
      render: (row) => <NumberCell>{formatMoney(row.opening)}</NumberCell>,
      sort: (row) => Number(row.opening),
      total: meta ? <NumberCell>{formatMoney(meta.total_opening)}</NumberCell> : undefined,
    },
    {
      key: 'received',
      header: 'Received',
      width: 140,
      align: 'right',
      render: (row) => <NumberCell>{formatMoney(row.received)}</NumberCell>,
      sort: (row) => Number(row.received),
      total: meta ? <NumberCell>{formatMoney(meta.total_received)}</NumberCell> : undefined,
    },
    {
      key: 'paid',
      header: 'Paid',
      width: 140,
      align: 'right',
      render: (row) => <NumberCell>{formatMoney(row.paid)}</NumberCell>,
      sort: (row) => Number(row.paid),
      total: meta ? <NumberCell>{formatMoney(meta.total_paid)}</NumberCell> : undefined,
    },
    {
      key: 'closing',
      header: 'Closing',
      width: 150,
      align: 'right',
      render: (row) => <NumberCell bold>{formatMoney(row.closing)}</NumberCell>,
      sort: (row) => Number(row.closing),
      total: meta ? <NumberCell bold>{formatMoney(meta.total_closing)}</NumberCell> : undefined,
    },
  ];

  return (
    <Screen>
      <ScreenHeader
        title="Cash summary"
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
              path="/staff/reports/cash-summary/export"
              name="cash-summary"
              scope="Every cash account, with opening and closing."
              query={{ from: range.from, to: range.to }}
              disabled={report.isLoading || rows.length === 0}
            />
          }
        />

        <Stack gap="md">
          <StateView
            loading={report.isLoading}
            error={report.error}
            empty={rows.length === 0}
            /*
              A configuration answer, not an empty period. An association that
              has never marked its accounts would otherwise read this as "no
              money moved", which is a very different thing.
            */
            emptyTitle="No accounts marked as cash"
            emptyMessage="Mark the till and the bank in Admin → Chart of accounts, and this report will follow them."
            onRetry={() => void report.refetch()}
          >
            <Stack gap="md">
              <DataTable
                columns={columns}
                rows={rows}
                keyExtractor={(row) => row.ledger}
                totalsLabel={`${rows.length} account${rows.length === 1 ? '' : 's'}`}
              />

              {/*
                The one figure somebody came for, out of the table. A closing
                total in a totals row reads as one of five numbers; the question
                was "what have we got", and this is the answer to it.
              */}
              {meta ? (
                <Panel>
                  <Inline gap="md" justify="between">
                    <Text style={type.rowTitle}>In hand at {meta.to}</Text>
                    <Amount value={meta.total_closing} />
                  </Inline>

                  <Text tone="muted" style={type.rowMeta}>
                    Opened at {formatMoney(meta.total_opening)}, received{' '}
                    {formatMoney(meta.total_received)}, paid out {formatMoney(meta.total_paid)}.
                  </Text>
                </Panel>
              ) : null}
            </Stack>
          </StateView>
        </Stack>
      </Section>
    </Screen>
  );
}
