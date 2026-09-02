import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/errors';
import { useSession } from '@/features/auth/session';
import { useFeeSetups, useLedgerOptions, useLedgers, useUpdateFeeSetup } from '@/features/staff/fees';
import {
  Button,
  Field,
  FieldError,
  Input,
  Label,
  Panel,
  PickerField,
  Screen,
  ScreenHeader,
  Section,
  StateView,
  Text,
  TextField,
  space,
  type,
} from '@/ui';

/**
 * Edit a fee head.
 *
 * TWO THINGS THIS SCREEN HAS TO SAY OUT LOUD
 *
 * 1. Changing the amount does not change what anyone already owes. Each
 *    assignment copies the amount at the moment it is made (FR-FEE-4), so an
 *    edit affects what is assigned NEXT. Staff reliably assume the opposite -
 *    that correcting a price corrects the outstanding balances - and acting on
 *    that assumption means quietly under- or over-billing every existing member.
 *
 * 2. "Monthly" and "buys shares" are missing from this form on purpose. The
 *    update endpoint does not validate them, so offering them would produce a
 *    form that accepts the change, reports success and discards it.
 */
export default function EditFeeSetupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const setupId = Number(id);

  const { can } = useSession();
  const setups = useFeeSetups();
  const ledgers = useLedgers();
  const update = useUpdateFeeSetup(setupId);

  const setup = setups.data?.find((s) => s.id === setupId);
  const options = useLedgerOptions(ledgers.data);
  const editable = can('fee-setups.edit');

  const [open, setOpen] = useState(false);
  const [feeHead, setFeeHead] = useState('');
  const [amount, setAmount] = useState('');
  const [ledgerId, setLedgerId] = useState<string | null>(null);
  const [fineLedgerId, setFineLedgerId] = useState<string | null>(null);

  const beginEdit = () => {
    if (!setup) return;
    setFeeHead(setup.fee_head);
    setAmount(setup.amount);
    setLedgerId(setup.ledger.id != null ? String(setup.ledger.id) : null);
    setFineLedgerId(setup.fine_ledger.id != null ? String(setup.fine_ledger.id) : null);
    setOpen(true);
  };

  const fieldErrors =
    update.error instanceof ApiError
      ? ((update.error.details ?? {}) as Record<string, string[]>)
      : {};

  const sameLedger = Boolean(ledgerId && ledgerId === fineLedgerId);

  const save = async () => {
    try {
      await update.mutateAsync({
        fee_head: feeHead.trim(),
        amount: amount.trim(),
        ledger_id: Number(ledgerId),
        fine_ledger_id: Number(fineLedgerId),
      });
      setOpen(false);
    } catch {
      // Surfaced inline.
    }
  };

  return (
    <Screen width="reading" onRefresh={() => void setups.refetch()} refreshing={setups.isRefetching}>
      <ScreenHeader
        title={setup?.fee_head ?? 'Fee head'}
        subtitle={
          setup
            ? [setup.monthly ? 'Monthly' : 'One-off', setup.is_active ? null : 'Deactivated']
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        action={
          <Button variant="tertiary" onPress={() => router.back()}>
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      <StateView
        loading={setups.isLoading}
        error={setups.error}
        empty={!setups.isLoading && !setup}
        emptyTitle="Not found"
        emptyMessage="That fee head no longer exists."
        onRetry={() => void setups.refetch()}
      >
        {setup ? (
          <>
            {open ? (
              <Section title="Edit" first>
                <Panel>
                  <TextField isInvalid={Boolean(fieldErrors.fee_head?.length)}>
                    <Label>Name</Label>
                    <Input value={feeHead} onChangeText={setFeeHead} />
                    {fieldErrors.fee_head?.length ? (
                      <FieldError isInvalid animation={false}>
                        {fieldErrors.fee_head[0]}
                      </FieldError>
                    ) : null}
                  </TextField>

                  <TextField isInvalid={Boolean(fieldErrors.amount?.length)}>
                    <Label>Amount</Label>
                    <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
                    {fieldErrors.amount?.length ? (
                      <FieldError isInvalid animation={false}>
                        {fieldErrors.amount[0]}
                      </FieldError>
                    ) : null}
                  </TextField>

                  {/*
                    The warning belongs here, next to the field it is about,
                    rather than in a banner at the top that is read once and then
                    scrolled past.
                  */}
                  <Text tone="muted" style={type.rowMeta}>
                    Changing the amount affects instalments assigned from now on.
                    Instalments already assigned keep the amount they were created
                    with.
                  </Text>

                  <PickerField
                    label="Instalment income"
                    value={ledgerId}
                    onChange={setLedgerId}
                    options={options}
                    error={fieldErrors.ledger_id?.[0]}
                  />

                  <PickerField
                    label="Fine income"
                    value={fineLedgerId}
                    onChange={setFineLedgerId}
                    options={options}
                    error={
                      sameLedger
                        ? 'Fine income must post to a different account from instalments.'
                        : fieldErrors.fine_ledger_id?.[0]
                    }
                  />

                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    <Button variant="secondary" style={{ flex: 1 }} onPress={() => setOpen(false)}>
                      <Button.Label>Cancel</Button.Label>
                    </Button>
                    <Button
                      style={{ flex: 1 }}
                      isDisabled={update.isPending || sameLedger || feeHead.trim().length === 0}
                      onPress={() => void save()}
                    >
                      <Button.Label>{update.isPending ? 'Saving…' : 'Save'}</Button.Label>
                    </Button>
                  </View>
                </Panel>
              </Section>
            ) : (
              <Section
                title="Fee head"
                first
                action={
                  editable ? (
                    <Button variant="tertiary" onPress={beginEdit}>
                      <Button.Label>Edit</Button.Label>
                    </Button>
                  ) : undefined
                }
              >
                <Field label="Amount" value={setup.amount} />
                <Field label="Charged" value={setup.monthly ? 'Every month' : 'One-off'} />
                <Field label="Buys shares" value={setup.is_share ? 'Yes' : 'No'} />
                <Field label="Instalment income" value={setup.ledger.name} />
                <Field label="Fine income" value={setup.fine_ledger.name} />
              </Section>
            )}

            {editable && !open ? (
              <Section title={setup.is_active ? 'Deactivate' : 'Reactivate'}>
                <Text tone="muted" style={{ ...type.body, marginBottom: space.md }}>
                  {setup.is_active
                    ? 'A deactivated fee head cannot be assigned again. Existing instalments are untouched — it is kept because they reference it, which is why there is no delete.'
                    : 'Reactivating lets this fee head be assigned to members again.'}
                </Text>

                <Button
                  variant={setup.is_active ? 'danger' : 'secondary'}
                  isDisabled={update.isPending}
                  onPress={() => void update.mutateAsync({ is_active: !setup.is_active })}
                >
                  <Button.Label>
                    {setup.is_active ? 'Deactivate fee head' : 'Reactivate fee head'}
                  </Button.Label>
                </Button>
              </Section>
            ) : null}
          </>
        ) : null}
      </StateView>
    </Screen>
  );
}
