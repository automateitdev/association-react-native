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
import {
  AmountBreakdown,
  Button,
  Checkbox,
  Field,
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
 * Pay: choose instalments, transfer at the bank, upload the slip.
 *
 * With no gateway integrated this is the ONLY way a member can pay through the
 * app, so the screen has to carry the whole story: what is owed, where to send
 * it, and proof that they did. The three steps are Sections rather than stacked
 * cards - a numbered heading already says "step", and wrapping each one in a box
 * as well made a single task look like three separate screens.
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
    <Screen width="reading" onRefresh={dues.refetch} refreshing={dues.isRefetching}>
      <ScreenHeader title="Make a payment" />

      <StateView
        loading={dues.isPending}
        error={dues.error}
        empty={payable.length === 0}
        emptyTitle="Nothing to pay"
        emptyMessage="You have no unpaid instalments right now."
        onRetry={dues.refetch}
      >
        <Section title="1 · Choose instalments" first>
          {payable.map((due, index) => (
            <SelectableDue
              key={due.fee_assign_id}
              due={due}
              selected={selected.includes(due.fee_assign_id)}
              onToggle={() => toggle(due.fee_assign_id)}
              divider={index < payable.length - 1}
            />
          ))}
        </Section>

        {chosen.length > 0 ? (
          <Section title="2 · Transfer this amount">
            <View style={{ gap: space.lg }}>
              {/* Server-computed. The app does not add money up. */}
              <SelectionTotal quote={quote.data} isLoading={quote.isPending} />

              {instructions.isPending ? (
                <Text tone="muted" style={type.body}>
                  Loading payment details…
                </Text>
              ) : bank?.available ? (
                <View>
                  <Field label="Bank" value={bank.bank.bank_name} />
                  <Field label="Account name" value={bank.bank.account_name} />
                  <Field label="Account number" value={bank.bank.account_number} />
                  {bank.bank.branch ? <Field label="Branch" value={bank.bank.branch} /> : null}
                  {bank.bank.routing_number ? (
                    <Field label="Routing" value={bank.bank.routing_number} />
                  ) : null}
                  {bank.bank.instructions ? (
                    <Text style={{ ...type.body, marginTop: space.sm }}>
                      {bank.bank.instructions}
                    </Text>
                  ) : null}
                </View>
              ) : (
                // The association has not filled its bank details in. Saying so
                // is better than rendering an empty block that reads as a bug.
                <Panel>
                  <Text style={type.body}>
                    Your association has not published its bank details yet. Please contact the
                    office before transferring.
                  </Text>
                </Panel>
              )}
            </View>
          </Section>
        ) : null}

        {chosen.length > 0 ? (
          <Section title="3 · Attach your slip">
            <Text tone="muted" style={type.body}>
              A photo of the deposit slip or a screenshot of the transfer. Staff approve against
              this.
            </Text>

            <View style={{ marginTop: space.md, gap: space.sm }}>
              {slips.map((slip, index) => (
                <View
                  key={slip.assetId ?? slip.uri}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}
                >
                  <Text style={{ ...type.body, flex: 1 }} numberOfLines={1}>
                    {slip.fileName ?? `Slip ${index + 1}`}
                  </Text>
                  <Pressable onPress={() => setSlips((s) => s.filter((_, i) => i !== index))}>
                    <Text tone="danger" style={type.rowMeta}>
                      Remove
                    </Text>
                  </Pressable>
                </View>
              ))}

              {slips.length < 5 ? (
                <Button variant="secondary" onPress={addSlip}>
                  <Button.Label>{slips.length === 0 ? 'Add slip' : 'Add another'}</Button.Label>
                </Button>
              ) : null}
            </View>
          </Section>
        ) : null}

        {error ? (
          <View style={{ marginTop: space.lg }}>
            <Panel tone="danger">
              {/*
                `text-danger` rather than a hex value. The old version hard-coded
                #b3261e - a light-theme red sitting on a dark background in dark
                mode, and the one place on the screen that ignored the theme.
              */}
              <Text tone="danger" style={type.rowTitle}>
                {error.message}
              </Text>
              {error.isRetryable ? (
                <Text style={type.body}>Tap Submit again — your payment will not be duplicated.</Text>
              ) : null}
            </Panel>
          </View>
        ) : null}

        {chosen.length > 0 ? (
          <View style={{ marginTop: space.xl, gap: space.sm }}>
            <Button isDisabled={slips.length === 0 || createPayment.isPending} onPress={submit}>
              <Button.Label>
                {createPayment.isPending ? 'Submitting…' : 'Submit for approval'}
              </Button.Label>
            </Button>

            {slips.length === 0 ? (
              <Text tone="muted" style={{ ...type.rowMeta, textAlign: 'center' }}>
                Attach your bank slip to submit.
              </Text>
            ) : null}
          </View>
        ) : null}
      </StateView>
    </Screen>
  );
}

function SelectableDue({
  due,
  selected,
  onToggle,
  divider,
}: {
  due: Due;
  selected: boolean;
  onToggle: () => void;
  divider: boolean;
}) {
  return (
    <Row
      title={`${due.fee_head} · ${due.period}`}
      leading={<Checkbox isSelected={selected} onSelectedChange={onToggle} />}
      trailing={
        <AmountBreakdown
          instalment={due.instalment_amount}
          fine={due.fine_amount}
          total={due.total_due}
        />
      }
      onPress={onToggle}
      divider={divider}
    />
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
    return (
      <Text tone="muted" style={type.body}>
        Calculating…
      </Text>
    );
  }

  return (
    <AmountBreakdown
      instalment={quote.instalment_total}
      fine={quote.fine_total}
      total={quote.grand_total}
      align="left"
    />
  );
}
