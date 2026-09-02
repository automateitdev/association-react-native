import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert as RNAlert, Pressable, View } from 'react-native';
import { ApiError } from '@/api/errors';
import {
  useDues,
  usePaymentInstructions,
  useQuote,
  type Due,
  type Quote,
} from '@/features/dues/queries';
import { startAttempt, useCreatePayment } from '@/features/payments/queries';
import { Button, Card, Checkbox, MoneyRow, Screen, Separator, StateView, Text } from '@/ui';

/**
 * Pay: choose instalments, transfer at the bank, upload the slip.
 *
 * With no gateway integrated this is the ONLY way a member can pay through the
 * app, so the screen has to carry the whole story: what is owed, where to send
 * it, and proof that they did.
 *
 * THE IDEMPOTENCY KEY IS CREATED ONCE PER ATTEMPT.
 * Held in a ref for the life of this attempt so that a retry after a timeout
 * sends the SAME key and the server returns the original payment instead of
 * creating a second one. Regenerating it per request would produce exactly the
 * duplicate charges the mechanism exists to prevent.
 */
export default function PayScreen() {
  const dues = useDues();
  const instructions = usePaymentInstructions();
  const createPayment = useCreatePayment();

  const [selected, setSelected] = useState<number[]>([]);
  const [slips, setSlips] = useState<ImagePicker.ImagePickerAsset[]>([]);

  // One key for this attempt, including its retries.
  const attemptKey = useRef<string>(startAttempt());

  // Only unpaid instalments are selectable. A `Requested` one already has a
  // payment waiting on staff, and offering it again invites a duplicate.
  const payable = useMemo(
    () => (dues.data?.data ?? []).filter((due) => due.status === 'Unpaid'),
    [dues.data],
  );

  const chosen = payable.filter((due) => selected.includes(due.fee_assign_id));

  // The amount to transfer is computed by the SERVER, not here.
  const quote = useQuote(chosen.map((due) => due.fee_assign_id));

  const toggle = (id: number) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const addSlip = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      RNAlert.alert(
        'Photo access needed',
        'The app needs access to your photos so you can attach the bank slip.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Compressed before upload: bank slips are photographed on phones and
      // members are often on mobile data (FR-APP-10).
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: 5 - slips.length,
    });

    if (!result.canceled) setSlips((current) => [...current, ...result.assets].slice(0, 5));
  };

  const submit = () => {
    createPayment.mutate(
      {
        feeAssignIds: chosen.map((due) => due.fee_assign_id),
        documents: slips,
        attemptKey: attemptKey.current,
      },
      {
        onSuccess: (payment) => {
          // A new attempt gets a new key; this one is finished.
          attemptKey.current = startAttempt();
          setSelected([]);
          setSlips([]);
          router.replace(`/member/payment/${payment.id}`);
        },
      },
    );
  };

  const bank = instructions.data?.manual;
  const error = createPayment.error instanceof ApiError ? createPayment.error : null;

  return (
    <Screen onRefresh={dues.refetch} refreshing={dues.isRefetching}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Make a payment</Text>

      <StateView
        loading={dues.isPending}
        error={dues.error}
        empty={payable.length === 0}
        emptyTitle="Nothing to pay"
        emptyMessage="You have no unpaid instalments right now."
        onRetry={dues.refetch}
      >
        <Card>
          <Card.Body style={{ gap: 12 }}>
            <Text style={{ fontWeight: '700' }}>1. Choose instalments</Text>

            {payable.map((due) => (
              <SelectableDue
                key={due.fee_assign_id}
                due={due}
                selected={selected.includes(due.fee_assign_id)}
                onToggle={() => toggle(due.fee_assign_id)}
              />
            ))}
          </Card.Body>
        </Card>

        {chosen.length > 0 ? (
          <Card>
            <Card.Body style={{ gap: 12 }}>
              <Text style={{ fontWeight: '700' }}>2. Transfer this amount</Text>

              {/* Server-computed. The app does not add money up. */}
              <SelectionTotal quote={quote.data} isLoading={quote.isPending} />

              <Separator />

              {instructions.isPending ? (
                <Text>Loading payment details…</Text>
              ) : bank?.available ? (
                <View style={{ gap: 4 }}>
                  <BankLine label="Bank" value={bank.bank.bank_name} />
                  <BankLine label="Account name" value={bank.bank.account_name} />
                  <BankLine label="Account number" value={bank.bank.account_number} />
                  {bank.bank.branch ? <BankLine label="Branch" value={bank.bank.branch} /> : null}
                  {bank.bank.routing_number ? (
                    <BankLine label="Routing" value={bank.bank.routing_number} />
                  ) : null}
                  {bank.bank.instructions ? (
                    <Text style={{ marginTop: 8 }}>{bank.bank.instructions}</Text>
                  ) : null}
                </View>
              ) : (
                // The association has not filled its bank details in. Saying so
                // is better than rendering an empty card that reads as a bug.
                <Text>
                  Your association has not published its bank details yet. Please contact the
                  office before transferring.
                </Text>
              )}
            </Card.Body>
          </Card>
        ) : null}

        {chosen.length > 0 ? (
          <Card>
            <Card.Body style={{ gap: 12 }}>
              <Text style={{ fontWeight: '700' }}>3. Attach your slip</Text>
              <Text style={{ opacity: 0.8 }}>
                A photo of the deposit slip or a screenshot of the transfer. Staff approve
                against this.
              </Text>

              {slips.map((slip, index) => (
                <View
                  key={slip.assetId ?? slip.uri}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}
                >
                  <Text style={{ flex: 1 }} numberOfLines={1}>
                    {slip.fileName ?? `Slip ${index + 1}`}
                  </Text>
                  <Pressable onPress={() => setSlips((s) => s.filter((_, i) => i !== index))}>
                    <Text style={{ textDecorationLine: 'underline' }}>Remove</Text>
                  </Pressable>
                </View>
              ))}

              {slips.length < 5 ? (
                <Button variant="secondary" onPress={addSlip}>
                  <Button.Label>
                    {slips.length === 0 ? 'Add slip' : 'Add another'}
                  </Button.Label>
                </Button>
              ) : null}
            </Card.Body>
          </Card>
        ) : null}

        {error ? (
          <View style={{ gap: 4 }}>
            <Text style={{ color: '#b3261e', fontWeight: '600' }}>{error.message}</Text>
            {error.isRetryable ? (
              <Text style={{ color: '#b3261e' }}>
                Tap Submit again — your payment will not be duplicated.
              </Text>
            ) : null}
          </View>
        ) : null}

        {chosen.length > 0 ? (
          <Button
            isDisabled={slips.length === 0 || createPayment.isPending}
            onPress={submit}
          >
            <Button.Label>
              {createPayment.isPending ? 'Submitting…' : 'Submit for approval'}
            </Button.Label>
          </Button>
        ) : null}

        {chosen.length > 0 && slips.length === 0 ? (
          <Text style={{ fontSize: 12, opacity: 0.7, textAlign: 'center' }}>
            Attach your bank slip to submit.
          </Text>
        ) : null}
      </StateView>
    </Screen>
  );
}

