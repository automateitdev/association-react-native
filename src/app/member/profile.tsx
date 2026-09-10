import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { request } from '@/api/client';
import { ApiError } from '@/api/errors';
import { useSession } from '@/features/auth/session';
import { DocumentsSection } from '@/features/DocumentsSection';
import { useDocumentImage, useDocuments } from '@/features/documents';
import {
  fieldLabel,
  useProfileUpdates,
  useRequestProfileUpdate,
  type ProfileUpdate,
} from '@/features/member/profile';
import {
  Actions,
  Button,
  Field,
  Form,
  InputField,
  Panel,
  PickerField,
  Screen,
  ScreenHeader,
  Section,
  space,
  Stack,
  StatusBadge,
  Text,
  type,
} from '@/ui';

/**
 * The member's own record, and the one way they can ask to change it.
 *
 * NOT AN EDIT SCREEN, and it must not read as one. Nothing here writes to the
 * member's record: it files a request the office decides on (FR-MEM-8). These
 * fields are how the association identifies somebody at the counter and how it
 * reaches them, so a member who could change their own mobile unilaterally
 * could change it to somebody else's and leave no trace of the old one.
 *
 * The wording carries that everywhere - "Ask the office to change", "waiting to
 * be reviewed" - because a member who believes they have already changed their
 * mobile will stop watching the old one.
 *
 * This screen used to say "contact your association office" while the endpoint
 * to do it from here already existed, tested, with a staff queue behind it. A
 * feature nobody can reach is not a feature.
 */
