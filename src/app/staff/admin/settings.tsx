import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/errors';
import { useSession } from '@/features/auth/session';
import {
  useSettings,
  useUpdateSettings,
  type Settings,
} from '@/features/staff/settings';
import {
  Button,
  Checkbox,
  Form,
  Divider,
  FormRow,
  FormField,
  Icon,
  Input,
  InputField,
  Panel,
  Screen,
  ScreenHeader,
  Section,
  StateView,
  Text,
  TextArea,
  space,
  type,
} from '@/ui';

/**
 * Association settings (FR-SET-1).
 *
 * WHY IT IS FOUR FORMS AND NOT ONE
 * Each section saves on its own. The API takes every field as `sometimes`, so a
 * screen that saved everything at once would have to send back values nobody
 * touched - and the fine rate is audited (FR-SET-3), meaning an untouched value
 * resubmitted is a change with somebody's name on it in the audit log. Saving
 * only what was edited keeps that record honest.
 *
 * It also matches how the settings are actually used: the fine rules are agreed
 * once by the committee, the bank details change when the account does, and the
 * gateway credentials are rotated on their own schedule.
 */
export default function SettingsScreen() {
  const { can } = useSession();
  const settings = useSettings();
  const editable = can('settings.edit');

  return (
    <Screen onRefresh={() => void settings.refetch()} refreshing={settings.isRefetching}>
      <ScreenHeader
        title="Settings"
        subtitle="How this association charges, collects and is paid"
        action={
          <Button size="sm" variant="tertiary" onPress={() => router.back()}>
            <Icon name="back" size={15} tone="muted" />
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      <StateView
        loading={settings.isLoading}
        error={settings.error}
        empty={false}
        onRetry={() => void settings.refetch()}
      >
        {settings.data ? (
          <>
            {! editable ? (
              <View style={{ marginTop: space.lg }}>
                <Panel>
                  <Text tone="muted" style={type.body}>
                    You can see these settings but not change them. Changing them needs the
                    settings.edit permission.
                  </Text>
                </Panel>
              </View>
            ) : null}

            <FineSection settings={settings.data} editable={editable} />
            <PaymentSection settings={settings.data} editable={editable} />
            <BankSection settings={settings.data} editable={editable} />
            <GatewaySection settings={settings.data} editable={editable} />
          </>
        ) : null}
      </StateView>
    </Screen>
  );
}

/**
 * A section that saves its own fields, with the error and the button.
 *
 * Extracted because four sections repeating the same submit-and-report dance
 * is where the inconsistencies creep in - one forgets to clear the error, one
 * leaves the button enabled while saving.
 */
function SavingSection({
  title,
  description,
  editable,
  pending,
  dirty,
  onSave,
  error,
  children,
  first,
}: {
  title: string;
  description?: string;
  editable: boolean;
  pending: boolean;
  dirty: boolean;
  onSave: () => void;
  error: string | null;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <>
      {/*
        A hairline above each group but the first.

        Three forms stacked with only their headings between them read as one
        long list of fields - the headings are small, muted and letterspaced on
        purpose, which makes them findable when scanning and invisible when
        reading. That is right for a section inside one form and wrong for the
        boundary between two separate ones, each with its own Save.

        A rule rather than three filled cards: Panel is the design system's rare
        surface, and three on a screen is how this page would go back to looking
        blocky.
      */}
      {first ? null : (
        <View style={{ marginTop: space.xl }}>
          <Divider />
        </View>
      )}

      <Section
        title={title}
        first={first}
        /*
          The Save button lives in the heading, not at the foot of the fields.
          Floating between two groups it was ambiguous - it looked as likely to
          belong to the group below as the one above - and on a long screen the
          button for the group you are editing was often off-screen.
        */
        action={
          editable ? (
            <Button size="sm" isDisabled={! dirty || pending} onPress={onSave}>
              <Button.Label>{pending ? 'Saving…' : 'Save'}</Button.Label>
            </Button>
          ) : undefined
        }
      >
        {description ? (
          <Text tone="muted" style={{ ...type.body, marginBottom: space.md }}>
            {description}
          </Text>
        ) : null}

        {error ? (
          <View style={{ marginBottom: space.md }}>
            <Panel tone="danger">
              <Text style={type.body}>{error}</Text>
            </Panel>
          </View>
        ) : null}

        {/*
          The Save button is in the heading above, and is disabled until
          something changed. A save that is always live invites re-submitting
          untouched values, and the fine rate is audited - an unchanged value
          saved again is a change with a name and a date on it.
        */}
        {/*
          `dense`: these are admin forms read on a desktop, not a payment tapped
          one-handed. See FormDensity in ui/Form.
        */}
        <Form dense>{children}</Form>
      </Section>
    </>
  );
}

function FineSection({ settings, editable }: { settings: Settings; editable: boolean }) {
  const update = useUpdateSettings();

  const [rate, setRate] = useState(settings.fine.rate);
  const [grace, setGrace] = useState(String(settings.fine.grace_days));
  const [threshold, setThreshold] = useState(String(settings.fine.suspension_threshold));
  const [error, setError] = useState<string | null>(null);

  // Re-sync when a refetch brings different values, so the form is not left
  // showing a stale figure somebody else has since changed.
  useEffect(() => {
    setRate(settings.fine.rate);
    setGrace(String(settings.fine.grace_days));
    setThreshold(String(settings.fine.suspension_threshold));
  }, [settings.fine.rate, settings.fine.grace_days, settings.fine.suspension_threshold]);

  const dirty =
    rate !== settings.fine.rate ||
    grace !== String(settings.fine.grace_days) ||
    threshold !== String(settings.fine.suspension_threshold);

  const save = async () => {
    setError(null);

    try {
      await update.mutateAsync({
        fine: {
          rate,
          grace_days: Number(grace),
          suspension_threshold: Number(threshold),
        },
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The fine settings could not be saved.');
    }
  };

  return (
    <SavingSection
      title="Fines"
      description="Changing the rate does not alter fines already accrued. Accrual recomputes from elapsed fine dates at whatever rate is current, so a member can be told exactly when a rate changed and by whom."
      editable={editable}
      pending={update.isPending}
      dirty={dirty}
      onSave={() => void save()}
      error={error}
      first
    >
      {/*
        Three short numbers, side by side. Each on its own full-width line
        turned "100, 0, 3" into a column of large boxes - which is most of why
        this screen read as heavy. Not the height of any one field, but how many
        lines it took to ask for very little.
      */}
      <FormRow>
      <InputField
        label="Fine per missed month"
        value={rate}
        onChangeText={setRate}
        keyboardType="phone-pad"
        hint="Charged once for each fine date that passes with the instalment unpaid."
      />

      <InputField
        label="Grace days"
        value={grace}
        onChangeText={setGrace}
        keyboardType="phone-pad"
        hint="Days after the due date before the first fine date falls."
      />

      <InputField
        label="Suspension threshold"
        value={threshold}
        onChangeText={setThreshold}
        keyboardType="phone-pad"
        hint="Unpaid instalments before a member is suspended."
      />
      </FormRow>
    </SavingSection>
  );
}

function PaymentSection({ settings, editable }: { settings: Settings; editable: boolean }) {
  const update = useUpdateSettings();

  const [ttl, setTtl] = useState(String(settings.payment.intent_ttl_minutes));
  const [online, setOnline] = useState(settings.payment.online_enabled);
  const [format, setFormat] = useState(settings.invoice.format);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTtl(String(settings.payment.intent_ttl_minutes));
    setOnline(settings.payment.online_enabled);
    setFormat(settings.invoice.format);
  }, [settings.payment.intent_ttl_minutes, settings.payment.online_enabled, settings.invoice.format]);

  const dirty =
    ttl !== String(settings.payment.intent_ttl_minutes) ||
    online !== settings.payment.online_enabled ||
    format !== settings.invoice.format;

  const save = async () => {
    setError(null);

    try {
      await update.mutateAsync({
        payment: { intent_ttl_minutes: Number(ttl), online_enabled: online },
        invoice: { format },
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The payment settings could not be saved.');
    }
  };

  return (
    <SavingSection
      title="Payments"
      editable={editable}
      pending={update.isPending}
      dirty={dirty}
      onSave={() => void save()}
      error={error}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Checkbox isSelected={online} onSelectedChange={setOnline} isDisabled={! editable} />
        <View style={{ flex: 1 }}>
          <Text style={type.body}>Accept online payments</Text>
          <Text tone="muted" style={type.rowMeta}>
            Turn off to take payment only at the counter. Members already mid-payment are
            unaffected.
          </Text>
        </View>
      </View>

      <FormRow>
      <InputField
        label="Payment window (minutes)"
        value={ttl}
        onChangeText={setTtl}
        keyboardType="phone-pad"
        hint="How long a started online payment stays valid before it expires."
      />

      <InputField
        label="Invoice number format"
        value={format}
        onChangeText={setFormat}
        autoCapitalize="none"
        hint="The pattern new invoice numbers follow."
      />
      </FormRow>
    </SavingSection>
  );
}

/**
 * Where members are told to send money.
 *
 * Every field is optional on the API, and blank is meaningful: an association
 * collecting only at the counter has no bank details to give.
 */
function BankSection({ settings, editable }: { settings: Settings; editable: boolean }) {
  const update = useUpdateSettings();

  const [form, setForm] = useState(() => ({
    account_name: settings.bank.account_name ?? '',
    account_number: settings.bank.account_number ?? '',
    bank_name: settings.bank.bank_name ?? '',
    branch: settings.bank.branch ?? '',
    routing_number: settings.bank.routing_number ?? '',
    instructions: settings.bank.instructions ?? '',
  }));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      account_name: settings.bank.account_name ?? '',
      account_number: settings.bank.account_number ?? '',
      bank_name: settings.bank.bank_name ?? '',
      branch: settings.bank.branch ?? '',
      routing_number: settings.bank.routing_number ?? '',
      instructions: settings.bank.instructions ?? '',
    });
  }, [settings.bank]);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const dirty =
    form.account_name !== (settings.bank.account_name ?? '') ||
    form.account_number !== (settings.bank.account_number ?? '') ||
    form.bank_name !== (settings.bank.bank_name ?? '') ||
    form.branch !== (settings.bank.branch ?? '') ||
    form.routing_number !== (settings.bank.routing_number ?? '') ||
    form.instructions !== (settings.bank.instructions ?? '');

  const save = async () => {
    setError(null);

    try {
      // Empty means "not set", which is a real answer for an association that
      // collects only at the counter - so blanks are sent as null, not skipped.
      await update.mutateAsync({
        bank: {
          account_name: form.account_name || null,
          account_number: form.account_number || null,
          bank_name: form.bank_name || null,
          branch: form.branch || null,
          routing_number: form.routing_number || null,
          instructions: form.instructions || null,
        },
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The bank details could not be saved.');
    }
  };

  return (
    <SavingSection
      title="Bank details"
      description="Shown to members as where to send a manual payment."
      editable={editable}
      pending={update.isPending}
      dirty={dirty}
      onSave={() => void save()}
      error={error}
    >
      <InputField label="Account name" value={form.account_name} onChangeText={set('account_name')} />
      <InputField
        label="Account number"
        value={form.account_number}
        onChangeText={set('account_number')}
        autoCapitalize="none"
      />
      {/*
        Bank and branch together. A label like "Branch" needs no hint, and a
        hint under every field is the other half of why this page felt like a
        wall.
      */}
      <FormRow>
        <InputField label="Bank" value={form.bank_name} onChangeText={set('bank_name')} />
        <InputField label="Branch" value={form.branch} onChangeText={set('branch')} />
      </FormRow>
      <InputField
        label="Routing number"
        value={form.routing_number}
        onChangeText={set('routing_number')}
        autoCapitalize="none"
      />

      <FormField
        label="Instructions"
        hint="Anything a member needs to know when paying in - a reference to quote, for instance."
      >
        <TextArea
          value={form.instructions}
          onChangeText={set('instructions')}
          numberOfLines={3}
        />
      </FormField>
    </SavingSection>
  );
}

/**
 * What the association may know about its payment gateway, which is not much
 * and deliberately so.
 *
 * There is no form here. Setting the credentials moved to whoever provisions
 * the association, because `ar_account` is where members' money lands and an
 * association admin holding `settings.edit` - granted for editing fine rates -
 * should not be able to point it somewhere else. Since credentials are never
 * readable, such a change would also have left almost nothing to compare
 * against.
 *
 * The screen says who to ask rather than showing a control that 404s.
 */
function GatewaySection({ settings, editable }: { settings: Settings; editable: boolean }) {
  const gateway = settings.gateway;

  return (
    <Section title="Payment gateway">
      <Panel tone={gateway.configured ? undefined : 'danger'}>
        <Text style={type.body}>
          {gateway.configured
            ? `Configured for ${gateway.provider.toUpperCase()}${
                gateway.ar_account_last4 ? `, account ending ${gateway.ar_account_last4}` : ''
              }. ${gateway.is_active ? 'Active.' : 'Not active.'}`
            : 'No gateway is configured, so online payment cannot be taken.'}
        </Text>

        <Text tone="muted" style={{ ...type.rowMeta, marginTop: 4 }}>
          Set by whoever registered this association, not from here. The account the money
          lands in is not something an association account can change - ask them to change
          it, and they can confirm the new account back to you.
        </Text>
      </Panel>

      {editable ? (
        <View style={{ marginTop: space.md }}>
          <Panel>
            <Text tone="muted" style={type.rowMeta}>
              {gateway.configured
                ? 'To stop taking online payments, turn off "Accept online payments" under Payments above. That leaves the gateway configured and stops collection immediately.'
                : 'Until a gateway is configured, members can still be recorded as paying at the counter.'}
            </Text>
          </Panel>
        </View>
      ) : null}
    </Section>
  );
}
