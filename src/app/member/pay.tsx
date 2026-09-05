import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useRef, useState } from 'react';
import { Alert as RNAlert, Platform, Pressable, View } from 'react-native';
import { ApiError } from '@/api/errors';
import {
  useDues,
  usePaymentInstructions,
  useQuote,
  type Due,
  type Quote,
} from '@/features/dues/queries';
import { startAttempt, useCreatePayment, useGatewaySession } from '@/features/payments/queries';
import {
  Actions,
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
 * Pay: choose instalments, then either pay online or transfer at the bank.
 *
 * TWO ROUTES, AND THE SECOND IS NOT A FALLBACK. Bank transfer is how most
 * members have always paid and how every member pays when an association has no
 * gateway; online payment is offered on top when there is one. So the screen
 * asks which, rather than hiding the bank behind a "having trouble?" link.
 *
 * The choice only appears when online payment is genuinely available — the
 * association switched it on, a gateway is configured, and the deployment is not
 * forcing the fake. The server answers all three as one question, because a
 * "Pay now" button whose only outcome is a refusal three screens later is worse
 * than no button.
 *
 * The steps are Sections rather than stacked cards - a numbered heading already
 * says "step", and wrapping each one in a box as well made a single task look
 * like three separate screens.
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
  const gatewaySession = useGatewaySession();

  const [selected, setSelected] = useState<number[]>([]);
  const [slips, setSlips] = useState<ImagePicker.ImagePickerAsset[]>([]);

  /*
   * Null until the member chooses, so the default can follow what is actually
   * available without an effect that writes state on render.
   */
  const [chosenMethod, setChosenMethod] = useState<'online' | 'manual' | null>(null);

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

  /**
   * Create the intent, then open the gateway's page.
   *
   * TWO CALLS, IN THIS ORDER, AND NEVER ONE. The payment row exists before the
   * member leaves the app, so a phone that dies on the hosted page leaves a
   * pending payment the reconciliation sweep can settle — rather than money
   * taken at the bank against no invoice at all, which is defect D-9 in the
   * legacy flow.
   *
   * WHAT HAPPENS IN THE BROWSER IS NOT THE ANSWER. Whether the member pays,
   * cancels, or force-quits, this ends on the payment's own screen, which asks
   * the server. The server asks the gateway. The app never decides that money
   * moved (ADR-0007).
   */
  const payOnline = () => {
    createPayment.mutate(
      {
        feeAssignIds: chosen.map((due) => due.fee_assign_id),
        documents: [],
        attemptKey: attemptKey.current,
        type: 'online',
      },
      {
        onSuccess: async (payment) => {
          attemptKey.current = startAttempt();
          setSelected([]);

          try {
            const session = await gatewaySession.mutateAsync(payment.id);

            if (Platform.OS === 'web') {
              // No auth-session on web; the tab navigates and comes back.
              await Linking.openURL(session.url);
            } else {
              /*
               * `openAuthSessionAsync` rather than `openBrowserAsync`: it closes
               * itself when the gateway returns to our scheme, so the member is
               * not left tapping Done on a finished payment page.
               */
              await WebBrowser.openAuthSessionAsync(session.url, 'bcsapprn://payment');
            }
          } catch {
            /*
             * Swallowed on purpose. The payment exists either way, and its own
             * screen is the honest place to find out what happened to it — an
             * alert here would be the app guessing.
             */
          }

          router.replace(`/member/payment/${payment.id}`);
        },
      },
    );
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
  const online = instructions.data?.online;
  const canPayOnline = online?.available === true;

  const method = chosenMethod ?? (canPayOnline ? 'online' : 'manual');
  const busy = createPayment.isPending || gatewaySession.isPending;

  const error =
    createPayment.error instanceof ApiError
      ? createPayment.error
      : gatewaySession.error instanceof ApiError
        ? gatewaySession.error
        : null;

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

        {chosen.length > 0 && canPayOnline ? (
          <Section title="2 · How would you like to pay?">
            {/* Server-computed. The app does not add money up. */}
            <SelectionTotal quote={quote.data} isLoading={quote.isPending} />

            <View style={{ marginTop: space.lg }}>
              <MethodChoice
                title={`Pay now with ${online?.label ?? 'card or mobile banking'}`}
                detail="You are taken to the bank's own page and back. Nothing to upload."
                selected={method === 'online'}
                onPress={() => setChosenMethod('online')}
                divider
              />
              <MethodChoice
                title="Transfer at the bank"
                detail="Send the money yourself, then attach the slip. Staff approve it."
                selected={method === 'manual'}
                onPress={() => setChosenMethod('manual')}
                divider={false}
              />
            </View>
          </Section>
        ) : null}

        {chosen.length > 0 && method === 'manual' ? (
          <Section title={canPayOnline ? '3 · Transfer this amount' : '2 · Transfer this amount'}>
            <View style={{ gap: space.lg }}>
              {/* Server-computed. The app does not add money up. */}
              {canPayOnline ? null : (
                <SelectionTotal quote={quote.data} isLoading={quote.isPending} />
              )}

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

        {chosen.length > 0 && method === 'manual' ? (
          <Section title={canPayOnline ? '4 · Attach your slip' : '3 · Attach your slip'}>
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
            <Actions>
              {method === 'online' ? (
                <Button isDisabled={busy} onPress={payOnline}>
                  <Button.Label>{busy ? 'Opening…' : 'Pay now'}</Button.Label>
                </Button>
              ) : (
                <Button isDisabled={slips.length === 0 || busy} onPress={submit}>
                  <Button.Label>{busy ? 'Submitting…' : 'Submit for approval'}</Button.Label>
                </Button>
              )}
            </Actions>

            {method === 'online' ? (
              <Text tone="muted" style={{ ...type.rowMeta, textAlign: 'center' }}>
                {/*
                  Said before they leave, because a member who returns to a
                  payment still marked pending otherwise assumes it failed and
                  pays a second time.
                */}
                You will return here when the bank is done. Your payment may take a moment to
                confirm afterwards.
              </Text>
            ) : slips.length === 0 ? (
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

/**
 * One of the two ways to pay.
 *
 * A `Row` with a checkbox, exactly like the instalment rows above it, rather
 * than two filled cards. `Panel` is the only filled surface the design system
 * allows and is deliberately rare - three of them on one screen is how this
 * screen went back to looking blocky the last time.
 *
 * The detail line is the part that actually decides it: "nothing to upload"
 * against "staff approve it" is the difference a member cares about, and it is
 * not inferable from the titles.
 */
function MethodChoice({
  title,
  detail,
  selected,
  onPress,
  divider,
}: {
  title: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
  divider: boolean;
}) {
  return (
    <Row
      title={title}
      meta={detail}
      leading={<Checkbox isSelected={selected} onSelectedChange={onPress} />}
      onPress={onPress}
      divider={divider}
    />
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