export default function ProfileScreen() {
  const { session, tenantSlug } = useSession();
  const updates = useProfileUpdates();

  const [asking, setAsking] = useState(false);

  /*
   * The association's NAME, not its slug. A member reading their own details
   * should see "Demo Association One", not "demo-one" - the slug is a routing
   * key we made up, and showing it here is the app leaking its own plumbing
   * into the one screen that is entirely about the member.
   *
   * Same lookup and cache as the sign-in screen; failure falls back to the slug
   * rather than showing an error, because the name is cosmetic here.
   */
  const association = useQuery({
    queryKey: ['tenant', 'name', tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: 60 * 60 * 1000,
    retry: false,
    queryFn: async () =>
      (
        await request<{ data: { slug: string; name: string } }>('/tenants/lookup', {
          query: { slug: String(tenantSlug) },
          skipTenant: true,
        })
      ).data,
  });

  const profile = session?.profile;
  const pending = updates.data?.data.find((u) => u.status === 'pending');

  // Everything but the pending one, which has its own panel above.
  const decided = (updates.data?.data ?? []).filter((u) => u.status !== 'pending');

  return (
    <Screen
      width="reading"
      onRefresh={() => void updates.refetch()}
      refreshing={updates.isRefetching}
    >
      <ScreenHeader title="Your details" />

      {pending ? <PendingRequest update={pending} /> : null}

      {profile ? (
        <MembershipCard
          profile={profile}
          association={association.data?.name ?? tenantSlug ?? ''}
          first={!pending}
        />
      ) : null}

      {/*
        SUBMIT, NOT REPLACE (FR-MEM-8).

        A member can send a document; it waits for the office to decide, and
        what the association holds is untouched until then. That ordering is the
        whole point - the photograph and the NID are how a member is identified
        at the counter, so a new one is a request, not a swap.
      */}
      <DocumentsSection owner={{ kind: 'me' }} editable mode="submit" title="Your documents" />

      {asking ? (
        <RequestForm
          fields={updates.data?.meta.editable_fields ?? []}
          current={profile?.editable ?? {}}
          onDone={() => setAsking(false)}
          onCancel={() => setAsking(false)}
        />
      ) : (
        <Section title="Changing your details">
          {pending ? (
            <Text tone="muted" style={type.body}>
              You already have a change waiting to be reviewed. You can ask for another once the
              office has decided on it.
            </Text>
          ) : (
            <Stack gap="md" align="start">
              {/*
                Says what happens next, not just what the button does. A member
                who thinks the change is immediate stops watching their old
                number.
              */}
              <Text tone="muted" style={type.body}>
                Ask the office to change what is on file. Nothing changes until they approve it, and
                you will see the decision here.
              </Text>

              <Button onPress={() => setAsking(true)}>
                <Button.Label>Ask for a change</Button.Label>
              </Button>
            </Stack>
          )}
        </Section>
      )}

      {decided.length > 0 ? (
        <Section title="Past requests">
          <Stack gap="md">
            {decided.map((update) => (
              <DecidedRequest key={update.id} update={update} />
            ))}
          </Stack>
        </Section>
      ) : null}
    </Screen>
  );
}

const MEMBER_STATUSES = ['active', 'inactive', 'suspended'] as const;

function isKnownStatus(value: string | undefined): value is (typeof MEMBER_STATUSES)[number] {
  return MEMBER_STATUSES.includes(value as (typeof MEMBER_STATUSES)[number]);
}

/**
 * The member's card: who they are, to this association.
 *
 * WHY A CARD AND NOT ROWS. These four facts - the association, the name, the
 * membership number and the photograph - are what a member is asked for at a
 * counter, and they are read together or not at all. As label-and-value rows
 * they were four lines among ten, indistinguishable from the mobile number.
 *
 * WHAT IT IS NOT. It carries no claim to be an identity document and no expiry,
 * because the association has not said it is one. It shows what the register
 * holds; it does not certify it.
 */
function MembershipCard({
  profile,
  association,
  first,
}: {
  profile: NonNullable<ReturnType<typeof useSession>['session']>['profile'];
  association: string;
  first: boolean;
}) {
  /*
   * The photograph the office holds, if it holds one. Shares a query key with
   * the documents section below, so this costs no extra request - and it is
   * enabled only once the list says the slot is filled, rather than firing a
   * request that 404s on every member who has not sent one.
   */
  const documents = useDocuments({ kind: 'me' });
  const hasPhoto = (documents.data ?? []).some((slot) => slot.slot === 'image' && slot.uploaded);
  const photo = useDocumentImage({ kind: 'me' }, 'image', hasPhoto);

  const initials = profile.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View style={{ marginTop: first ? space.lg : space.md }}>
      <View
        className="bg-surface border border-border"
        style={{ borderRadius: 16, overflow: 'hidden' }}
      >
        {/*
          The association's name across the top, in the accent. A card belongs
          to somebody: whose card this is matters as much as whose name is on
          it, and a member of two societies should be able to tell at a glance.
        */}
        <View
          className="bg-accent"
          style={{ paddingHorizontal: space.lg, paddingVertical: space.sm }}
        >
          <Text tone="inverse" style={type.section} numberOfLines={1}>
            {association.toUpperCase()}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: space.lg, padding: space.lg }}>
          {/*
            A photograph if there is one, initials if there is not - never an
            empty grey box, which reads as a picture that failed to load rather
            than one that was never sent.
          */}
          <View
            className="bg-background-secondary border border-border"
            style={{
              width: 76,
              height: 92,
              borderRadius: 10,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {photo.data ? (
              <Image
                source={{ uri: photo.data }}
                resizeMode="cover"
                style={{ width: '100%', height: '100%' }}
                accessibilityLabel={`Photograph of ${profile.name}`}
              />
            ) : (
              <Text tone="muted" style={{ ...type.rowTitle, fontSize: 22 }}>
                {initials || '—'}
              </Text>
            )}
          </View>

          <View style={{ flex: 1, justifyContent: 'center', gap: 2 }}>
            <Text style={{ ...type.rowTitle, fontSize: 18 }} numberOfLines={2}>
              {profile.name}
            </Text>

            {/*
              The membership number is the thing an officer asks for, so it is
              the second-loudest item here and not buried in a list.
            */}
            <Text tone="muted" style={type.rowMeta}>
              {profile.membership_no ? `Member no. ${profile.membership_no}` : 'No number yet'}
            </Text>

            {profile.mobile ? (
              <Text tone="muted" style={type.rowMeta}>
                {profile.mobile}
              </Text>
            ) : null}
          </View>

          {/*
            Narrowed rather than cast. `status` is a plain string on the wire,
            and a value this build does not know about should show nothing at
            all - a badge is a claim about standing, and guessing one is worse
            than leaving it off.
          */}
          {isKnownStatus(profile.status) ? <StatusBadge status={profile.status} /> : null}
        </View>

        {/*
          The footer carries what changes rather than what identifies: shares
          move, an email address moves, a name does not.
        */}
        <View
          className="bg-background-secondary border-t border-border"
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: space.lg,
            paddingVertical: space.sm,
          }}
        >
          <Text tone="muted" style={type.rowMeta}>
            Shares held {profile.shares ?? 0}
          </Text>

          <Text tone="muted" style={type.rowMeta} numberOfLines={1}>
            {profile.email ?? 'No email on file'}
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * The one request currently with the office.
 *
 * Shown at the top and in full: which fields, and what was asked for. A member
 * who cannot see what they requested cannot tell whether the office is sitting
 * on the right thing.
 */
