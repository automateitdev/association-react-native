import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ApiError } from '@/api/errors';
import { useSaveSignatory, useSignatories } from '@/features/staff/printing';
import { useSettings, useUpdateSettings } from '@/features/staff/settings';
import {
  Button,
  Form,
  FormActions,
  InputField,
  Panel,
  Row,
  Screen,
  ScreenHeader,
  Section,
  Stack,
  StateView,
  Text,
  type,
} from '@/ui';

/**
 * Who the association is, and who signs for it.
 *
 * ONE SCREEN FOR BOTH because they are one subject: everything here appears on
 * a document the association hands to a member, and nothing here appears
 * anywhere else. The Admin hub used to carry a note saying neither was
 * editable - in a single sentence, which is the clue that they belong together.
 *
 * WHY IT MATTERS MORE THAN IT LOOKS. The legacy certificate and ID card blades
 * carry COCSOL's name, registration number, email, authorised capital and a
 * return address in Ibrahimpur as literals. On a platform serving several
 * associations, printing from those templates hands a member a card belonging
 * to somebody else - so every one of those is a setting, and every one starts
 * empty. A blank line is a question an association can answer; a plausible
 * wrong registration number is one nobody thinks to ask.
 */
export default function SocietyScreen() {
  const settings = useSettings();
  const update = useUpdateSettings();

  const signatories = useSignatories();
  const saveSignatory = useSaveSignatory();

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const society = settings.data?.society;

  const [form, setForm] = useState({
    name: '',
    registration_no: '',
    registered_on: '',
    address: '',
    email: '',
    website: '',
    authorised_capital: '',
    total_shares: '',
    share_value: '',
  });

  /*
   * Filled in once the settings arrive, not on every render: the form is the
   * edit in progress, and re-seeding it from the server would throw away what
   * somebody is typing the moment anything refetches.
   */
  useEffect(() => {
    if (!society) return;

    setForm({
      name: society.name ?? '',
      registration_no: society.registration_no ?? '',
      registered_on: society.registered_on ?? '',
      address: society.address ?? '',
      email: society.email ?? '',
      website: society.website ?? '',
      authorised_capital: society.authorised_capital ?? '',
      total_shares: society.total_shares ?? '',
      share_value: society.share_value ?? '',
    });
  }, [society]);

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChangeText: (value: string) => {
      setForm((current) => ({ ...current, [key]: value }));
      setSaved(false);
    },
  });

  return (
    <Screen width="reading">
      <ScreenHeader
        title="The association"
        subtitle="What appears on certificates and cards"
        action={
          <Button size="sm" variant="tertiary" onPress={() => router.back()}>
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      <StateView
        loading={settings.isLoading}
        error={settings.error}
        onRetry={() => void settings.refetch()}
      >
        {error ? (
          <Section first>
            <Panel tone="danger">
              <Text tone="danger" style={type.rowMeta}>
                {error}
              </Text>
            </Panel>
          </Section>
        ) : null}

        <Section title="Details" first={!error}>
          <Panel>
            <Text tone="muted" style={type.rowMeta}>
              These are printed on share certificates and ID cards. Left blank, the line is simply
              empty — which is better than a document carrying somebody else's registration number.
            </Text>
          </Panel>

          <Form maxWidth={null} dense columns={2}>
            <InputField label="Name" {...field('name')} placeholder="Full registered name" />
            <InputField label="Registration no." {...field('registration_no')} />
            <InputField
              label="Registered on"
              {...field('registered_on')}
              placeholder="YYYY-MM-DD"
            />
            <InputField label="Email" {...field('email')} keyboardType="email-address" />
            <InputField label="Website" {...field('website')} autoCapitalize="none" />
            <InputField label="Address" {...field('address')} />

            {/*
              The capital and the share value are a legal statement about the
              society, not a figure derived from what members have paid - which
              is why they are typed here rather than computed from the ledger.
            */}
            <InputField
              label="Authorised capital"
              {...field('authorised_capital')}
              keyboardType="decimal-pad"
            />
            <InputField
              label="Divided into (shares)"
              {...field('total_shares')}
              keyboardType="decimal-pad"
            />
            <InputField
              label="Value of one share"
              {...field('share_value')}
              keyboardType="decimal-pad"
            />

            <FormActions>
              {saved ? (
                <Text tone="muted" style={type.rowMeta}>
                  Saved.
                </Text>
              ) : null}

              <Button
                isDisabled={update.isPending}
                onPress={() => {
                  setError(null);

                  update.mutate(
                    {
                      society: {
                        name: form.name.trim() || null,
                        registration_no: form.registration_no.trim() || null,
                        registered_on: form.registered_on.trim() || null,
                        address: form.address.trim() || null,
                        email: form.email.trim() || null,
                        website: form.website.trim() || null,
                        authorised_capital: form.authorised_capital.trim() || null,
                        total_shares: form.total_shares.trim() || null,
                        share_value: form.share_value.trim() || null,
                      },
                    },
                    {
                      onSuccess: () => setSaved(true),
                      onError: (e) =>
                        setError(e instanceof ApiError ? e.message : 'That could not be saved.'),
                    },
                  );
                }}
              >
                <Button.Label>{update.isPending ? 'Saving…' : 'Save'}</Button.Label>
              </Button>
            </FormActions>
          </Form>
        </Section>

        <Section title="Signatories">
          {/*
            EVERY ROLE, FILLED OR NOT. "We have no secretary's signature on
            file" is the finding, and a list of only what exists cannot show it.
            In the legacy production data the answer is all three: its
            `signatures` table holds no rows at all, so no certificate that
            system ever produced has been signed.
          */}
          <Panel>
            <Text tone="muted" style={type.rowMeta}>
              A certificate prints the secretary on the left and the chairman on the right. The name
              goes under the line; the signature image is uploaded separately.
            </Text>
          </Panel>

          <Stack gap="sm">
            {(signatories.data ?? []).map((signatory) => (
              <SignatoryRow
                key={signatory.role}
                role={signatory.role}
                label={signatory.label}
                name={signatory.name}
                hasSignature={signatory.has_signature}
                onSave={(name) =>
                  saveSignatory.mutate(
                    { role: signatory.role, name },
                    {
                      onError: (e) =>
                        setError(e instanceof ApiError ? e.message : 'That could not be saved.'),
                    },
                  )
                }
              />
            ))}
          </Stack>

          {/*
            Uploading an image is not something this screen does yet, and saying
            so beats a button that opens a file picker leading nowhere. The API
            takes it - POST /staff/signatories/{role}/signature - so a
            certificate signed in ink and scanned once is a step away rather
            than a rebuild.
          */}
          <Text tone="muted" style={type.rowMeta}>
            Uploading the signature image is not on this screen yet. Until it is, certificates print
            the name and the line, and are signed by hand.
          </Text>
        </Section>
      </StateView>
    </Screen>
  );
}

