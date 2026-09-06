import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { request } from '@/api/client';
import { ApiError } from '@/api/errors';
import { useSession } from '@/features/auth/session';
import {
  fieldLabel,
  useProfileUpdates,
  useRequestProfileUpdate,
  type ProfileUpdate,
} from '@/features/member/profile';
import {
  Button,
  Field,
  Form,
  InputField,
  Panel,
  Screen,
  ScreenHeader,
  Section,
  Text,
  space,
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

      <Section title="Membership" first={!pending}>
        <Field label="Name" value={profile?.name} />
        <Field label="Membership no." value={profile?.membership_no} />
        <Field
          label="Shares held"
          value={profile?.shares != null ? String(profile.shares) : null}
        />
        <Field label="Association" value={association.data?.name ?? tenantSlug} />
      </Section>

      <Section title="Contact">
        <Field label="Mobile" value={profile?.mobile} />
        <Field label="Email" value={profile?.email} />
      </Section>

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
            <>
              {/*
                Says what happens next, not just what the button does. A member
                who thinks the change is immediate stops watching their old
                number.
              */}
              <Text tone="muted" style={{ ...type.body, marginBottom: space.md }}>
                Ask the office to change what is on file. Nothing changes until they approve it,
                and you will see the decision here.
              </Text>

              <Button onPress={() => setAsking(true)}>
                <Button.Label>Ask for a change</Button.Label>
              </Button>
            </>
          )}
        </Section>
      )}

      {decided.length > 0 ? (
        <Section title="Past requests">
          {decided.map((update) => (
            <DecidedRequest key={update.id} update={update} />
          ))}
        </Section>
      ) : null}
    </Screen>
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
    <View style={{ marginTop: space.lg }}>
      <Panel>
        <Text style={type.rowTitle}>Waiting to be reviewed</Text>
        <Text tone="muted" style={{ ...type.rowMeta, marginBottom: space.sm }}>
          Asked {update.requested_at ?? 'recently'}. Nothing has changed yet.
        </Text>

        {Object.entries(update.changes).map(([field, value]) => (
          <Field key={field} label={fieldLabel(field)} value={value ?? '—'} />
        ))}
      </Panel>
    </View>
  );
}

function DecidedRequest({ update }: { update: ProfileUpdate }) {
  const approved = update.status === 'approved';

  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={type.rowTitle}>{approved ? 'Approved' : 'Not approved'}</Text>
      <Text tone="muted" style={type.rowMeta}>
        {Object.keys(update.changes).map(fieldLabel).join(', ')} · {update.decided_at ?? ''}
      </Text>

      {/*
        The reason, when there is one. A refusal without one leaves a member with
        nothing to act on and nothing to ask about.
      */}
      {update.decision_reason ? (
        <Text tone={approved ? 'muted' : 'danger'} style={{ ...type.body, marginTop: 2 }}>
          {update.decision_reason}
        </Text>
      ) : null}
    </View>
  );
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
    submit.mutate(Object.fromEntries(changed.map((f) => [f, values[f]])), { onSuccess: onDone });
  };

  return (
    <Section title="Ask for a change" first>
      <Text tone="muted" style={{ ...type.body, marginBottom: space.md }}>
        Change only what is wrong. The office reviews it before anything takes effect.
      </Text>

      {error ? (
        <View style={{ marginBottom: space.md }}>
          <Panel tone="danger">
            <Text style={type.body}>{error.message}</Text>
          </Panel>
        </View>
      ) : null}

      <Form>
        {fields.map((field) => (
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
          />
        ))}
      </Form>

      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
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
      </View>
    </Section>
  );
}
