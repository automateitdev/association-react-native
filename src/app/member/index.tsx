import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useRef, useState } from 'react';
import { Alert as RNAlert, Platform, Pressable, View } from 'react-native';
import { ApiError } from '@/api/errors';
import { formatMoney } from '@/api/money';
import { useSession } from '@/features/auth/session';
import {
  useDues,
  usePaymentInstructions,
  useQuote,
  useSummary,
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
  Inline,
  Panel,
  Row,
  Screen,
  ScreenHeader,
  Section,
  space,
  Stack,
  Stat,
  StatGrid,
  StateView,
  Text,
  type,
} from '@/ui';

/**
 * The member's one screen: what you owe, and paying it.
 *
 * THIS USED TO BE TWO. A Dues tab showed the outstanding total and a list of
 * periods with a "Pay now" button; a Pay tab then re-fetched the same dues and
 * listed the same periods again, with checkboxes. The second screen's first
 * step was the first screen's whole content, so a member read the same list
 * twice to pay one instalment - and the two could disagree, because they were
 * separate queries rendered from separate components.
 *
 * Now the list you read is the list you tick. Choosing an instalment IS the
 * first step of paying it, which is what it always was.
 *
 * What you owe, then how to pay it, then what you have paid since joining -
 * in that order, because the first is why the member opened the app and the
 * last is reassurance rather than a task.
 *
 * EITHER ROUTE MAY BE SHUT, AND NEITHER IS A FALLBACK FOR THE OTHER.
 *
 * Online needs the association to have switched it on, a gateway configured,
 * and a deployment not forcing the fake. Offline needs the association to
 * accept member-filed payments at all, and to have published an account to
 * send the money to. The server answers each as one question, because a button
 * whose only outcome is a refusal three screens later is worse than no button.
 *
 * OFFLINE USED TO BE ASSUMED OPEN - `method` fell back to 'manual' whenever
 * online was unavailable, so an association that takes nothing but counter
 * payments still showed its members a bank-transfer form and a Submit button
 * the server would refuse. Both routes are now asked about, and the screen has
 * a fourth state: neither, which says so instead of offering something.
 *
 * The choice between them only appears when BOTH are open. One open route is
 * not a decision, and dressing it as one asks a member to confirm something
 * they have no say in.
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
export default function MemberScreen() {
  const dues = useDues();
  const summary = useSummary();
  const { session } = useSession();
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
             * Not swallowed any more, and this is why.
             *
             * The first version caught this and said nothing, on the reasoning
             * that the payment exists either way and its own screen is the
             * honest place to find out. That was wrong: the payment screen said
             * "waiting for the bank to confirm" — about a payment the bank had
             * never been sent, because the session call failed. A member reads
             * that, waits, and eventually pays twice.
             *
             * The screen now distinguishes the two states through
             * `gateway_started` and offers a retry, so landing there is
             * informative rather than misleading. Nothing is needed here beyond
             * letting that happen.
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
  const canPayManual = bank?.available === true;
  const bothOpen = canPayOnline && canPayManual;

  /*
   * NEVER A ROUTE THAT IS SHUT, including one the member picked before the
   * instructions arrived. `chosenMethod` is only honoured while it names
   * something open, so a stale choice cannot survive an association turning a
   * route off between two screens.
   */
  const method: 'online' | 'manual' =
    chosenMethod && (chosenMethod === 'online' ? canPayOnline : canPayManual)
      ? chosenMethod
      : canPayOnline
        ? 'online'
        : 'manual';

  // Said once here rather than recomputed at each of the four places that
  // branch on it. Instructions still loading is NOT "no way to pay".
  const noRouteOpen = instructions.data !== undefined && !canPayOnline && !canPayManual;
  const busy = createPayment.isPending || gatewaySession.isPending;

  const error =
    createPayment.error instanceof ApiError
      ? createPayment.error
      : gatewaySession.error instanceof ApiError
        ? gatewaySession.error
        : null;

  const refresh = () => {
    dues.refetch();
    summary.refetch();
  };

  const all = dues.data?.data ?? [];

  return (
    <Screen
      width="reading"
      onRefresh={refresh}
      refreshing={dues.isRefetching || summary.isRefetching}
    >
      {/*
        The member's own name, not "Make a payment". They know what they came
        to do; what a header is for is confirming whose account they are
        looking at - which matters most to the member whose household shares a
        phone.
      */}
      <ScreenHeader
        title={session?.profile.name ?? 'Your account'}
        subtitle={
          session?.profile.membership_no ? `Membership ${session.profile.membership_no}` : undefined
        }
      />

      <StateView
        loading={dues.isPending}
        error={dues.error}
        empty={all.length === 0}
        emptyTitle="Nothing outstanding"
        emptyMessage="You have no unpaid instalments right now."
        onRetry={dues.refetch}
      >
        {dues.data ? (
          <Section title="Outstanding" first>
            {/*
              The figure the member opened the app for, on a surface of its own
              and above everything else.

              NO BUTTON IN IT ANY MORE. It used to carry "Pay now", which
              crossed to the other screen; paying now happens below, on this
              one. A button that scrolls you a little way down the page is
              worse than no button - it looks like it will do something.
            */}
            <View
              className="bg-accent-soft border border-accent"
              style={{ padding: space.lg, borderRadius: 12 }}
            >
              {/* Instalments and fines apart, and a server-computed total. */}
              <AmountBreakdown
                instalment={dues.data.meta.instalment_total}
                fine={dues.data.meta.fine_total}
                total={dues.data.meta.grand_total}
                align="left"
              />
            </View>
          </Section>
        ) : null}

        {/*
          ONE LIST, TICKABLE WHERE IT CAN BE.

          Every period is here, including the ones already submitted - a member
          needs to see that last month is waiting on staff, or they pay it
          again. Those rows carry "Awaiting approval" and no checkbox, because
          the row cannot be acted on and a disabled checkbox invites the tap
          anyway.

          The old Pay screen filtered them out entirely, which is how the two
          screens came to show different lists of the same thing.
        */}
        {/*
          Titled for what the member does here when there is something to do,
          and for what it shows when there is not. "Choose what to pay" above a
          list of rows that are all awaiting approval would be an instruction
          with no way to follow it.
        */}
        <Section
          step={payable.length > 0 ? 1 : undefined}
          title={payable.length > 0 ? 'Choose what to pay' : 'By period'}
        >
          {all.map((due, index) => (
            <DueRow
              key={due.fee_assign_id}
              due={due}
              selectable={due.status === 'Unpaid'}
              selected={selected.includes(due.fee_assign_id)}
              onToggle={() => toggle(due.fee_assign_id)}
              divider={index < all.length - 1}
            />
          ))}
        </Section>

        {chosen.length > 0 && bothOpen ? (
          <Section step={2} title="How would you like to pay?">
            {/* Server-computed. The app does not add money up. */}
            <SelectionTotal quote={quote.data} isLoading={quote.isPending} />

            <Stack gap="none">
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
            </Stack>
          </Section>
        ) : null}

        {chosen.length > 0 && method === 'manual' && canPayManual ? (
          <Section title={bothOpen ? '3 · Transfer this amount' : '2 · Transfer this amount'}>
            <Stack gap="lg">
              {/* Server-computed. The app does not add money up. */}
              {bothOpen ? null : <SelectionTotal quote={quote.data} isLoading={quote.isPending} />}

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
                    <Text style={type.body}>{bank.bank.instructions}</Text>
                  ) : null}
                </View>
              ) : (
                // Saying so is better than rendering an empty block that reads
                // as a bug. WHICH thing is missing decides the sentence: one of
                // these is something the office can give you, and the other is
                // an answer they have already given.
                <Panel>
                  <Text style={type.body}>
                    {bank?.reason === 'disabled'
                      ? 'Your association does not accept bank transfers filed here. Pay at the office instead.'
                      : 'Your association has not published its bank details yet. Please contact the office before transferring.'}
                  </Text>
                </Panel>
              )}
            </Stack>
          </Section>
        ) : null}

        {chosen.length > 0 && method === 'manual' && canPayManual ? (
          <Section title={bothOpen ? '4 · Attach your slip' : '3 · Attach your slip'}>
            <Text tone="muted" style={type.body}>
              A photo of the deposit slip or a screenshot of the transfer. Staff approve against
              this.
            </Text>

            <Stack gap="sm">
              {slips.map((slip, index) => (
                <Inline key={slip.assetId ?? slip.uri} gap="sm" justify="between">
                  <Text style={{ ...type.body, flex: 1 }} numberOfLines={1}>
                    {slip.fileName ?? `Slip ${index + 1}`}
                  </Text>
                  <Pressable onPress={() => setSlips((s) => s.filter((_, i) => i !== index))}>
                    <Text tone="danger" style={type.rowMeta}>
                      Remove
                    </Text>
                  </Pressable>
                </Inline>
              ))}

              {slips.length < 5 ? (
                <Button variant="secondary" onPress={addSlip}>
                  <Button.Label>{slips.length === 0 ? 'Add slip' : 'Add another'}</Button.Label>
                </Button>
              ) : null}
            </Stack>
          </Section>
        ) : null}

        {error ? (
          <Section>
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
                <Text style={type.body}>
                  Tap Submit again — your payment will not be duplicated.
                </Text>
              ) : null}
            </Panel>
          </Section>
        ) : null}

        {/*
          NEITHER ROUTE OPEN is a real state, not an error: an association that
          collects entirely at the counter is in it deliberately. So it is said
          plainly and no Submit is offered - a disabled button with no
          explanation reads as the app having failed.
        */}
        {chosen.length > 0 && noRouteOpen ? (
          <Section>
            <Panel>
              <Text style={type.rowTitle}>Payments are taken at the office</Text>
              <Text style={type.body}>
                Your association is not accepting payments through the app at the moment. Your
                instalments and any fines are still shown here, and staff can record a payment for
                you when you pay them directly.
              </Text>
            </Panel>
          </Section>
        ) : null}

        {chosen.length > 0 && !noRouteOpen ? (
          <Stack gap="sm">
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
          </Stack>
        ) : null}
      </StateView>

      {/*
        LAST, and outside the StateView on purpose: what a member has paid
        since joining is still worth seeing on a day they owe nothing, and the
        empty state above replaces everything inside it.
      */}
      {summary.data ? (
        <Section title="Since you joined">
          {/* Four figures, never collapsed into one "savings" number. */}
          <StatGrid>
            <Stat
              label="Instalments paid"
              value={String(summary.data.instalments_paid_count)}
              icon="check"
            />
            {/*
              `shares`, which is the same glyph the staff side uses for the
              same idea. This said `members` here and `fees` over there - one
              concept wearing a different face depending on who signed in.
            */}
            <Stat label="Shares held" value={String(summary.data.shares)} icon="shares" />
            <Stat
              label="Instalments"
              value={formatMoney(summary.data.instalments_paid_amount)}
              icon="pay"
            />
            <Stat label="Fines" value={formatMoney(summary.data.fines_paid_amount)} icon="fine" />
          </StatGrid>
        </Section>
      ) : null}
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
      // Selects, does not navigate. The checkbox already says what tapping does.
      chevron={false}
      divider={divider}
    />
  );
}

