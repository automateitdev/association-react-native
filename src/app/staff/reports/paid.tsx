import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { formatMoney } from '@/api/money';
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
  Chip,
  DataTable,
  NumberCell,
  Screen,
  ScreenHeader,
  Section,
  StateView,
  Text,
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
export default function PaidReportScreen() {
  const [presetKey, setPresetKey] = useState('this-year');

  const range = useMemo<DateRange>(() => {
    const preset = RANGE_PRESETS.find((p) => p.key === presetKey);
    return preset ? preset.range(new Date()) : {};
  }, [presetKey]);

  const report = useMemberwisePaid(range);
  const meta = report.data?.meta;
  const rows = report.data?.data ?? [];

  const columns = useMemo<Column<PaidRow>[]>(
    () => [
      {
        key: 'member',
        header: 'Member',
        width: 200,
        render: (row) => <Cell>{row.member_name}</Cell>,
      },
      {
        key: 'count',
        // Short, for the same reason as the dues report: the full word wraps.
        header: 'Paid',
        width: 90,
        align: 'right',
        render: (row) => <NumberCell>{String(row.instalments_paid_count)}</NumberCell>,
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
        total: meta ? <NumberCell bold>{formatMoney(meta.fines_paid_amount)}</NumberCell> : undefined,
      },
      {
        key: 'total',
        header: 'Total paid',
        width: 140,
        align: 'right',
        render: (row) => <NumberCell bold>{formatMoney(row.total_paid)}</NumberCell>,
        total: meta ? <NumberCell bold>{formatMoney(meta.total_paid)}</NumberCell> : undefined,
      },
    ],
    [meta],
  );

  const activeRange = RANGE_PRESETS.find((p) => p.key === presetKey);

  return (
    <Screen onRefresh={() => void report.refetch()} refreshing={report.isRefetching}>
      <ScreenHeader
        title="Memberwise paid"
        subtitle={
          meta
            ? [
                activeRange?.label,
                range.from ? `${range.from} to ${range.to}` : 'no date limit',
                members(meta.members),
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        action={
          <Button size="sm" variant="tertiary" onPress={() => router.back()}>
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      <Section title="Period" first>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          {RANGE_PRESETS.map((preset) => (
            <Chip
              size="sm"
              key={preset.key}
              variant={presetKey === preset.key ? 'primary' : 'secondary'}
              onPress={() => setPresetKey(preset.key)}
            >
              <Chip.Label>{preset.label}</Chip.Label>
            </Chip>
          ))}
        </View>

        <Text tone="muted" style={{ ...type.rowMeta, marginTop: space.sm }}>
          Counted by payment date, so a payment approved this month for last
          month&apos;s instalment falls in this month.
        </Text>
      </Section>

      <StateView
        loading={report.isLoading}
        error={report.error}
        empty={rows.length === 0}
        emptyTitle="Nothing paid"
        emptyMessage="No completed payments fall in this period."
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
