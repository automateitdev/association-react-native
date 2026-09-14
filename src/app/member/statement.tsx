import { router } from 'expo-router';
import { formatMoney } from '@/api/money';
import { useStatement, type StatementRow } from '@/features/dues/queries';
import { usePayments } from '@/features/payments/queries';
import { ReceiptButton } from '@/features/payments/ReceiptButton';
import {
  AmountBreakdown,
  DataTable,
  Row,
  Screen,
  ScreenHeader,
  Section,
  Stat,
  StatGrid,
  Stack,
  StateView,
  Text,
  type,
} from '@/ui';

/**
 * The member's own account, period by period.
 *
 * THE OFFICE HAS HAD THIS SINCE THE LEGACY AND THE MEMBER NEVER HAS. The portal
 * could say what was owed today and list receipts, and nothing put the two
 * together: "did I pay March" meant scrolling a stack of invoice cards reading
 * dates, and "what did I pay in fines last year" had no answer at all short of
 * arithmetic on a phone.
 *
 * A TABLE, AND DELIBERATELY. Everywhere else in the member portal is cards and
 * rows, because everywhere else is a task - choose, pay, correct. This is the
 * one screen that is a RECORD, read down a column and compared across periods,
 * and the association's own reports are tables for the same reason. It is also
 * the screen a member might print and take to the office to argue with, which
 * is why every figure on it - including the column totals - is the server's.
 *
 * ONE ROW PER MONTH CHARGED, not per payment. A single payment often settles
 * six months at once, so a row per payment hides exactly what somebody opens a
 * statement to find: the month that is missing.
 *
 * NEWEST FIRST, because the question is almost always about something recent.
 * Sorting is available on every column that has an order worth asking for.
 */