function SelectableDue({
  due,
  selected,
  onToggle,
}: {
  due: Due;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <Checkbox isSelected={selected} onSelectedChange={onToggle} />

        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontWeight: '600' }}>
            {due.fee_head} · {due.period}
          </Text>
          <MoneyRow
            instalment={due.instalment_amount}
            fine={due.fine_amount}
            total={due.total_due}
          />
        </View>
      </View>
    </Pressable>
  );
}

/**
 * The amount to transfer, straight from the server.
 *
 * An earlier version of this component summed `total_due` across the selected
 * rows on the device. That was a real violation of the rule in api/money.ts -
 * the app does not calculate money - and it would have meant Number()-ing
 * decimal strings into floats. The fix was a server endpoint (POST /fees/quote),
 * which is what that rule says to do when a screen needs a figure the API does
 * not yet return.
 *
 * Instalment and fine stay separate here too: the member sees what is
 * subscription and what is penalty, not one merged demand.
 */
function SelectionTotal({ quote, isLoading }: { quote?: Quote; isLoading: boolean }) {
  if (isLoading || !quote) {
    return <Text>Calculating…</Text>;
  }

  return (
    <MoneyRow
      instalment={quote.instalment_total}
      fine={quote.fine_total}
      total={quote.grand_total}
      emphasis
    />
  );
}

function BankLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ opacity: 0.7 }}>{label}</Text>
      <Text selectable style={{ fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}
