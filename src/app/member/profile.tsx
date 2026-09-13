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
  fieldValue,
  usePreferenceOptions,
  useProfileUpdates,
  useRequestProfileUpdate,
  type PreferenceOptions,
  type ProfileUpdate,
} from '@/features/member/profile';
import {
  Actions,
  Button,
  Disclosure,
  Divider,
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

  /*
   * WHETHER THERE IS A NOMINEE TO DOCUMENT AT ALL - one on file, or one being
   * asked for. The server accepts an attachment in either case, hanging it off
   * the pending request until there is a person to own it.
   */
  const nomineeRequested = Object.keys(pending?.changes ?? {}).some((field) =>
    field.startsWith('nominee_'),
  );

  const canSendNomineeDocuments = Boolean(profile?.nominee) || nomineeRequested;

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

      {/*
        THE NOMINEE'S, BESIDE THE MEMBER'S OWN - not buried in the form.

        They were inside the nominee section of the change form, which put them
        four levels down: Profile, Ask for a change, open the section, scroll
        past eleven fields. Worse, the form is REPLACED by the pending panel
        while a request is waiting - so the moment a member had named their
        nominee and most wanted to attach the NID, the slots were unreachable.

        Here they are next to "Your documents", which is where somebody looking
        for an upload looks, and they survive a pending request because they no
        longer live inside the thing that pending hides.
      */}
      {canSendNomineeDocuments ? (
        <DocumentsSection
          owner={{ kind: 'my-nominee' }}
          editable
          mode="submit"
          title="Your nominee's documents"
        />
      ) : null}

      {asking ? (
        <RequestForm
          fields={updates.data?.meta.editable_fields ?? []}
          current={profile?.editable ?? {}}
          // `null` rather than `{}`: no nominee on file and a nominee with
          // empty fields are different things to put in front of somebody.
          currentNominee={profile?.nominee ?? null}
          currentPreferences={profile?.preferences ?? {}}
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
          <Field key={field} label={fieldLabel(field)} value={fieldValue(value)} />
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
 * The editable fields, in groups that follow the legacy form's first tab.
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
  { title: 'Contact', fields: ['mobile', 'country_code', 'email', 'emergency_contact'] },

  /*
   * THE CADRE SERVICE RECORD, which is what makes somebody eligible for this
   * kind of association at all. The legacy form asks for all three on its
   * first tab under "BCS Batch & Cadre"; none of them could be corrected here
   * until the API started accepting them.
   *
   * `joining_date` is the date they joined the SERVICE - the association's own
   * join date is a different thing it records itself.
   */
  { title: 'Service record', fields: ['bcs_batch', 'cadre_id', 'joining_date'] },

  /*
   * THE REFERENCE - who vouched for this applicant. Legacy `ref_name`,
   * `ref_mobile`, `ref_memeber_id_no`.
   */
  {
    title: 'Introduced by',
    fields: ['introduced_by_name', 'introduced_by_mobile', 'introduced_by_member_id'],
  },

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

/**
 * The nominee's fields, in the legacy form's own order.
 *
 * NOT DRIVEN BY `editable_fields`, unlike the applicant's. That list names
 * columns on the member's record; the nominee is a different row, sent nested
 * and flattened to `nominee_*` by the server. So this is the one place the app
 * holds a field list of its own - and it is checked against the server's
 * answer at runtime by the `nominee` object on /me, which carries exactly the
 * permitted keys.
 */
/**
 * One project's six questions.
 *
 * THE SAME CONTROLS THE STAFF SCREEN USES, deliberately. A district is CHOSEN
 * from the 64 and a Dhaka area is TYPED, because the association's next site
 * will be somewhere nobody has listed yet - and the server splits the rule the
 * same way, so a form that asked differently would let a member submit
 * something the API refuses, or refuse something it would have taken.
 *
 * ONE DISTRICT, not several. The legacy allowed several through the same JSON
 * column it used for Dhaka areas, and in the production data nobody ever
 * picked more than one - so this asks the question people actually answered.
 */
function ProjectPanel({
  label,
  project,
  options,
  answer,
  onChange,
}: {
  label: string;
  project: string;
  options: PreferenceOptions;
  answer: Record<string, string>;
  onChange: (field: string, value: string) => void;
}) {
  const isDistrict = project === 'other_district';

  /*
   * Flattened with the division in the label. Two districts share a name with
   * a division of their own; a single select cannot show groups, so the
   * division rides along in the text rather than being lost.
   */
  const districtOptions = Object.entries(options.districts).flatMap(([division, names]) =>
    names.map((name) => ({ value: name, label: `${name} · ${division}` })),
  );

  return (
    <Stack gap="sm">
      <Text tone="muted" style={type.section}>
        {label.toUpperCase()}
      </Text>

      <Form maxWidth={null} columns={2}>
        {isDistrict ? (
          <PickerField
            label="District"
            value={answer.areas ?? ''}
            options={[{ value: '', label: 'No district chosen' }, ...districtOptions]}
            onChange={(value) => onChange('areas', value)}
          />
        ) : (
          <InputField
            label="Areas"
            value={answer.areas ?? ''}
            onChangeText={(value) => onChange('areas', value)}
            // Typed, separated by commas. Somebody who would take Uttara or
            // Mohammadpur is answering one question, not two.
            placeholder={options.dhaka_areas.slice(0, 3).join(', ')}
          />
        )}

        <InputField
          label="Flat size (sft)"
          value={answer.flat_size_sft ?? ''}
          onChangeText={(value) => onChange('flat_size_sft', value)}
          keyboardType="decimal-pad"
          placeholder="1800"
        />

        <PickerField
          label="Budget"
          value={answer.budget ?? ''}
          options={[
            { value: '', label: 'Not said' },
            ...Object.entries(options.budgets).map(([value, text]) => ({ value, label: text })),
          ]}
          onChange={(value) => onChange('budget', value)}
        />

        <PickerField
          label="Bank loan wanted"
          value={answer.loan_percentage ?? ''}
          options={[
            { value: '', label: 'Not said' },
            // 0 is "no loan" - an answer, and a different thing from silence.
            ...options.loan_percentages.map((percent) => ({
              value: String(percent),
              label: percent === 0 ? 'None' : `${percent}%`,
            })),
          ]}
          onChange={(value) => onChange('loan_percentage', value)}
        />

        <InputField
          label="Flats wanted"
          value={answer.flats_wanted ?? ''}
          onChangeText={(value) => onChange('flats_wanted', value)}
          keyboardType="decimal-pad"
          placeholder="1"
        />

        <InputField
          label="Told about it by"
          value={answer.introduced_by_name ?? ''}
          onChangeText={(value) => onChange('introduced_by_name', value)}
          placeholder="Name"
        />
      </Form>
    </Stack>
  );
}

/**
 * Fields the API wants as numbers, not strings.
 *
 * Everything in a form is text while somebody is typing it - "12" and "120"
 * pass through each other on the way to "1200" - so conversion happens once,
 * at the edge, rather than on every keystroke.
 */
const NUMERIC = new Set(['flat_size_sft', 'loan_percentage', 'flats_wanted']);

/** A value from the server, as a form field holds it. */
function stringify(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

/**
 * "Uttara, Mirpur" -> ["Uttara", "Mirpur"].
 *
 * Empties dropped, so a trailing comma while somebody is still typing does not
 * file an area called "".
 */
function splitAreas(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Where the member's own label reads wrong for somebody else's record. */
const NOMINEE_LABELS: Record<string, string> = {
  relation: 'Relationship to you',
  address: 'Permanent address',
  profession: 'Professional details',
};

const NOMINEE_FIELDS: FieldGroup[] = [
  { title: 'Who they are', fields: ['name', 'relation', 'father_name', 'mother_name'] },
  { title: 'Personal', fields: ['birth_date', 'gender', 'nid'] },
  { title: 'Contact', fields: ['mobile', 'country_code'] },
  // Long values, one per row - the same reason the member's addresses stack.
  { title: 'Address and work', fields: ['address', 'profession'], stacked: true },
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
  currentNominee,
  currentPreferences,
  onDone,
  onCancel,
}: {
  fields: string[];
  current: Record<string, string | null>;
  /** The nominee on file, or null when there is none yet. */
  currentNominee: Record<string, string | null> | null;
  /** Every project, answered or not, keyed by project. */
  currentPreferences: Record<string, Record<string, unknown>>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const submit = useRequestProfileUpdate();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f, current[f] ?? ''])),
  );

  /*
   * The nominee's fields, held apart from the member's.
   *
   * Separate state because they are a separate row - the request nests them
   * and the server flattens them to `nominee_*`. Keeping them in one map with
   * the member's would mean prefixing here and stripping there, in a form
   * whose whole job is to be legible.
   */
  const nomineeFields = NOMINEE_FIELDS.flatMap((group) => group.fields);
  const [nominee, setNominee] = useState<Record<string, string>>(() =>
    Object.fromEntries(nomineeFields.map((f) => [f, currentNominee?.[f] ?? ''])),
  );

  /*
   * THE HOUSING PREFERENCES, one map per project, held as strings.
   *
   * Everything in a form is text while somebody is typing it - "12" and "120"
   * pass through each other on the way to "1200". They are converted at the
   * edge, in `send`, which is the only place that knows what the API wants.
   *
   * `areas` is the exception and stays a list, because that is what it is: a
   * district is chosen from 64, and Dhaka areas are typed as a comma-separated
   * line. Both end up as an array.
   */
  const options = usePreferenceOptions();

  const [preferences, setPreferences] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(
      Object.entries(currentPreferences).map(([project, held]) => [
        project,
        {
          areas: ((held.areas as string[] | undefined) ?? []).join(', '),
          flat_size_sft: stringify(held.flat_size_sft),
          budget: stringify(held.budget),
          loan_percentage: stringify(held.loan_percentage),
          flats_wanted: stringify(held.flats_wanted),
          introduced_by_name: stringify(held.introduced_by_name),
        },
      ]),
    ),
  );

  /** What differs from what is on file, per project, ready to send. */
  const preferenceChanges = Object.entries(preferences).reduce<
    Record<string, Record<string, unknown>>
  >((out, [project, answer]) => {
    const held = currentPreferences[project] ?? {};
    const changedFields: Record<string, unknown> = {};

    for (const [field, value] of Object.entries(answer)) {
      if (field === 'areas') {
        const next = splitAreas(value);
        const before = ((held.areas as string[] | undefined) ?? []).slice();

        // Order is not an answer - the server compares these as sets too.
        if (next.slice().sort().join('\u0000') !== before.sort().join('\u0000')) {
          changedFields.areas = next;
        }

        continue;
      }

      if (value !== stringify(held[field])) {
        changedFields[field] = value === '' ? null : NUMERIC.has(field) ? Number(value) : value;
      }
    }

    if (Object.keys(changedFields).length > 0) out[project] = changedFields;

    return out;
  }, {});

  const preferencesChangedCount = Object.values(preferenceChanges).reduce(
    (n, fields) => n + Object.keys(fields).length,
    0,
  );

  const changed = fields.filter((f) => values[f] !== (current[f] ?? ''));
  const nomineeChanged = nomineeFields.filter((f) => nominee[f] !== (currentNominee?.[f] ?? ''));

  /*
   * How many projects already carry an answer, for the collapsed header.
   *
   * "2 of 3 answered" is what makes a shut section still worth reading - the
   * alternative is opening it to find out whether there is anything in there,
   * which is the wall of fields again with an extra tap in front of it.
   */
  const answeredProjects = Object.values(currentPreferences).filter((held) =>
    Object.entries(held).some(([field, value]) =>
      field === 'areas'
        ? ((value as string[] | undefined) ?? []).length > 0
        : value !== null && value !== undefined && value !== '',
    ),
  ).length;

  const total = changed.length + nomineeChanged.length + preferencesChangedCount;
  const error = submit.error instanceof ApiError ? submit.error : null;

  /*
   * A NOMINEE BEING ADDED NEEDS A NAME, and the button says so rather than
   * letting the server say it.
   *
   * `nominees.name` is NOT NULL, so the API refuses this - but a member who
   * has filled in a relation and a mobile and pressed Send has done the work
   * before being told. Only when there is no nominee yet: correcting one field
   * of an existing nominee is not naming anybody again.
   */
  const addingNominee = !currentNominee && nomineeChanged.length > 0;
  const missingNomineeName = addingNominee && nominee.name?.trim() === '';

  const send = () => {
    submit.mutate(
      {
        ...Object.fromEntries(changed.map((f) => [f, values[f]])),
        ...(nomineeChanged.length > 0
          ? { nominee: Object.fromEntries(nomineeChanged.map((f) => [f, nominee[f]])) }
          : {}),
        ...(preferencesChangedCount > 0 ? { preferences: preferenceChanges } : {}),
      },
      { onSuccess: onDone },
    );
  };

  /**
   * One field, whichever control it needs.
   *
   * Takes its own value map, so the member's fields and the nominee's share
   * one renderer instead of two that drift. `gender` is a picker on both
   * sides; `birth_date` carries its format hint on both.
   */
  const renderField = (
    field: string,
    read: Record<string, string> = values,
    write: (f: string, v: string) => void = (f, v) =>
      setValues((current) => ({ ...current, [f]: v })),
    /*
     * The nominee's fields are unprefixed here - they are sent nested - so
     * `fieldLabel` gives them the member's own labels. Two of them read wrong
     * that way: "Relation" answers nothing without saying to WHOM, and the
     * server's own label for the prefixed key ("Nominee's relationship to
     * you") is redundant under a heading that already says whose section this
     * is.
     */
    labels: Record<string, string> = {},
  ) =>
    field === 'gender' ? (
      /*
       * A PICKER, because gender is three values the server validates. As a
       * text box it invited typing something the API would refuse after the
       * member had filled in everything else.
       */
      <PickerField
        key={field}
        label={labels[field] ?? fieldLabel(field)}
        options={GENDERS}
        value={read[field] ?? ''}
        onChange={(value) => write(field, value)}
        placeholder="Choose"
      />
    ) : (
      <InputField
        key={field}
        label={labels[field] ?? fieldLabel(field)}
        value={read[field] ?? ''}
        onChangeText={(value) => write(field, value)}
        keyboardType={
          field === 'mobile' || field === 'emergency_contact' || field === 'introduced_by_mobile'
            ? 'phone-pad'
            : field === 'email'
              ? 'email-address'
              : field === 'cadre_id' || field === 'introduced_by_member_id'
                ? // `phone-pad` rather than `number-pad`, which InputField's
                  // union does not carry. Both give a digits keypad; this is
                  // the one the design system actually offers.
                  'phone-pad'
                : undefined
        }
        // A date with no stated shape is a support call. Said once per field
        // whose format is not obvious - and the two-letter country code, which
        // the server validates and nothing on screen would otherwise explain.
        hint={
          field === 'birth_date' || field === 'joining_date'
            ? 'As 1990-04-23 - year, month, day.'
            : field === 'country_code'
              ? 'Two letters, as BD or GB.'
              : undefined
        }
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

        <Disclosure
          title="Your details"
          defaultOpen
          highlighted={changed.length > 0}
          meta={
            changed.length > 0
              ? `${changed.length} changed`
              : `${fields.length} field${fields.length === 1 ? '' : 's'}`
          }
        >
          <Stack gap="lg">
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
        </Disclosure>

        {/*
          THE NOMINEE, the legacy form's second tab.

          Its own section because it is somebody ELSE's details in a form about
          you - and the fields repeat ("Name", "Father's name", "NID") exactly
          the ones above. Collapsed, a member scrolling cannot confuse whose
          name they are looking at; the heading says whose it is.

          It goes in the same request: one pending row carries both halves and
          the office decides them together, as the legacy does.
        */}
        <Disclosure
          title={currentNominee ? 'Your nominee' : 'Add a nominee'}
          highlighted={nomineeChanged.length > 0}
          meta={
            nomineeChanged.length > 0
              ? `${nomineeChanged.length} changed`
              : currentNominee
                ? (currentNominee.name ?? 'On file')
                : 'Not named yet'
          }
        >
          <Stack gap="lg">
            <Text tone="muted" style={type.body}>
              {currentNominee
                ? 'The person your association would contact about your membership. Change only what is wrong.'
                : 'The person your association would contact about your membership. You have not named one yet.'}
            </Text>

            {NOMINEE_FIELDS.map((group) => (
              <Stack key={group.title} gap="sm">
                <Text tone="muted" style={type.section}>
                  {group.title.toUpperCase()}
                </Text>

                <Form maxWidth={null} columns={group.stacked ? 1 : 2}>
                  {group.fields.map((field) =>
                    renderField(
                      field,
                      nominee,
                      (f, v) => setNominee((current) => ({ ...current, [f]: v })),
                      NOMINEE_LABELS,
                    ),
                  )}
                </Form>
              </Stack>
            ))}

            {missingNomineeName ? (
              <Text tone="danger" style={type.rowMeta}>
                A nominee needs a name.
              </Text>
            ) : null}

            {/*
              THEIR DOCUMENTS, IN THE SECTION THAT NAMES THEM - the legacy
              form uploads the nominee's photograph and NID on the same tab.

              ONLY ONCE THERE IS A NOMINEE ON FILE, and that is not the same
              as a name typed above: the nominee row is created when the
              office approves this request, so a member who filled in the name
              and attached an NID in one sitting would be attaching it to
              nothing. The server refuses with NO_NOMINEE until then, and it
              is right to - a file has to belong to somebody. Saying so beats
              four Send buttons that all answer "name them first".
            */}
            {/*
              SHOWN ONCE THERE IS A NOMINEE *OR* A REQUEST NAMING ONE.

              It used to be the first alone, and told the member to come back
              after approval - two visits for what the legacy does in one
              submission, and the second visit is the one nobody makes. The
              server now hangs a submission off the pending request when there
              is nobody to own it yet, and moves the files across when the
              office approves.

              Still not before the NAME IS SENT, though: a name typed in the
              box above is not a request, and there is nothing for the files
              to belong to until it is one. The line says which order, which
              is cheaper than four Send buttons that all answer the same way.
            */}
            {/*
              A POINTER, NOT A SECOND COPY OF THE SLOTS.

              Their documents are a section of their own further up, beside the
              member's. Rendering them here as well would be the same four Send
              buttons in two places on one screen, and a member who used the
              lower pair would have no idea the upper pair had changed.

              What is left is the ordering, which is the part that is not
              obvious: the files need a request to belong to, so the name goes
              first.
            */}
            <Text tone="muted" style={type.rowMeta}>
              {currentNominee
                ? `Their photograph and NID are under "Your nominee's documents" above.`
                : 'Send their name first. Their photograph and NID can then be attached above, before the office decides.'}
            </Text>
          </Stack>
        </Disclosure>

        {/*
          MEMBER CHOICE - the legacy form's third tab.

          Three projects, each asked the same six questions. Its own section,
          and for the same reason as the nominee: the questions repeat across
          the three panels, so a member needs to know which project they are
          answering.

          Rendered only once the option lists arrive. A budget picker with no
          budgets in it is a control that looks broken, and these lists are
          what the answers have to come FROM - a member cannot usefully type a
          district.
        */}
        <Disclosure
          title="What you are looking for"
          highlighted={preferencesChangedCount > 0}
          meta={
            preferencesChangedCount > 0
              ? `${preferencesChangedCount} changed`
              : answeredProjects > 0
                ? `${answeredProjects} of 3 answered`
                : 'Not answered'
          }
        >
          <Stack gap="lg">
            <Text tone="muted" style={type.body}>
              The association runs projects in three places. Answer whichever apply - leaving one
              blank means you are not interested in it.
            </Text>

            {options.isPending ? (
              <Text tone="muted" style={type.body}>
                Loading the options…
              </Text>
            ) : options.data ? (
              Object.entries(options.data.projects).map(([project, label]) => (
                <ProjectPanel
                  key={project}
                  label={label}
                  project={project}
                  options={options.data}
                  answer={preferences[project] ?? {}}
                  onChange={(field, value) =>
                    setPreferences((current) => ({
                      ...current,
                      [project]: { ...(current[project] ?? {}), [field]: value },
                    }))
                  }
                />
              ))
            ) : (
              <Text tone="muted" style={type.body}>
                These options could not be loaded. You can still send the rest of the form.
              </Text>
            )}
          </Stack>
        </Disclosure>
      </Stack>

      <Actions>
        <Button variant="secondary" onPress={onCancel}>
          <Button.Label>Cancel</Button.Label>
        </Button>

        {/*
          Disabled until something differs, and it says how many. "Send request"
          on an unchanged form files nothing and reads as a broken button.
        */}
        <Button isDisabled={total === 0 || missingNomineeName || submit.isPending} onPress={send}>
          <Button.Label>
            {submit.isPending
              ? 'Sending…'
              : total === 0
                ? 'Nothing changed yet'
                : `Send ${total} change${total === 1 ? '' : 's'}`}
          </Button.Label>
        </Button>
      </Actions>
    </Section>
  );
}
