import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/errors';
import { useSession } from '@/features/auth/session';
import {
  useSettings,
  useUpdateGateway,
  useUpdateSettings,
  type GatewayCredentials,
  type Settings,
} from '@/features/staff/settings';
import {
  Button,
  Checkbox,
  Form,
  FormActions,
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
    <Section title={title} first={first}>
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

      <Form>
        {children}

        {editable ? (
          <FormActions>
            {/*
              Disabled until something changed. A save button that is always
              live invites re-submitting untouched values, and the fine rate is
              audited - an unchanged value saved again is a change with a name
              and a date on it.
            */}
            <Button isDisabled={! dirty || pending} onPress={onSave}>
              <Button.Label>{pending ? 'Saving…' : 'Save'}</Button.Label>
            </Button>
          </FormActions>
        ) : null}
      </Form>
    </Section>
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
      <InputField label="Bank" value={form.bank_name} onChangeText={set('bank_name')} />
      <InputField label="Branch" value={form.branch} onChangeText={set('branch')} />
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
 * Gateway credentials. WRITE-ONLY, and the screen has to say so.
 *
 * The API never returns them, so the form starts empty every time even when a
 * gateway is configured. An empty form above the words "configured" reads as a
 * bug unless the reason is stated, which is what the panel is for.
 */
function GatewaySection({ settings, editable }: { settings: Settings; editable: boolean }) {
  const update = useUpdateGateway();
  const gateway = settings.gateway;

  const empty: GatewayCredentials = {
    api_base_url: '',
    redirect_base_url: '',
    username: '',
    password: '',
    ar_account: '',
    basic_auth: '',
    callback_username: '',
    callback_password: '',
  };

  const [form, setForm] = useState<GatewayCredentials>(empty);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (key: keyof GatewayCredentials) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const complete = (Object.keys(empty) as (keyof GatewayCredentials)[]).every((key) =>
    String(form[key] ?? '').trim() !== '',
  );

  const save = async () => {
    setError(null);
    setSaved(false);

    try {
      await update.mutateAsync(form);
      // Cleared immediately: there is no reason for a merchant password to sit
      // in component state one moment longer than the request needs it.
      setForm(empty);
      setEditing(false);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The gateway credentials could not be saved.');
    }
  };

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

        {/*
          The reason the form below is empty. Without this line, a screen that
          says "configured" above eight blank boxes looks broken.
        */}
        <Text tone="muted" style={{ ...type.rowMeta, marginTop: 4 }}>
          Credentials are never shown, not even to a superadmin. Changing any of them means
          entering the whole set again.
        </Text>
      </Panel>

      {saved ? (
        <View style={{ marginTop: space.md }}>
          <Panel>
            <Text style={type.body}>
              Gateway credentials saved. They are not shown back - the summary above is
              the confirmation.
            </Text>
          </Panel>
        </View>
      ) : null}

      {error ? (
        <View style={{ marginTop: space.md }}>
          <Panel tone="danger">
            <Text style={type.body}>{error}</Text>
          </Panel>
        </View>
      ) : null}

      {! editable ? null : editing ? (
        <View style={{ marginTop: space.md }}>
          <Form>
            <InputField
              label="API base URL"
              value={form.api_base_url}
              onChangeText={set('api_base_url')}
              autoCapitalize="none"
              required
            />
            <InputField
              label="Redirect base URL"
              value={form.redirect_base_url}
              onChangeText={set('redirect_base_url')}
              autoCapitalize="none"
              required
              hint="Where the gateway sends the member back to after paying."
            />
            <InputField
              label="Merchant username"
              value={form.username}
              onChangeText={set('username')}
              autoCapitalize="none"
              required
            />
            <InputField
              label="Merchant password"
              value={form.password}
              onChangeText={set('password')}
              secureTextEntry
              autoCapitalize="none"
              required
            />
            <InputField
              label="AR account"
              value={form.ar_account}
              onChangeText={set('ar_account')}
              autoCapitalize="none"
              required
            />
            <InputField
              label="Basic auth token"
              value={form.basic_auth}
              onChangeText={set('basic_auth')}
              secureTextEntry
              autoCapitalize="none"
              required
            />

            <InputField
              label="Callback username"
              value={form.callback_username}
              onChangeText={set('callback_username')}
              autoCapitalize="none"
              required
              hint="What the gateway sends us, so a real callback can be told from a guess."
            />
            <InputField
              label="Callback password"
              value={form.callback_password}
              onChangeText={set('callback_password')}
              secureTextEntry
              autoCapitalize="none"
              required
            />

            <FormActions>
              <Button
                variant="secondary"
                onPress={() => {
                  setForm(empty);
                  setEditing(false);
                  setError(null);
                }}
              >
                <Button.Label>Cancel</Button.Label>
              </Button>

              <Button isDisabled={! complete || update.isPending} onPress={() => void save()}>
                <Button.Label>
                  {update.isPending ? 'Saving…' : gateway.configured ? 'Replace credentials' : 'Save credentials'}
                </Button.Label>
              </Button>
            </FormActions>
          </Form>
        </View>
      ) : (
        <View style={{ marginTop: space.md, alignItems: 'flex-start' }}>
          <Button size="sm" variant="secondary" onPress={() => setEditing(true)}>
            <Icon name="settings" size={15} tone="muted" />
            <Button.Label>
              {gateway.configured ? 'Replace credentials' : 'Add credentials'}
            </Button.Label>
          </Button>
        </View>
      )}
    </Section>
  );
}