function SignatoryRow({
  role,
  label,
  name,
  hasSignature,
  onSave,
}: {
  role: string;
  label: string;
  name: string | null;
  hasSignature: boolean;
  onSave: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name ?? '');

  if (!editing) {
    return (
      <Row
        title={label}
        meta={
          name
            ? `${name}${hasSignature ? ' · signature on file' : ' · no signature on file'}`
            : 'Nobody recorded'
        }
        trailing={
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => {
              setDraft(name ?? '');
              setEditing(true);
            }}
          >
            <Button.Label>{name ? 'Change' : 'Record'}</Button.Label>
          </Button>
        }
        divider={false}
      />
    );
  }

  return (
    <Form maxWidth={null} dense columns={1}>
      <InputField
        label={label}
        value={draft}
        onChangeText={setDraft}
        placeholder="Full name as it should be printed"
      />

      <FormActions>
        <Button variant="secondary" onPress={() => setEditing(false)}>
          <Button.Label>Cancel</Button.Label>
        </Button>

        <Button
          onPress={() => {
            // An empty name clears the role AND its signature - the next holder
            // must not inherit the last one's.
            onSave(draft.trim());
            setEditing(false);
          }}
        >
          <Button.Label>Save</Button.Label>
        </Button>
      </FormActions>
    </Form>
  );
}
