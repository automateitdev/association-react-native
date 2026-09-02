import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { usePayment } from '@/features/payments/queries';
import { Card, Chip, MoneyRow, Screen, Separator, StateView, Text } from '@/ui';

/**
 * One payment, in detail.
 *
 * Where the member lands after submitting, and where they return to check
 * whether staff have approved it. The server's status is the only truth here -
 * the app never infers "paid" from having submitted successfully.
 */
export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const payment = usePayment(Number(id));

  return (
    <Screen onRefresh={payment.refetch} refreshing={payment.isRefetching}>
      <StateView loading={payment.isPending} error={payment.error} onRetry={payment.refetch}>
        {payment.data ? (
          <>
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 22, fontWeight: '700' }}>
                {payment.data.invoice_no}
              </Text>
              <View style={{ flexDirection: 'row' }}>
                <Chip>
                  <Chip.Label>{describe(payment.data.status)}</Chip.Label>
                </Chip>
              </View>
            </View>

            {payment.data.status === 'pending' ? (
              <Card>
                <Card.Body>
                  {/* Sets the expectation explicitly. A member who does not know
                      a human has to look at this assumes the app is stuck. */}
                  <Text>
                    Your association will check this against your slip and confirm it. You do not
                    need to pay again.
                  </Text>
                </Card.Body>
              </Card>
            ) : null}

            <Card>
              <Card.Body style={{ gap: 8 }}>
                <Text style={{ fontWeight: '700' }}>Amount</Text>
                <MoneyRow
                  instalment={payment.data.payable_amount}
                  fine={payment.data.fine_amount}
                  total={payment.data.total_amount}
                  emphasis
                />
              </Card.Body>
            </Card>

            {payment.data.items?.length ? (
              <Card>
                <Card.Body style={{ gap: 10 }}>
                  <Text style={{ fontWeight: '700' }}>Instalments covered</Text>

                  {payment.data.items.map((item, index) => (
                    <View key={item.fee_assign_id} style={{ gap: 6 }}>
                      {index > 0 ? <Separator /> : null}
                      <Text style={{ fontWeight: '600' }}>{item.period}</Text>
                      {/* No per-line total: the API does not send one, and
                          inventing it would print a wrong figure whenever a
                          fine exists. The payment total above is authoritative. */}
                      <MoneyRow
                        instalment={item.instalment_amount}
                        fine={item.fine_amount}
                      />
                    </View>
                  ))}
                </Card.Body>
              </Card>
            ) : null}

            {payment.data.documents.length ? (
              <Card>
                <Card.Body style={{ gap: 6 }}>
                  <Text style={{ fontWeight: '700' }}>Your slips</Text>
                  {payment.data.documents.map((doc) => (
                    <Text key={doc.index}>{doc.original_name}</Text>
                  ))}
                </Card.Body>
              </Card>
            ) : null}
          </>
        ) : null}
      </StateView>
    </Screen>
  );
}

function describe(status: string): string {
  switch (status) {
    case 'completed':
      return 'Paid';
    case 'pending':
      return 'Awaiting approval';
    case 'suspended':
      return 'Not accepted';
    case 'expired':
      return 'Expired';
    default:
      return status;
  }
}
