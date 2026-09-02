import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { usePayment } from '@/features/payments/queries';
import {
  AmountBreakdown,
  Button,
  Panel,
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
      <ScreenHeader
        title={payment.data?.invoice_no ?? 'Payment'}
        subtitle={payment.data ? describe(payment.data.status) : undefined}
        action={
          <Button variant="tertiary" onPress={() => router.back()}>
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      <StateView loading={payment.isPending} error={payment.error} onRetry={payment.refetch}>
        {payment.data ? (
          <>
            {payment.data.status === 'pending' ? (
              <View style={{ marginTop: space.lg }}>
                <Panel>
                  {/* Sets the expectation explicitly. A member who does not know
                      a human has to look at this assumes the app is stuck. */}
                  <Text style={type.body}>
                    Your association will check this against your slip and confirm it. You do not
                    need to pay again.
                  </Text>
                </Panel>
              </View>
            ) : null}

            <Section title="Amount" first>
              <AmountBreakdown
                instalment={payment.data.payable_amount}
                fine={payment.data.fine_amount}
                total={payment.data.total_amount}
                align="left"
              />
            </Section>

            {payment.data.items?.length ? (
              <Section title="Instalments covered">
                {payment.data.items.map((item, index) => (
                  <Row
                    key={item.fee_assign_id}
                    title={item.period}
                    trailing={
                      /* No per-line total: the API does not send one, and
                         inventing it would print a wrong figure whenever a fine
                         exists. The payment total above is authoritative. */
                      <AmountBreakdown
                        instalment={item.instalment_amount}
                        fine={item.fine_amount}
                      />
                    }
                    divider={index < (payment.data?.items?.length ?? 0) - 1}
                  />
                ))}
              </Section>
            ) : null}

            {payment.data.documents.length ? (
              <Section title="Your slips">
                {payment.data.documents.map((doc, index) => (
                  <Row
                    key={doc.index}
                    title={doc.original_name}
                    divider={index < payment.data!.documents.length - 1}
                  />
                ))}
              </Section>
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
