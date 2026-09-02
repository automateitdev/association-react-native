import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { usePayments, type Payment } from '@/features/payments/queries';
import { Card, Chip, MoneyRow, Screen, StateView, Text } from '@/ui';

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
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Payment history</Text>

      <StateView
        loading={payments.isPending}
        error={payments.error}
        empty={payments.data?.length === 0}
        emptyTitle="No payments yet"
        emptyMessage="Payments you make will appear here."
        onRetry={payments.refetch}
      >
        <View style={{ gap: 12 }}>
          {payments.data?.map((payment) => (
            <PaymentCard key={payment.id} payment={payment} />
          ))}
        </View>
      </StateView>
    </Screen>
  );
}

function PaymentCard({ payment }: { payment: Payment }) {
  return (
    // Card is presentational here; the tap target is the Pressable around it.
    <Pressable onPress={() => router.push(`/member/payment/${payment.id}`)}>
    <Card>
      <Card.Body style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '600' }}>{payment.invoice_no}</Text>
            <Text style={{ opacity: 0.7 }}>
              {payment.payment_date ?? 'Submitted, awaiting approval'}
            </Text>
          </View>

          <Chip>
            <Chip.Label>{statusLabel(payment.status)}</Chip.Label>
          </Chip>
        </View>

        {/* Instalment and fine stay apart on a receipt too - a member checking
            an old payment should still see what was subscription and what was
            penalty. */}
        <MoneyRow
          instalment={payment.payable_amount}
          fine={payment.fine_amount}
          total={payment.total_amount}
        />

        {payment.documents.length > 0 ? (
          <Text style={{ fontSize: 12, opacity: 0.7 }}>
            {payment.documents.length} document{payment.documents.length === 1 ? '' : 's'} attached
          </Text>
        ) : null}
      </Card.Body>
    </Card>
    </Pressable>
  );
}

/** Plain words, not internal statuses. `suspended` is not a member's vocabulary. */
function statusLabel(status: Payment['status']): string {
  switch (status) {
    case 'completed':
      return 'Paid';
    case 'pending':
      return 'Awaiting approval';
    case 'suspended':
      return 'Not accepted';
    case 'expired':
      return 'Expired';
  }
}