function PendingRequest({ update }: { update: ProfileUpdate }) {
  return (
    <Section>
      <Panel>
        <Text style={type.rowTitle}>Waiting to be reviewed</Text>
        <Text tone="muted" style={type.rowMeta}>
          Asked {update.requested_at ?? 'recently'}. Nothing has changed yet.
        </Text>

        {Object.entries(update.changes).map(([field, value]) => (
          <Field key={field} label={fieldLabel(field)} value={value ?? '—'} />
        ))}
      </Panel>
    </Section>
  );
}

function DecidedRequest({ update }: { update: ProfileUpdate }) {
  const approved = update.status === 'approved';

  return (
    <Stack gap="xs">
      <Text style={type.rowTitle}>{approved ? 'Approved' : 'Not approved'}</Text>
      <Text tone="muted" style={type.rowMeta}>
        {Object.keys(update.changes).map(fieldLabel).join(', ')} · {update.decided_at ?? ''}
      </Text>

      {/*
        The reason, when there is one. A refusal without one leaves a member with
        nothing to act on and nothing to ask about.
      */}
      {update.decision_reason ? (
        <Text tone={approved ? 'muted' : 'danger'} style={type.body}>
          {update.decision_reason}
        </Text>
      ) : null}
    </Stack>
  );
}

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

/**
 * The thirteen editable fields, in four groups.
 *
 * WHY GROUP THEM AT ALL. Rendered as one list they are thirteen identical
 * boxes, and a member looking for "mobile" reads every label on the way down.
 * Grouping costs four headings and turns a scroll into a scan.
 *
 * ANYTHING THE SERVER SENDS THAT IS NOT LISTED STILL RENDERS, under "Other".
 * The field list comes from the API (`meta.editable_fields`), so a release that
 * makes a new field editable must not have it silently vanish here because this
 * map was not updated to match.
 */
type FieldGroup = { title: string; fields: string[]; stacked?: boolean };

const GROUPS: FieldGroup[] = [
  {
    title: 'Name and family',
    fields: ['name', 'father_name', 'mother_name', 'spouse_name'],
  },
  { title: 'Personal', fields: ['birth_date', 'gender', 'nid'] },
  { title: 'Contact', fields: ['mobile', 'email', 'emergency_contact'] },

  /*
   * ONE PER ROW, unlike the rest. An address is a long value, and two side by
   * side give each half the width of the thing it has to hold - so every line
   * wraps and the pair is harder to read than either would be alone.
   */
  {
    title: 'Addresses',
    fields: ['present_address', 'permanent_address', 'office_address'],
    stacked: true,
  },
];

function groupFields(fields: string[]): FieldGroup[] {
  const grouped = GROUPS.map((group) => ({
    ...group,
    fields: group.fields.filter((field) => fields.includes(field)),
  })).filter((group) => group.fields.length > 0);

  const placed = new Set(grouped.flatMap((group) => group.fields));
  const rest = fields.filter((field) => !placed.has(field));

  // Unknown fields stack: nothing here knows how long their values run.
  return rest.length > 0 ? [...grouped, { title: 'Other', fields: rest, stacked: true }] : grouped;
}

