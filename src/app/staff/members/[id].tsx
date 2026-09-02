import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/errors';
import { useSession } from '@/features/auth/session';
import {
  TRANSITIONS,
  useAssignAssociatorInfo,
  useMember,
  useTransitionMember,
  useUpdateMember,
  type AssociatorInfoFields,
  type MemberDetail,
  type MemberTransition,
  type UpdatableMemberFields,
} from '@/features/staff/members';
import {
  Button,
  Description,
  Field,
  Input,
  Label,
  Panel,
  Screen,
  ScreenHeader,
  Section,
  StateView,
  StatusBadge,
  Text,
  TextArea,
  TextField,
  space,
  type,
} from '@/ui';

/**
 * One member: their details, and the decisions staff can take about them.
 *
 * The screen is split the way the API is, and for the same reason. Editing a
 * member's address and suspending them are not two flavours of "save" - one is
 * a correction, the other is a decision the association will be asked to
 * justify later, recorded with actor, reason and IP. Presenting them as one
 * form would lose that distinction exactly where it matters.
 */
export default function MemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = Number(id);

  const { can } = useSession();
  const member = useMember(memberId);

  return (
    <Screen onRefresh={() => void member.refetch()} refreshing={member.isRefetching}>
      <ScreenHeader
        title={member.data?.name ?? 'Member'}
        subtitle={
          member.data
            ? [
                member.data.membership_no ? `No. ${member.data.membership_no}` : 'No number yet',
                member.data.mobile,
              ].join(' · ')
            : undefined
        }
        action={
          <Button variant="tertiary" onPress={() => router.back()}>
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      <StateView
        loading={member.isLoading}
        error={member.error}
        onRetry={() => void member.refetch()}
      >
        {member.data ? (
          <>
            <View style={{ flexDirection: 'row', marginTop: space.md, gap: space.sm }}>
              <StatusBadge status={member.data.status} />
            </View>

            <Transitions member={member.data} can={can} />
            <SocietyRecord member={member.data} editable={can('members.edit')} />
            <PersonalDetails member={member.data} editable={can('members.edit')} />
          </>
        ) : null}
      </StateView>
    </Screen>
  );
}

/**
 * The status decisions available from where this member currently stands.
 *
 * Driven by the TRANSITIONS map rather than a chain of conditions, so the
 * screen cannot offer a transition the server would refuse - and cannot quietly
 * fall out of step with the routes when one is added.
 */
function Transitions({
  member,
  can,
}: {
  member: MemberDetail;
  can: (permission: string) => boolean;
}) {
  const transition = useTransitionMember(member.id);
  const [pendingAction, setPendingAction] = useState<MemberTransition | null>(null);
  const [reason, setReason] = useState('');

  const available = (Object.keys(TRANSITIONS) as MemberTransition[]).filter(
    (key) => TRANSITIONS[key].from.includes(member.status) && can(TRANSITIONS[key].permission),
  );

  if (available.length === 0) return null;

  const config = pendingAction ? TRANSITIONS[pendingAction] : null;

  const submit = async () => {
    if (!pendingAction || !config) return;

    try {
      await transition.mutateAsync({
        transition: pendingAction,
        reason: config.reasonRequired ? reason.trim() : reason.trim() || undefined,
      });
      setPendingAction(null);
      setReason('');
    } catch {
      // Surfaced below.
    }
  };

  return (
    <Section title="Status">
      {transition.isError ? (
        <View style={{ marginBottom: space.md }}>
          <Panel tone="danger">
            <Text style={type.body}>That change could not be saved. Nothing was altered.</Text>
          </Panel>
        </View>
      ) : null}

      {config ? (
        <Panel>
          <Text style={type.rowTitle}>
            {config.label} {member.name}?
          </Text>

          <Text tone="muted" style={type.rowMeta}>
            {config.reasonRequired
              ? 'The reason is recorded against this member and is what the office will refer to if they ask.'
              : 'You can add a note. It is recorded against this member.'}
          </Text>

          {/*
            FR-FINE-6, stated where it matters. Staff reasonably assume restoring
            a member clears what accrued while they were out; it does not, and
            only a recorded fine adjustment ever will.
          */}
          {pendingAction === 'reinstate' ? (
            <Text style={type.rowTitle}>
              Reinstating does not clear fines accrued while suspended.
            </Text>
          ) : null}

          <TextArea
            value={reason}
            onChangeText={setReason}
            placeholder={config.reasonRequired ? 'Required' : 'Optional'}
          />

          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => {
                setPendingAction(null);
                setReason('');
              }}
            >
              <Button.Label>Cancel</Button.Label>
            </Button>

            <Button
              style={{ flex: 1 }}
              // Mirrors the server's required_if, so the approver is told before
              // the round trip rather than by a 422 afterwards.
              isDisabled={
                (config.reasonRequired && reason.trim().length === 0) || transition.isPending
              }
              onPress={() => void submit()}
            >
              <Button.Label>
                {transition.isPending ? 'Saving…' : `Confirm ${config.label.toLowerCase()}`}
              </Button.Label>
            </Button>
          </View>
        </Panel>
      ) : (
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          {available.map((key) => (
            <Button
              key={key}
              variant="secondary"
              style={{ flexGrow: 1 }}
              onPress={() => setPendingAction(key)}
            >
              <Button.Label>{TRANSITIONS[key].label}</Button.Label>
            </Button>
          ))}
        </View>
      )}
    </Section>
  );
}

