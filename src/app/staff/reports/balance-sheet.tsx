import { router } from 'expo-router';
import { useState } from 'react';
import { formatMoney } from '@/api/money';
import { ExportButtons } from '@/features/staff/ExportButtons';
import { useBalanceSheet, type BalanceSheetRow } from '@/features/staff/reports';
import {
  Amount,
  Button,
  Cell,
  DataTable,
  DateField,
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
  todayIso,
  type,
  type Column,
} from '@/ui';

/**
 * The balance sheet: what the association owns, owes, and is worth.
 *
 * TWO HALVES, NOT ONE TABLE. Assets on one side and the funds against them on
 * the other is the shape the statement has had for five hundred years, and it
 * is the shape because the point is the comparison. A single table with a
 * "section" column would make the reader do that comparison themselves.
 *
 * THE ACCUMULATED SURPLUS IS A LINE OF ITS OWN, inside equity. It is not share
 * capital - nobody subscribed for it - and an association reading its own
 * balance sheet should see how much of what it is worth was paid in and how
 * much was earned. It is also the line most likely to be missing from a
 * hand-built statement, which is why it is labelled rather than folded in.
 *
 * AS AT ONE DAY. Everything up to the date, opening balances included, which is
 * the opposite of the income statement - see the note there on why that report
 * refuses them.
 */
export default function BalanceSheetScreen() {
  const [asOf, setAsOf] = useState(todayIso());

  const report = useBalanceSheet(asOf);
  const meta = report.data?.meta;
  const rows = report.data?.data ?? [];

  const columns: Column<BalanceSheetRow>[] = [
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
      width: 190,
      render: (row) => <Cell>{row.account_group}</Cell>,
      sort: (row) => row.account_group,
    },
    {
      key: 'amount',
      header: 'Amount',
      width: 150,
      align: 'right',
      render: (row) => <NumberCell>{formatMoney(row.amount)}</NumberCell>,
      sort: (row) => Number(row.amount),
    },
  ];

  const assets = rows.filter((row) => row.section === 'asset');
  const funds = rows.filter((row) => row.section !== 'asset');

  return (
    <Screen>
      <ScreenHeader
        title="Balance sheet"
        subtitle={meta ? `As at ${meta.as_of}` : undefined}
        action={
          <Button size="sm" variant="tertiary" onPress={() => router.back()}>
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      <Section first>
        <Toolbar
          filters={
            <DateField
              // One date out of the range picker - see the note on the trial
              // balance, which does the same for the same reason.
              value={{ from: asOf, to: asOf }}
              onChange={(next) => next.from && setAsOf(next.from)}
              placeholder="As at"
            />
          }
          actions={
            <ExportButtons
              path="/staff/reports/balance-sheet/export"
              name="balance-sheet"
              scope="Every account with a balance, and the totals of both halves."
              query={{ as_of: asOf }}
              disabled={report.isLoading || rows.length === 0}
            />
          }
        />

        <Stack gap="md">
          {meta && !meta.balanced ? (
            /*
              Only when it is wrong. A statement that announced "this balances"
              every time would train people to stop reading the banner, and the
              two totals below already say it for anybody checking.
            */
            <Panel tone="danger">
              <Text style={type.rowTitle}>
                Out of balance by {formatMoney(meta.difference.replace(/^-/, ''))}
              </Text>
              <Text tone="muted" style={type.rowMeta}>
                Assets should equal what the association owes plus what it is worth. Check the trial
                balance — an opening balance is the usual cause.
              </Text>
            </Panel>
          ) : null}

          <StateView
            loading={report.isLoading}
            error={report.error}
            empty={rows.length === 0}
            emptyTitle="Nothing to show"
            emptyMessage="No account has a balance as at this date."
            onRetry={() => void report.refetch()}
          >
            <Stack gap="xl">
              <Half
                title="What it owns"
                rows={assets}
                columns={columns}
                total={meta?.total_assets}
                totalLabel="Total assets"
                emptyMessage="No asset account has a balance."
              />

              <Half
                title="What it owes, and what it is worth"
                rows={funds}
                columns={columns}
                total={
                  meta
                    ? formatMoney(
                        (Number(meta.total_liabilities) + Number(meta.total_equity)).toFixed(2),
                      )
                    : undefined
                }
                totalLabel="Total liabilities and equity"
                emptyMessage="Nothing owed, and no capital recorded."
                breakdown={
                  meta ? (
                    <>
                      <Line label="Liabilities" value={meta.total_liabilities} />
                      <Line label="Equity" value={meta.total_equity} />
                      <Line label="of which accumulated surplus" value={meta.accumulated_surplus} />
                    </>
                  ) : null
                }
              />
            </Stack>
          </StateView>
        </Stack>
      </Section>
    </Screen>
  );
}

function Half({
  title,
  rows,
  columns,
  total,
  totalLabel,
  emptyMessage,
  breakdown,
}: {
  title: string;
  rows: BalanceSheetRow[];
  columns: Column<BalanceSheetRow>[];
  /** Already formatted, or undefined while the report is loading. */
  total?: string;
  totalLabel: string;
  emptyMessage: string;
  breakdown?: React.ReactNode;
}) {
  return (
    <Stack gap="sm">
      <Text tone="muted" style={{ ...type.section, textTransform: 'uppercase' }}>
        {title}
      </Text>

      {rows.length === 0 ? (
        <Text tone="muted" style={type.rowMeta}>
          {emptyMessage}
        </Text>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          keyExtractor={(row) => `${row.section}:${row.account_group}:${row.ledger}`}
        />
      )}

      {breakdown}

      <Inline gap="md" justify="between">
        <Text style={type.rowTitle}>{totalLabel}</Text>
        {total ? (
          <Amount value={total.replace(/[^\d.-]/g, '')} />
        ) : (
          <Text tone="muted" style={type.body}>
            —
          </Text>
        )}
      </Inline>
    </Stack>
  );
}

/** A named figure under a half, for the parts the totals are made of. */
function Line({ label, value }: { label: string; value: string }) {
  return (
    <Inline gap="md" justify="between">
      <Text tone="muted" style={type.rowMeta}>
        {label}
      </Text>
      <Text tone="muted" style={type.rowMeta}>
        {formatMoney(value)}
      </Text>
    </Inline>
  );
}
