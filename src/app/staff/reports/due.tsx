import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { formatMoney } from '@/api/money';
import { members, useDueInfo, type DueRow } from '@/features/staff/reports';
import {
  Button,
  Cell,
  Chip,
  DataTable,
  NumberCell,
  Screen,
  ScreenHeader,
  Section,
  StateView,
  StatusBadge,
  Text,
  space,
  type,
  type Column,
} from '@/ui';

/**
 * Outstanding dues: who owes what, as at a date (FR-REP-5).
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
  const [asOf, setAsOf] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | null>(null);

  const report = useDueInfo(asOf, status);
  const meta = report.data?.meta;
  const rows = report.data?.data ?? [];

  const columns = useMemo<Column<DueRow>[]>(
    () => [
      {
        key: 'member',
        header: 'Member',
        width: 180,
        render: (row) => <Cell>{row.member_name}</Cell>,
      },
      {
        key: 'status',
        header: 'Status',
        width: 130,
        render: (row) => <StatusBadge status={row.member_status} />,
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
        /*
         * NO TOTAL, deliberately.
         *
         * This report's `meta` carries no sum of instalment counts - it has
         * `members`, which is a count of PEOPLE. An earlier version of this file
         * put `meta.members` here, which would have printed the number of
         * debtors under a column of instalment counts and looked entirely
         * plausible.
         *
         * The rule that saves this is the one the table enforces: a total must
         * be a figure the server sent for THAT column. Where the server sends
         * none, the column has none.
         */
      },
      {
        key: 'instalments',
        header: 'Instalments due',
        width: 140,
        align: 'right',
        render: (row) => <NumberCell>{formatMoney(row.instalments_due)}</NumberCell>,
        total: meta ? <NumberCell bold>{formatMoney(meta.instalments_due)}</NumberCell> : undefined,
      },
      {
        key: 'fines',
        header: 'Fines due',
        width: 130,
        align: 'right',
        render: (row) => <NumberCell>{formatMoney(row.fines_due)}</NumberCell>,
        total: meta ? <NumberCell bold>{formatMoney(meta.fines_due)}</NumberCell> : undefined,
      },
      {
        key: 'total',
        header: 'Total due',
        width: 140,
        align: 'right',
        render: (row) => <NumberCell bold>{formatMoney(row.total_due)}</NumberCell>,
        total: meta ? <NumberCell bold>{formatMoney(meta.total_due)}</NumberCell> : undefined,
      },
    ],
    [meta],
  );

  return (
    <Screen onRefresh={() => void report.refetch()} refreshing={report.isRefetching}>
      <ScreenHeader
        title="Outstanding dues"
        subtitle={meta ? `As at ${meta.as_of} · ${members(meta.members)}` : undefined}
        action={
          <Button size="sm" variant="tertiary" onPress={() => router.back()}>
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      <Section title="Members included" first>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          {/*
            The default excludes inactive members, because someone the
            association has not admitted is not a debtor. It is offered as a
            filter rather than hidden entirely - staff occasionally need to see
            what an unapproved applicant has already been assigned.
          */}
          <Chip size="sm" variant={status === null ? 'primary' : 'secondary'} onPress={() => setStatus(null)}>
            <Chip.Label>Active and suspended</Chip.Label>
          </Chip>
          <Chip
            variant={status === 'active' ? 'primary' : 'secondary'}
            onPress={() => setStatus('active')}
          >
            <Chip.Label>Active only</Chip.Label>
          </Chip>
          <Chip
            variant={status === 'suspended' ? 'primary' : 'secondary'}
            onPress={() => setStatus('suspended')}
          >
            <Chip.Label>Suspended only</Chip.Label>
          </Chip>
        </View>
      </Section>

      <Section title="As at">
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Chip
            variant={asOf === undefined ? 'primary' : 'secondary'}
            onPress={() => setAsOf(undefined)}
          >
            <Chip.Label>Today</Chip.Label>
          </Chip>
          {monthEnds().map((date) => (
            <Chip
              size="sm"
              key={date}
              variant={asOf === date ? 'primary' : 'secondary'}
              onPress={() => setAsOf(date)}
            >
              <Chip.Label>{date}</Chip.Label>
            </Chip>
          ))}
        </View>
      </Section>

      <StateView
        loading={report.isLoading}
        error={report.error}
        empty={rows.length === 0}
        emptyTitle="Nothing outstanding"
        emptyMessage="No member has an unpaid instalment at this date."
        onRetry={() => void report.refetch()}
      >
        <Section title="Report">
          <DataTable
            columns={columns}
            rows={rows}
            keyExtractor={(row) => row.member_id}
            totalsLabel={members(rows.length)}
          />
        </Section>
      </StateView>
    </Screen>
  );
}

/**
 * The last few month-ends, as report cut-off dates.
 *
 * A report is nearly always run "as at the end of a month". Offering those
 * directly avoids the date picker that does not exist (R-1) and avoids a typed
 * date being rejected by the server for a format nobody was shown.
 */
function monthEnds(count = 5): string[] {
  const today = new Date();
  const dates: string[] = [];

  for (let i = 0; i < count; i++) {
    // Day 0 of next month is the last day of this one.
    const end = new Date(today.getFullYear(), today.getMonth() - i, 0);
    dates.push(
      `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
    );
  }

  return dates;
}
