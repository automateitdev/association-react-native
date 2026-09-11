import { router } from 'expo-router';
import { useState } from 'react';
import { formatMoney } from '@/api/money';
import { ExportButtons } from '@/features/staff/ExportButtons';
import { useTrialBalance, type TrialBalanceRow } from '@/features/staff/reports';
import {
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
 * The trial balance: every account's balance, and whether the books balance.
 *
 * THE ANSWER IS AT THE TOP, not at the bottom of the table. This report exists
 * to say one thing - do the two sides agree - and a reader who has to scroll to
 * two totals and subtract them in their head has been handed a worksheet rather
 * than a check. The panel says it in words before the rows begin.
 *
 * A DATE, NOT A RANGE. A trial balance is what is true on one day, opening
 * balances included. The DateField picks ranges by design, so this uses its
 * `from` as the single date and ignores the rest - see the note on the picker.
 */
export default function TrialBalanceScreen() {
  const [asOf, setAsOf] = useState(todayIso());

  const report = useTrialBalance(asOf);
  const meta = report.data?.meta;
  const rows = report.data?.data ?? [];

  const columns: Column<TrialBalanceRow>[] = [
    {
      key: 'ledger',
      header: 'Account',
      width: 230,
      frozen: true,
      render: (row) => <Cell>{row.ledger}</Cell>,
      sort: (row) => row.ledger,
    },
    {
      key: 'group',
      header: 'Group',
      width: 170,
      render: (row) => <Cell>{row.account_group}</Cell>,
      sort: (row) => row.account_group,
    },
    {
      key: 'category',
      header: 'Category',
      width: 130,
      render: (row) => <Cell>{row.category}</Cell>,
      sort: (row) => row.category,
    },
    {
      key: 'debit',
      header: 'Debit',
      width: 140,
      align: 'right',
      // A dash rather than 0.00 on the side an account is not on: a column of
      // zeroes beside every figure is noise, and the eye is looking for which
      // side each account sits.
      render: (row) => <NumberCell>{money(row.debit)}</NumberCell>,
      sort: (row) => Number(row.debit),
      total: meta ? <NumberCell>{formatMoney(meta.total_debit)}</NumberCell> : undefined,
    },
    {
      key: 'credit',
      header: 'Credit',
      width: 140,
      align: 'right',
      render: (row) => <NumberCell>{money(row.credit)}</NumberCell>,
      sort: (row) => Number(row.credit),
      total: meta ? <NumberCell>{formatMoney(meta.total_credit)}</NumberCell> : undefined,
    },
  ];

  return (
    <Screen>
      <ScreenHeader
        title="Trial balance"
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
              /*
                A single date out of a range picker. The calendar is the app's
                one date control and building a second for this would be a
                second thing to keep in step; taking `from` and ignoring `to` is
                the smaller compromise, and the field reads as "as at" either
                way.
              */
              value={{ from: asOf, to: asOf }}
              onChange={(next) => next.from && setAsOf(next.from)}
              placeholder="As at"
            />
          }
          actions={
            <ExportButtons
              path="/staff/reports/trial-balance/export"
              name="trial-balance"
              scope="Every account with a balance, and both totals."
              query={{ as_of: asOf }}
              disabled={report.isLoading || rows.length === 0}
            />
          }
        />

        <Stack gap="md">
          {meta ? (
            <Panel tone={meta.balanced ? 'success' : 'danger'}>
              <Text style={type.rowTitle}>
                {meta.balanced
                  ? 'The books balance.'
                  : `Out of balance by ${formatMoney(meta.difference.replace(/^-/, ''))}`}
              </Text>

              <Text tone="muted" style={type.rowMeta}>
                {meta.balanced
                  ? 'Every entry was made on both sides.'
                  : /*
                      Said, because it is almost certainly the answer. Entries
                      cannot be unbalanced here - a voucher is refused unless it
                      balances, and every payment posts a pair - so a difference
                      means an opening balance is wrong, and that is the one
                      figure staff type in by hand.
                    */
                    'Entries here always post to both sides, so this is almost certainly an opening balance. Check them in Admin → Chart of accounts.'}
              </Text>
            </Panel>
          ) : null}

          <StateView
            loading={report.isLoading}
            error={report.error}
            empty={rows.length === 0}
            emptyTitle="Nothing posted"
            emptyMessage="No account has a balance as at this date."
            onRetry={() => void report.refetch()}
          >
            <DataTable
              columns={columns}
              rows={rows}
              keyExtractor={(row) => `${row.account_group}:${row.ledger}`}
              totalsLabel={`${rows.length} account${rows.length === 1 ? '' : 's'}`}
            />
          </StateView>
        </Stack>
      </Section>
    </Screen>
  );
}

/** A dash on the side an account is not on, rather than a column of zeroes. */
function money(value: string): string {
  return Number(value) === 0 ? '—' : formatMoney(value);
}