/**
 * The society record: the membership number and what the office recorded with it.
 *
 * Separate from personal details because it is a different act by a different
 * person - the legacy system draws the same line, with its own screen and a
 * field labelled "Office use only".
 *
 * The number is TYPED, not generated. The association's register runs 01 to 317
 * across 315 live members, with gaps at 221 and 245 where numbers were retired.
 * A generator would either refuse to reproduce those gaps or quietly reissue a
 * retired number, and the register - not this system - is the authority.
 *
 * Share count is absent on purpose: it comes from share payments and is
 * recomputable from share history, so there is nowhere here to type it.
 */
function SocietyRecord({ member, editable }: { member: MemberDetail; editable: boolean }) {
  const assign = useAssignAssociatorInfo(member.id);
  const [open, setOpen] = useState(false);

  const [fields, setFields] = useState<AssociatorInfoFields>({
    membership_no: member.membership_no ?? '',
    join_date: member.join_date ?? '',
    share_no: member.share_no ?? '',
    company: member.company ?? '',
    designation: member.designation ?? '',
  });

  const set = (key: keyof AssociatorInfoFields) => (value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  const fieldErrors =
    assign.error instanceof ApiError
      ? ((assign.error.details ?? {}) as Record<string, string[]>)
      : {};

  if (!open) {
    return (
      <Section
        title="Society record"
        action={
          editable ? (
            <Button variant="tertiary" onPress={() => setOpen(true)}>
              <Button.Label>{member.membership_no ? 'Edit' : 'Assign number'}</Button.Label>
            </Button>
          ) : undefined
        }
      >
        {/*
          Say what is missing rather than showing a dash and leaving staff to
          wonder whether it failed to load. A member with no number cannot be
          quoted one on a receipt or an approval SMS.
        */}
        {!member.membership_no ? (
          <View style={{ marginBottom: space.md }}>
            <Panel>
              <Text style={type.rowTitle}>No membership number assigned yet</Text>
              <Text tone="muted" style={type.rowMeta}>
                The office assigns it, together with the approval date.
              </Text>
            </Panel>
          </View>
        ) : null}

        <Field label="Membership no." value={member.membership_no} />
        <Field label="Joined" value={member.join_date} />
        <Field label="Share no." value={member.share_no} />
        <Field label="Shares held" value={String(member.shares)} />
        <Field label="Employer" value={member.company} />
        <Field label="Designation" value={member.designation} />
      </Section>
    );
  }

  return (
    <Section title="Society record">
      <Panel>
        <Text tone="muted" style={type.rowMeta}>
          Office use. The number must be unique within this association.
        </Text>

        <FormField
          label="Membership no."
          value={fields.membership_no}
          onChangeText={set('membership_no')}
          errors={fieldErrors.membership_no}
        />
        <FormField
          label="Joined"
          hint="YYYY-MM-DD"
          value={fields.join_date ?? ''}
          onChangeText={set('join_date')}
          errors={fieldErrors.join_date}
        />
        <FormField
          label="Share no."
          value={fields.share_no ?? ''}
          onChangeText={set('share_no')}
          errors={fieldErrors.share_no}
        />
        <FormField label="Employer" value={fields.company ?? ''} onChangeText={set('company')} />
        <FormField
          label="Designation"
          value={fields.designation ?? ''}
          onChangeText={set('designation')}
        />

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button variant="secondary" style={{ flex: 1 }} onPress={() => setOpen(false)}>
            <Button.Label>Cancel</Button.Label>
          </Button>

          <Button
            style={{ flex: 1 }}
            isDisabled={assign.isPending || fields.membership_no.trim().length === 0}
            onPress={async () => {
              try {
                await assign.mutateAsync({
                  ...fields,
                  membership_no: fields.membership_no.trim(),
                  // Empty means "not recorded", not an empty date - the server
                  // would refuse '' as a date.
                  join_date: fields.join_date?.trim() ? fields.join_date.trim() : null,
                });
                setOpen(false);
              } catch {
                // Field errors are shown above.
              }
            }}
          >
            <Button.Label>{assign.isPending ? 'Saving…' : 'Save'}</Button.Label>
          </Button>
        </View>
      </Panel>
    </Section>
  );
}

/**
 * Personal details, split into what can be edited and what cannot.
 *
 * The detail response carries far more than the update endpoint validates
 * (gender, NID, birth date, batch, mother's name). Rendering those as inputs
 * would produce a form that accepts an edit, reports success, and silently
 * discards it - so they are shown as the record they are.
 */
function PersonalDetails({ member, editable }: { member: MemberDetail; editable: boolean }) {
  const update = useUpdateMember(member.id);
  const [open, setOpen] = useState(false);

  const [fields, setFields] = useState<UpdatableMemberFields>({
    name: member.name,
    mobile: member.mobile,
    email: member.email ?? '',
    father_name: member.father_name ?? '',
    present_address: member.present_address ?? '',
    permanent_address: member.permanent_address ?? '',
  });

  const set = (key: keyof UpdatableMemberFields) => (value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  if (open) {
    return (
      <Section title="Details">
        <Panel>
          {update.isError ? (
            <Text style={type.body}>Those changes were not saved. The member is unchanged.</Text>
          ) : null}

          <FormField label="Name" value={fields.name ?? ''} onChangeText={set('name')} />
          <FormField
            label="Mobile"
            value={fields.mobile ?? ''}
            onChangeText={set('mobile')}
            keyboardType="phone-pad"
          />
          <FormField
            label="Email"
            value={fields.email ?? ''}
            onChangeText={set('email')}
            keyboardType="email-address"
          />
          <FormField
            label="Father's name"
            value={fields.father_name ?? ''}
            onChangeText={set('father_name')}
          />
          <FormField
            label="Present address"
            value={fields.present_address ?? ''}
            onChangeText={set('present_address')}
          />
          <FormField
            label="Permanent address"
            value={fields.permanent_address ?? ''}
            onChangeText={set('permanent_address')}
          />

          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button variant="secondary" style={{ flex: 1 }} onPress={() => setOpen(false)}>
              <Button.Label>Cancel</Button.Label>
            </Button>

            <Button
              style={{ flex: 1 }}
              isDisabled={update.isPending || (fields.name ?? '').trim().length === 0}
              onPress={async () => {
                try {
                  await update.mutateAsync({
                    ...fields,
                    // An empty box means "no email", not the empty string - the
                    // column is nullable and unique, and '' would collide across
                    // every member left blank.
                    email: fields.email?.trim() ? fields.email.trim() : null,
                  });
                  setOpen(false);
                } catch {
                  // Surfaced above.
                }
              }}
            >
              <Button.Label>{update.isPending ? 'Saving…' : 'Save'}</Button.Label>
            </Button>
          </View>
        </Panel>
      </Section>
    );
  }

  return (
    <Section
      title="Details"
      action={
        editable ? (
          <Button variant="tertiary" onPress={() => setOpen(true)}>
            <Button.Label>Edit</Button.Label>
          </Button>
        ) : undefined
      }
    >
      <Field label="Email" value={member.email} />
      <Field label="Father's name" value={member.father_name} />
      <Field label="Mother's name" value={member.mother_name} />
      <Field label="Present address" value={member.present_address} />
      <Field label="Permanent address" value={member.permanent_address} />
      <Field label="BCS batch" value={member.bcs_batch} />
      <Field label="Date of birth" value={member.birth_date} />
      <Field label="Gender" value={member.gender} />
      <Field label="NID" value={member.nid} />

      {editable ? (
        <Text tone="muted" style={{ ...type.rowMeta, marginTop: space.sm }}>
          Batch, date of birth, gender and NID are set when the member is created and cannot be
          changed here.
        </Text>
      ) : null}
    </Section>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  keyboardType,
  hint,
  errors,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'phone-pad' | 'email-address';
  hint?: string;
  errors?: string[];
}) {
  return (
    <TextField isInvalid={Boolean(errors?.length)}>
      <Label>{label}</Label>
      <Input
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={hint}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      />
      {errors?.length ? <Description>{errors[0]}</Description> : null}
    </TextField>
  );
}
