import { router } from 'expo-router';
import { usePayments, type Payment } from '@/features/payments/queries';
import { AmountBreakdown, Row, Screen, ScreenHeader, Section, StateView, Text, type } from '@/ui';

/**
 * Every payment the member has made or submitted.
 *
 * Pending rows matter as much as completed ones: with manual payment, a member
 * who transferred money yesterday is waiting on a person, and seeing the
 * submission sitting there is what stops them paying twice.
 */
export default function HistoryScreen() {
  const payments = usePayments();

  return (
    <Screen onRefresh={payments.refetch} refreshing={payments.isRefetching}>
      <ScreenHeader title="Payments" />

      <StateView
        loading={payments.isPending}
        error={payments.error}
        empty={payments.data?.length === 0}
        emptyTitle="No payments yet"
        emptyMessage="Payments you make will appear here."
        onRetry={payments.refetch}
      >
        <Section first>
          {payments.data?.map((payment, index) => (
            <PaymentRow
              key={payment.id}
              payment={payment}
              divider={index < (payments.data?.length ?? 0) - 1}
            />
          ))}
        </Section>
      </StateView>
    </Screen>
  );
}

function PaymentRow({ payment, divider }: { payment: Payment; divider: boolean }) {
  const attachments =
    payment.documents.length > 0
      ? `${payment.documents.length} document${payment.documents.length === 1 ? '' : 's'}`
      : null;

  return (
    <Row
      title={payment.invoice_no}
      meta={[payment.payment_date ?? 'Submitted', attachments].filter(Boolean).join(' · ')}
      trailing={
        /* Instalment and fine stay apart on a receipt too - a member checking an
           old payment should still see what was subscription and what was
           penalty. */
        <AmountBreakdown
          instalment={payment.payable_amount}
          fine={payment.fine_amount}
          total={payment.total_amount}
        />
      }
      footer={<StatusLine status={payment.status} />}
      onPress={() => router.push(`/member/payment/${payment.id}`)}
      divider={divider}
    />
  );
}

/**
 * Plain words, not internal statuses. `suspended` is not a member's vocabulary.
 *
 * Only the states needing attention carry colour. "Paid" is the expected
 * outcome, and a coloured pill on every completed payment would make a settled
 * history look like a list of alerts.
 */
function StatusLine({ status }: { status: Payment['status'] }) {
  const label =
    status === 'completed'
      ? 'Paid'
      : status === 'pending'
        ? 'Awaiting approval'
        : status === 'suspended'
          ? 'Not accepted'
          : 'Expired';

  const tone =
    status === 'suspended' || status === 'expired'
      ? ('danger' as const)
      : status === 'pending'
        ? ('accent' as const)
        : ('muted' as const);

  return (
    <Text tone={tone} style={type.rowMeta}>
      {label}
    </Text>
  );
}
