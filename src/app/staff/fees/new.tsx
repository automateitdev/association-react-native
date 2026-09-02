import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/errors';
import { useCreateFeeSetup, useLedgerOptions, useLedgers } from '@/features/staff/fees';
import {
  Actions,
  Button,
  Checkbox,
  FieldError,
  Input,
  Label,
  Panel,
  PickerField,
  Screen,
  ScreenHeader,
  Section,
  Text,
  TextField,
  space,
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

  const options = useLedgerOptions(ledgers.data);

  const fieldErrors =
    create.error instanceof ApiError
      ? ((create.error.details ?? {}) as Record<string, string[]>)
      : {};

  const sameLedger = Boolean(ledgerId && ledgerId === fineLedgerId);

  const canSubmit =
    feeHead.trim().length > 0 &&
    amount.trim().length > 0 &&
    ledgerId !== null &&
    fineLedgerId !== null &&
    !sameLedger;

  const submit = async () => {
    try {
      await create.mutateAsync({
        fee_head: feeHead.trim(),
        amount: amount.trim(),
        monthly,
        is_share: isShare,
        ledger_id: Number(ledgerId),
        fine_ledger_id: Number(fineLedgerId),
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
        <View style={{ marginTop: space.lg }}>
          <Panel tone="danger">
            <Text style={type.body}>
              {create.error instanceof ApiError
                ? create.error.message
                : 'The fee head could not be created.'}
            </Text>
          </Panel>
        </View>
      ) : null}

      <Section title="What is charged" first>
        <TextField isRequired isInvalid={Boolean(fieldErrors.fee_head?.length)}>
          <Label>Name</Label>
          <Input
            value={feeHead}
            onChangeText={setFeeHead}
            placeholder="e.g. Monthly Subscription"
          />
          {fieldErrors.fee_head?.length ? (
            <FieldError isInvalid animation={false}>
              {fieldErrors.fee_head[0]}
            </FieldError>
          ) : null}
        </TextField>

        <View style={{ marginTop: space.md }}>
          <TextField isRequired isInvalid={Boolean(fieldErrors.amount?.length)}>
            <Label>Amount</Label>
            <Input
              value={amount}
              onChangeText={setAmount}
              placeholder="1000.00"
              keyboardType="decimal-pad"
            />
            {fieldErrors.amount?.length ? (
              <FieldError isInvalid animation={false}>
                {fieldErrors.amount[0]}
              </FieldError>
            ) : null}
          </TextField>
        </View>

        {/*
          Both of these are create-only. Saying so here is cheaper than a support
          call when someone tries to convert a one-off into a monthly fee.
        */}
        <View style={{ marginTop: space.lg, gap: space.md }}>
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
        </View>
      </Section>

      <Section title="Where the money posts">
        <Text tone="muted" style={{ ...type.body, marginBottom: space.md }}>
          Instalments and fines are separate income. They must post to different
          accounts, so an income statement can tell subscription from penalty.
        </Text>

        <PickerField
          label="Instalment income"
          value={ledgerId}
          onChange={setLedgerId}
          options={options}
          placeholder={ledgers.isLoading ? 'Loading accounts…' : 'Choose an account'}
          isDisabled={ledgers.isLoading}
          error={fieldErrors.ledger_id?.[0]}
        />

        <View style={{ marginTop: space.md }}>
          <PickerField
            label="Fine income"
            value={fineLedgerId}
            onChange={setFineLedgerId}
            options={options}
            placeholder={ledgers.isLoading ? 'Loading accounts…' : 'Choose a different account'}
            isDisabled={ledgers.isLoading}
            // Caught here as well as by the server, because the server's message
            // for `different:ledger_id` is not one anybody would want to read.
            error={
              sameLedger
                ? 'Fine income must post to a different account from instalments.'
                : fieldErrors.fine_ledger_id?.[0]
            }
          />
        </View>
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
    <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
      <Checkbox isSelected={selected} onSelectedChange={onToggle} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.rowTitle}>{title}</Text>
        <Text tone="muted" style={type.rowMeta}>
          {meta}
        </Text>
      </View>
    </View>
  );
}