/**
 * The request form.
 *
 * PRE-FILLED WITH WHAT IS ON FILE, which is why `profile.editable` comes back
 * from the server at all. A blank form cannot tell a member whether the office
 * already holds their father's name or simply never asked for it, so they
 * retype what is already there and file a request that changes nothing.
 *
 * Only what differs is sent. The server filters again - it is the authority -
 * but sending everything would mean an officer opening a request to find one
 * changed field among thirteen unchanged ones.
 */
function RequestForm({
  fields,
  current,
  onDone,
  onCancel,
}: {
  fields: string[];
  current: Record<string, string | null>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const submit = useRequestProfileUpdate();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f, current[f] ?? ''])),
  );

  const changed = fields.filter((f) => values[f] !== (current[f] ?? ''));
  const error = submit.error instanceof ApiError ? submit.error : null;

  const send = () => {
    submit.mutate(Object.fromEntries(changed.map((f) => [f, values[f]])), {
      onSuccess: onDone,
    });
  };

  /** One field, whichever control it needs. Shared by both layouts. */
  const renderField = (field: string) =>
    field === 'gender' ? (
      /*
       * A PICKER, because gender is three values the server validates. As a
       * text box it invited typing something the API would refuse after the
       * member had filled in everything else.
       */
      <PickerField
        key={field}
        label={fieldLabel(field)}
        options={GENDERS}
        value={values[field] ?? ''}
        onChange={(value) => setValues((v) => ({ ...v, [field]: value }))}
        placeholder="Choose"
      />
    ) : (
      <InputField
        key={field}
        label={fieldLabel(field)}
        value={values[field] ?? ''}
        onChangeText={(value) => setValues((v) => ({ ...v, [field]: value }))}
        keyboardType={
          field === 'mobile' || field === 'emergency_contact'
            ? 'phone-pad'
            : field === 'email'
              ? 'email-address'
              : undefined
        }
        // A date with no stated shape is a support call. Said once, on the only
        // field whose format is not obvious.
        hint={field === 'birth_date' ? 'As 1990-04-23 - year, month, day.' : undefined}
      />
    );

  return (
    <Section title="Ask for a change" first>
      <Stack gap="lg">
        <Text tone="muted" style={type.body}>
          Change only what is wrong. The office reviews it before anything takes effect.
        </Text>

        {error ? (
          <Panel tone="danger">
            <Text style={type.body}>{error.message}</Text>
          </Panel>
        ) : null}

        {groupFields(fields).map((group) => (
          <Stack key={group.title} gap="sm">
            <Text tone="muted" style={type.section}>
              {group.title.toUpperCase()}
            </Text>

            {/*
              TWO COLUMNS WHERE THERE IS ROOM, one where there is not.

              FormRow flex-wraps on a basis, so this needs no breakpoint check:
              on a handset every field takes the full width, on a wider screen
              they pair up. Thirteen fields in a single column is right on a
              phone and a very long scroll on anything else.

              `maxWidth={null}`, so the form is as wide as everything else on
              the page. Form caps itself at 460 by default, which is right for a
              single column - a 760pt text input is unpleasant to fill - and
              wrong here: it left the fields huddled at 460 while the rows above
              them ran to 760, which reads as two pages stacked.

              The addresses stay one per row: they hold long values, and half a
              column means every line wraps.
            */}
            <Form maxWidth={null} columns={group.stacked ? 1 : 2}>
              {group.fields.map((field) => renderField(field))}
            </Form>
          </Stack>
        ))}
      </Stack>

      <Actions>
        <Button variant="secondary" onPress={onCancel}>
          <Button.Label>Cancel</Button.Label>
        </Button>

        {/*
          Disabled until something differs, and it says how many. "Send request"
          on an unchanged form files nothing and reads as a broken button.
        */}
        <Button isDisabled={changed.length === 0 || submit.isPending} onPress={send}>
          <Button.Label>
            {submit.isPending
              ? 'Sending…'
              : changed.length === 0
                ? 'Nothing changed yet'
                : `Send ${changed.length} change${changed.length === 1 ? '' : 's'}`}
          </Button.Label>
        </Button>
      </Actions>
    </Section>
  );
}
