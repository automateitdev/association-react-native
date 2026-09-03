import { router } from 'expo-router';
import { View } from 'react-native';
import { usePayments, type Payment } from '@/features/payments/queries';
import { ReceiptButton } from '@/features/payments/ReceiptButton';
import {
  AmountBreakdown,
  Row,
  Screen,
  ScreenHeader,
  Section,
  StateView,
  Text,
  space,
  type,
} from '@/ui';

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
      footer={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' }}>
          <StatusLine status={payment.status} />

          {/*
            The receipt, and only once the payment is COMPLETED.
            
            It asserts the association has the money, so it does not exist for
            anything still awaiting approval - the server refuses those, and a
            button that appeared and then explained itself with an error is
            worse than one that was never there.
          */}
          {payment.status === 'completed' ? (
            <ReceiptButton
              path={`/payments/${payment.id}/invoice`}
              invoiceNo={payment.invoice_no}
            />
          ) : null}
        </View>
      }
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
