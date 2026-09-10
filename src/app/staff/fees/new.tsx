import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/errors';
import { useCreateFeeSetup, useLedgerOptions, useLedgers } from '@/features/staff/fees';
import {
  Actions,
  Button,
  Checkbox,
  Form,
  Inline,
  InputField,
  Panel,
  PickerField,
  Screen,
  ScreenHeader,
  Section,
  space,
  Stack,
  Text,
  type,
} from '@/ui';

/**
 * Add a fee head.
 *
 * THE TWO LEDGERS ARE THE POINT OF THIS SCREEN.
 * A fee head names where its instalment income posts and, separately, where its
 * fine income posts (FR-FEE-2). They must differ, and the server refuses
 * otherwise. The legacy system stamps the fine ledger from a config value, which
 * is why its fines and subscriptions are indistinguishable in the income
 * statement and why it could never serve a second association with a different
 * chart of accounts.
 *
 * So they are asked for together, in their own section, with the reason stated -
 * not buried as two dropdowns among ten fields.
 *
 * `monthly` and `is_share` are also asked here and NOWHERE ELSE: the update
 * endpoint does not validate them, so they cannot be changed afterwards through
 * this API. The screen says so rather than letting someone discover it.
 */
export default function NewFeeSetupScreen() {
  const create = useCreateFeeSetup();
  const ledgers = useLedgers();

  const [feeHead, setFeeHead] = useState('');
  const [amount, setAmount] = useState('');
  const [monthly, setMonthly] = useState(true);
  const [isShare, setIsShare] = useState(false);
  const [ledgerId, setLedgerId] = useState<string | null>(null);
  const [fineLedgerId, setFineLedgerId] = useState<string | null>(null);

  /*
   * '' is the association's rate, '0' is a head that never fines, anything
   * else is this head's own. Three states, because null and zero are
   * different answers - see FeeSetup.fine_rate.
   */
  const [fineRate, setFineRate] = useState('');

  const options = useLedgerOptions(ledgers.data);

  const fieldErrors =
    create.error instanceof ApiError
      ? ((create.error.details ?? {}) as Record<string, string[]>)
      : {};

  const sameLedger = Boolean(ledgerId && ledgerId === fineLedgerId);

  // A head that never fines produces no fine income, so it needs nowhere to
  // post it - asking would be asking where nothing goes.
  const neverFines = fineRate.trim() === '0';

  const canSubmit =
    feeHead.trim().length > 0 &&
    amount.trim().length > 0 &&
    ledgerId !== null &&
    (neverFines || (fineLedgerId !== null && !sameLedger));

  const submit = async () => {
    try {
      await create.mutateAsync({
        fee_head: feeHead.trim(),
        amount: amount.trim(),
        monthly,
        is_share: isShare,
        ledger_id: Number(ledgerId),
        fine_rate: fineRate.trim() === '' ? null : fineRate.trim(),
        ...(neverFines || fineLedgerId === null ? {} : { fine_ledger_id: Number(fineLedgerId) }),
      });

      router.replace('/staff/fees');
    } catch {
      // Surfaced inline.
    }
  };

  return (
    <Screen width="reading">
      <ScreenHeader
        title="Add fee head"
        action={
          <Button size="sm" variant="tertiary" onPress={() => router.back()}>
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      {create.isError && Object.keys(fieldErrors).length === 0 ? (
        <Section>
          <Panel tone="danger">
            <Text style={type.body}>
              {create.error instanceof ApiError
                ? create.error.message
                : 'The fee head could not be created.'}
            </Text>
          </Panel>
        </Section>
      ) : null}

      <Section title="What is charged" first>
        {/*
          InputField, not a hand-rolled TextField/Label/Input.
          
          These two were built by hand, outside any Form - which is the exact
          drift FormField's own docblock was written about: four screens, four
          answers, and labels that no longer match each other. It also meant the
          second field carried its own `marginTop` because there was no Form to
          own the gap, and neither field could pick up the density every other
          staff form now uses.
        */}
        <Form maxWidth={null} dense>
          <InputField
            label="Name"
            required
            value={feeHead}
            onChangeText={setFeeHead}
            placeholder="e.g. Monthly Subscription"
            error={fieldErrors.fee_head?.[0]}
          />

          <InputField
            label="Amount"
            required
            value={amount}
            onChangeText={setAmount}
            placeholder="1000.00"
            keyboardType="decimal-pad"
            error={fieldErrors.amount?.[0]}
          />
        </Form>

        {/*
          Both of these are create-only. Saying so here is cheaper than a support
          call when someone tries to convert a one-off into a monthly fee.
        */}
        <Stack gap="md">
          <Toggle
            selected={monthly}
            onToggle={() => setMonthly((v) => !v)}
            title="Charged every month"
            meta="A one-off fee is assigned to a single period instead."
          />

          <Toggle
            selected={isShare}
            onToggle={() => setIsShare((v) => !v)}
            title="Paying this buys shares"
            meta="Completed payments credit share capital to the member."
          />

          <Text tone="muted" style={type.rowMeta}>
            Neither of these can be changed after the fee head is created.
          </Text>
        </Stack>
      </Section>

      <Section title="Where the money posts">
        <Text tone="muted" style={type.body}>
          Instalments and fines are separate income. They must post to different accounts, so an
          income statement can tell subscription from penalty.
        </Text>

        {/* The gap belongs to Form, not to a marginTop on the second field. */}
        <Form maxWidth={null} dense>
          <PickerField
            label="Instalment income"
            required
            value={ledgerId}
            onChange={setLedgerId}
            options={options}
            placeholder={ledgers.isLoading ? 'Loading accounts…' : 'Choose an account'}
            isDisabled={ledgers.isLoading}
            error={fieldErrors.ledger_id?.[0]}
          />

          {/*
            WHETHER THIS HEAD FINES AT ALL, and how much.

            Left blank it charges whatever the association charges, which is
            what every fee head did before this field existed. Zero means it
            never fines - an admission fee, a building levy or a voluntary
            contribution should not accrue a monthly penalty, and the only way
            to stop one used to be switching fines off for everybody.
          */}
          <InputField
            label="Fine per overdue month"
            value={fineRate}
            onChangeText={setFineRate}
            keyboardType="decimal-pad"
            placeholder="The association’s usual rate"
            hint={
              neverFines
                ? 'This fee head will never charge a fine.'
                : fineRate.trim() === ''
                  ? 'Leave blank to use the association’s rate. Enter 0 for a fee head that never fines.'
                  : `Overdue instalments of this fee head are fined ${fineRate.trim()} a month.`
            }
            error={fieldErrors.fine_rate?.[0]}
          />

          {/*
            Hidden when the head never fines: there is no fine income to post,
            so asking where it goes is asking about nothing.
          */}
          {neverFines ? null : (
            <PickerField
              label="Fine income"
              required
              value={fineLedgerId}
              onChange={setFineLedgerId}
              options={options}
              placeholder={ledgers.isLoading ? 'Loading accounts…' : 'Choose a different account'}
              isDisabled={ledgers.isLoading}
              // Caught here as well as by the server, because the server's
              // message for `different:ledger_id` is not one anybody would
              // want to read.
              error={
                sameLedger
                  ? 'Fine income must post to a different account from instalments.'
                  : fieldErrors.fine_ledger_id?.[0]
              }
            />
          )}
        </Form>
      </Section>

      <Actions>
        <Button isDisabled={!canSubmit || create.isPending} onPress={() => void submit()}>
          <Button.Label>{create.isPending ? 'Creating…' : 'Create fee head'}</Button.Label>
        </Button>
      </Actions>
    </Screen>
  );
}

function Toggle({
  selected,
  onToggle,
  title,
  meta,
}: {
  selected: boolean;
  onToggle: () => void;
  title: string;
  meta: string;
}) {
  return (
    <Inline gap="md" align="start">
      <Checkbox isSelected={selected} onSelectedChange={onToggle} />
      <Stack gap="xs" grow>
        <Text style={type.rowTitle}>{title}</Text>
        <Text tone="muted" style={type.rowMeta}>
          {meta}
        </Text>
      </Stack>
    </Inline>
  );
}
