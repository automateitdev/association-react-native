import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { ApiError } from '@/api/errors';
import { usePayment, useGatewaySession } from '@/features/payments/queries';
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
 *
 * IT ALSO POLLS, and that is what makes online payment honest. A member who has
 * just come back from the bank's own page has seen a success screen there, and
 * the money may still be seconds away from being confirmed here - the gateway's
 * callback and our verification both have to land. Polling means they watch it
 * settle instead of reading "pending", assuming it failed, and paying twice.
 *
 * The polling stops the instant the status is not pending, so a settled payment
 * costs nothing to look at.
 */
export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const payment = usePayment(Number(id), { poll: true });
  const session = useGatewaySession();
  const [sessionError, setSessionError] = useState<string | null>(null);

  /** Ask for a hosted page again for THIS payment. See the button below. */
  const retry = async () => {
    setSessionError(null);

    try {
      const created = await session.mutateAsync(Number(id));

      if (Platform.OS === 'web') {
        await Linking.openURL(created.url);
      } else {
        await WebBrowser.openAuthSessionAsync(created.url, 'bcsapprn://payment');
      }

      await payment.refetch();
    } catch (e) {
      // Shown, not swallowed. A silent failure here is what put this screen in
      // front of somebody claiming a bank was confirming a payment it had
      // never been sent.
      setSessionError(
        e instanceof ApiError ? e.message : 'The payment page could not be opened.',
      );
    }
  };

  return (
    <Screen onRefresh={payment.refetch} refreshing={payment.isRefetching}>
      <ScreenHeader
        title={payment.data?.invoice_no ?? 'Payment'}
        subtitle={payment.data ? describe(payment.data.status) : undefined}
        action={
          <Button size="sm" variant="tertiary" onPress={() => router.back()}>
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
                  {/*
                    Two different waits, and saying the wrong one is worse than
                    saying nothing. A manual payment waits for a PERSON to look
                    at a slip, which can be days; an online one waits for the
                    bank to confirm, which is usually seconds. A member told
                    "staff will check your slip" about a card payment they just
                    made goes looking for a slip they never had.
                  */}
                  <Text style={type.body}>
                    {payment.data.payment_type !== 'online'
                      ? 'Your association will check this against your slip and confirm it. You do not need to pay again.'
                      : payment.data.gateway_started === false
                        ? 'This payment never reached the bank — the payment page could not be opened. Nothing has been charged. You can try again below, or pay at the bank instead.'
                        : 'Waiting for the bank to confirm. This page updates itself — you do not need to pay again.'}
                  </Text>

                  {/*
                    A retry, because the alternative is a member sitting on a
                    page that will never change. The SAME payment is reused
                    rather than a new one started: the instalments are already
                    held against this invoice, and creating a second would leave
                    the first stranded until the expiry sweep.
                  */}
                  {payment.data.payment_type === 'online' &&
                  payment.data.gateway_started === false ? (
                    <View style={{ marginTop: space.md }}>
                      <Button
                        isDisabled={session.isPending}
                        onPress={() => void retry()}
                      >
                        <Button.Label>
                          {session.isPending ? 'Opening…' : 'Try the payment page again'}
                        </Button.Label>
                      </Button>

                      {sessionError ? (
                        <Text tone="danger" style={{ ...type.rowMeta, marginTop: space.sm }}>
                          {sessionError}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
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