export default function MemberStatement() {
  const statement = useStatement();
  const payments = usePayments();

  const meta = statement.data?.meta;

  /*
   * PAYMENTS THAT SETTLED NOTHING, and the reason this section exists at all.
   *
   * A statement is organised by period, so a payment that never cleared one
   * appears in it nowhere: 154 refused payments across this association settle
   * no item. Folding History into this screen without them would have quietly
   * deleted a member's record of a slip the office turned down - along with any
   * chance of seeing that it was turned down.
   *
   * Below the table rather than in it, because they are not periods and
   * inventing a period row for them would put money against a month nobody
   * charged.
   */
  const unapplied = (payments.data ?? []).filter(
    (payment) => payment.status !== 'completed',
  );

  const columns = [
    {
      key: 'period',
      header: 'PERIOD',
      width: 96,
      render: (row: StatementRow) => <Text style={type.rowTitle}>{row.period}</Text>,
      sortValue: (row: StatementRow) => row.period,
    },
    {
      key: 'fee_head',
      header: 'FEE HEAD',
      width: 150,
      render: (row: StatementRow) => (
        <Text tone="muted" style={type.rowMeta}>
          {row.fee_head}
        </Text>
      ),
      sortValue: (row: StatementRow) => row.fee_head,
    },
    {
      key: 'instalment',
      header: 'INSTALMENT',
      width: 120,
      align: 'right' as const,
      render: (row: StatementRow) => <Text style={type.amount}>{formatMoney(row.instalment_amount)}</Text>,
      total: <Text style={type.amount}>{formatMoney(meta?.instalment_total ?? '0.00')}</Text>,
      sortValue: (row: StatementRow) => Number(row.instalment_amount),
    },
    {
      key: 'fine',
      header: 'FINE',
      width: 100,
      align: 'right' as const,
      render: (row: StatementRow) => (
        /*
         * A zero fine is rendered as a dash, not "৳0.00". Most months carry no
         * fine, and a column of zeroes is noise that makes the handful of real
         * ones harder to find - which is the only reason to look at it.
         */
        <Text tone={row.fine_amount === '0.00' ? 'muted' : undefined} style={type.amount}>
          {row.fine_amount === '0.00' ? '—' : formatMoney(row.fine_amount)}
        </Text>
      ),
      total: <Text style={type.amount}>{formatMoney(meta?.fine_total ?? '0.00')}</Text>,
      sortValue: (row: StatementRow) => Number(row.fine_amount),
    },
    {
      key: 'status',
      header: 'STATUS',
      width: 116,
      /*
       * Words, not a badge. `StatusBadge` speaks about MEMBERS - active,
       * inactive, suspended - and these are instalments; borrowing it would put
       * one vocabulary in two jobs.
       *
       * "Scheduled" rather than "Unpaid" for a month nobody has been asked for
       * yet. Both are literally unpaid, and telling a member their 2027
       * instalment is unpaid reads as a reproach for a bill that does not
       * exist. Only a period that is actually due gets the danger tone.
       */
      render: (row: StatementRow) => (
        <Text
          tone={row.status === 'Unpaid' && row.due ? 'danger' : 'muted'}
          numberOfLines={1}
          style={type.rowMeta}
        >
          {row.status === 'Paid'
            ? 'Paid'
            : row.status === 'Requested'
              ? 'Awaiting approval'
              : row.due
                ? 'Outstanding'
                : 'Scheduled'}
        </Text>
      ),
      sortValue: (row: StatementRow) => row.status,
    },
    {
      key: 'paid_on',
      header: 'PAID ON',
      width: 110,
      render: (row: StatementRow) => (
        <Text tone="muted" style={type.rowMeta}>
          {row.paid_on ?? '—'}
        </Text>
      ),
      sortValue: (row: StatementRow) => row.paid_on ?? '',
    },
    {
      key: 'invoice',
      header: 'INVOICE',
      width: 190,
      render: (row: StatementRow) => (
        <Text tone="muted" style={type.rowMeta}>
          {row.invoice_no ?? '—'}
        </Text>
      ),
      sortValue: (row: StatementRow) => row.invoice_no ?? '',
    },
    {
      key: 'receipt',
      header: 'RECEIPT',
      width: 120,
      /*
       * THE RECEIPT LIVES ON THE ROW IT BELONGS TO. It used to be on a separate
       * History tab that listed the same money a second time, by payment
       * instead of by period - so a member looking up March found the month
       * here and had to go somewhere else to get the paper for it.
       *
       * Only where a payment actually settled the period. An unpaid month has
       * no receipt to fetch, and the server refuses one for a payment still
       * awaiting approval - a button that appears and then explains itself with
       * an error is worse than one that was never there.
       */
      render: (row: StatementRow) =>
        row.payment_id && row.invoice_no && row.status === 'Paid' ? (
          <ReceiptButton path={`/payments/${row.payment_id}/invoice`} invoiceNo={row.invoice_no} />
        ) : (
          <Text tone="muted" style={type.rowMeta}>
            —
          </Text>
        ),
    },
  ];

  return (
    <Screen>
      <ScreenHeader title="Statement" subtitle="Every period the association has charged you" />

      <StateView
        loading={statement.isPending}
        error={statement.error}
        empty={(statement.data?.data.length ?? 0) === 0}
        emptyTitle="Nothing charged yet"
        emptyMessage="Once the association assigns your first instalment it will appear here."
        onRetry={statement.refetch}
      >
        <Section first>
          <StatGrid>
            <Stat label="Periods charged" value={String(meta?.periods ?? 0)} icon="history" />
            <Stat label="Periods paid" value={String(meta?.paid_periods ?? 0)} icon="check" />
            <Stat
              label="Instalments paid"
              value={formatMoney(meta?.paid_instalment_total ?? '0.00')}
              icon="pay"
            />
            <Stat
              label="Fines paid"
              value={formatMoney(meta?.paid_fine_total ?? '0.00')}
              icon="fine"
            />
          </StatGrid>
        </Section>

        <Section title="By period">
          <DataTable
            columns={columns}
            rows={statement.data?.data ?? []}
            keyExtractor={(row) => row.fee_assign_id}
            totalsLabelKey="fee_head"
            /*
             * NO `onRowPress`. It was there first and had to go the moment the
             * receipt moved into the table: a pressable row IS a button, so a
             * button inside one nests, which React refuses - "<button> cannot
             * contain a nested <button>" - and browsers resolve by guessing
             * which of the two a tap meant.
             *
             * The explicit control is the better half to keep anyway. A row
             * that silently opens something competes with the one thing on it
             * that says what it does.
             */
          />
        </Section>
        {unapplied.length > 0 ? (
          <Section title="Payments not applied to a period">
            <Stack gap="none">
              {unapplied.map((payment, index) => (
                <Row
                  key={payment.id}
                  title={payment.invoice_no}
                  meta={[
                    payment.payment_date ?? 'Submitted',
                    payment.status === 'pending'
                      ? 'Awaiting approval'
                      : payment.status === 'suspended'
                        ? 'Not accepted'
                        : 'Expired',
                  ].join(' · ')}
                  trailing={
                    <AmountBreakdown
                      instalment={payment.payable_amount}
                      fine={payment.fine_amount}
                      total={payment.total_amount}
                    />
                  }
                  onPress={() => router.push(`/member/payment/${payment.id}`)}
                  divider={index < unapplied.length - 1}
                />
              ))}
            </Stack>
          </Section>
        ) : null}
      </StateView>
    </Screen>
  );
}