/**
 * A period, tickable when there is something to do about it.
 *
 * ONE COMPONENT WHERE THERE WERE TWO - a read-only `DueRow` on the dues screen
 * and a `SelectableDue` on the pay screen, showing the same record with
 * different furniture. They had already drifted: only one of them said an
 * instalment was late.
 *
 * A row that cannot be paid gets NO CHECKBOX rather than a disabled one. A
 * disabled control still invites the tap that it then refuses, and "awaiting
 * approval" is not a thing the member can act on at all.
 */
function DueRow({
  due,
  selectable,
  selected,
  onToggle,
  divider,
}: {
  due: Due;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
  divider: boolean;
}) {
  return (
    <Row
      title={`${due.fee_head} · ${due.period}`}
      leading={
        selectable ? <Checkbox isSelected={selected} onSelectedChange={onToggle} /> : undefined
      }
      trailing={
        <AmountBreakdown
          instalment={due.instalment_amount}
          fine={due.fine_amount}
          total={due.total_due}
        />
      }
      footer={
        /* `Requested` means a payment is already submitted and waiting on
           staff - the member must not be told to pay it twice. */
        due.status === 'Requested' ? (
          <StatusLine text="Awaiting approval" />
        ) : due.overdue_periods > 0 ? (
          <StatusLine
            text={`${due.overdue_periods} month${due.overdue_periods === 1 ? '' : 's'} late`}
            tone="danger"
          />
        ) : null
      }
      onPress={selectable ? onToggle : undefined}
      // Selects, does not navigate. The checkbox already says what tapping does.
      chevron={false}
      divider={divider}
    />
  );
}

/**
 * A status line rather than a chip.
 *
 * A filled pill beside a filled amount competed with it, and down a list of
 * periods the pills read as the most important thing on screen when the money
 * is. Text carries the same information without shouting.
 */
function StatusLine({ text, tone }: { text: string; tone?: 'danger' }) {
  return (
    <Text tone={tone === 'danger' ? 'danger' : 'muted'} style={type.rowMeta}>
      {text}
    </Text>
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
