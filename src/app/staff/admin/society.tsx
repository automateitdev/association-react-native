import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert as RNAlert, Image } from 'react-native';
import { ApiError } from '@/api/errors';
import {
  useRemoveSignature,
  useSaveSignatory,
  useSignatories,
  useSignatureImage,
  useUploadSignature,
} from '@/features/staff/printing';
import { useSettings, useUpdateSettings } from '@/features/staff/settings';
import {
  Button,
  Form,
  FormActions,
  Icon,
  Inline,
  InputField,
  Panel,
  Row,
  Screen,
  ScreenHeader,
  Section,
  Stack,
  StateView,
  Text,
  space,
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
              goes under the line, and the signature above it — a scan of a signature on white paper
              reproduces best.
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
                onError={setError}
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
  onError,
}: {
  role: string;
  label: string;
  name: string | null;
  hasSignature: boolean;
  onSave: (name: string) => void;
  onError: (message: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(name ?? '');

  const upload = useUploadSignature();
  const remove = useRemoveSignature();

  /*
   * Only while the row is open. A signature nobody is looking at is a picture
   * downloaded to render a line of text - the same reasoning as the document
   * previews.
   */
  const image = useSignatureImage(role, open && hasSignature);

  const busy = upload.isPending || remove.isPending;

  const pick = async () => {
    onError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      RNAlert.alert(
        'Photo access needed',
        'The app needs access to your photos so you can attach the signature.',
      );

      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      /*
       * Barely compressed, unlike an NID photograph. A signature is thin dark
       * strokes on white, which is exactly what JPEG artefacts destroy - and
       * this one is printed at 14mm on a document somebody keeps.
       */
      quality: 1,
      allowsMultipleSelection: false,
    });

    if (result.canceled) return;

    try {
      await upload.mutateAsync({ role, asset: result.assets[0] });

      // Opened afterwards, so the person sees what they filed rather than a row
      // that merely says it worked. An upside-down scan is caught here or on
      // forty printed certificates.
      setOpen(true);
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'That signature could not be uploaded.');
    }
  };

  const confirmRemove = () => {
    onError(null);

    RNAlert.alert(
      `Remove the ${label.toLowerCase()}'s signature?`,
      'The image is deleted. Certificates will print the name and the line, unsigned.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            remove.mutate(role, {
              onError: (e) =>
                onError(e instanceof ApiError ? e.message : 'That could not be removed.'),
            });

            setOpen(false);
          },
        },
      ],
    );
  };

  if (editing) {
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
              // An empty name clears the role AND its signature - the next
              // holder must not inherit the last one's.
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

  return (
    <Stack gap="xs">
      <Row
        title={label}
        meta={
          name
            ? `${name}${hasSignature ? ' · signature on file' : ' · no signature on file'}`
            : 'Nobody recorded'
        }
        trailing={
          <Inline gap="xs">
            {/*
              Uploading needs somebody to attach it to, and the server says so
              too - a signature belongs to a person, not to a role standing
              empty. So the button only appears once there is a name.
            */}
            {name ? (
              <Button size="sm" variant="tertiary" isDisabled={busy} onPress={() => void pick()}>
                <Icon name="add" size={15} tone="muted" />
                <Button.Label>
                  {upload.isPending ? 'Filing…' : hasSignature ? 'Replace' : 'Signature'}
                </Button.Label>
              </Button>
            ) : null}

            {hasSignature ? (
              <Button size="sm" variant="tertiary" onPress={() => setOpen((current) => !current)}>
                <Button.Label>{open ? 'Hide' : 'View'}</Button.Label>
              </Button>
            ) : null}

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
          </Inline>
        }
        divider={false}
      />

      {open && hasSignature ? (
        <Panel>
          <StateView
            loading={image.isLoading}
            error={image.error}
            onRetry={() => void image.refetch()}
          >
            {image.data ? (
              <Stack gap="sm" align="start">
                {/*
                  On a pale panel, because a signature is dark strokes on white
                  and the app's dark theme would otherwise show a white block
                  with the strokes lost inside it.
                */}
                <Image
                  source={{ uri: image.data }}
                  style={{
                    width: 220,
                    height: 80,
                    resizeMode: 'contain',
                    backgroundColor: '#fffdf7',
                    borderRadius: space.xs,
                  }}
                  accessibilityLabel={`${label}'s signature`}
                />

                <Button size="sm" variant="tertiary" isDisabled={busy} onPress={confirmRemove}>
                  <Icon name="close" size={15} tone="danger" />
                  <Button.Label>Remove</Button.Label>
                </Button>
              </Stack>
            ) : null}
          </StateView>
        </Panel>
      ) : null}
    </Stack>
  );
}
