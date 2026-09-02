import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
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
import { ApiError } from '@/api/errors';
import {
  Button,
  Card,
  Description,
  Input,
  Label,
  Screen,
  StateView,
  StatusBadge,
  Text,
  TextArea,
  TextField,
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
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Button variant="tertiary" onPress={() => router.back()}>
          <Button.Label>Back</Button.Label>
        </Button>
        <Text style={{ fontSize: 20, fontWeight: '700', flex: 1 }}>Member</Text>
      </View>

      <StateView
        loading={member.isLoading}
        error={member.error}
        onRetry={() => void member.refetch()}
      >
        {member.data ? (
          <>
            <Header member={member.data} />
            <SocietyRecord member={member.data} editable={can('members.edit')} />
            <Transitions member={member.data} can={can} />
            {can('members.edit') ? <EditForm member={member.data} /> : null}
            <ReadOnlyDetails member={member.data} editable={can('members.edit')} />
          </>
        ) : null}
      </StateView>
    </Screen>
  );
}

function Header({ member }: { member: MemberDetail }) {
  return (
    <Card>
      <Card.Body style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 18, fontWeight: '700' }}>{member.name}</Text>
            <Text style={{ opacity: 0.7 }}>
              {member.membership_no ? `No. ${member.membership_no}` : 'Number not assigned'}
              {' · '}
              {member.mobile}
            </Text>
          </View>
          <StatusBadge status={member.status} />
        </View>

        <Text style={{ opacity: 0.7 }}>
          {member.shares} share{member.shares === 1 ? '' : 's'}
        </Text>
      </Card.Body>
    </Card>
  );
}

/**
 * The status decisions available from where this member currently stands.
 *
 * Driven by the TRANSITIONS map rather than by a chain of conditions, so the
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
    <Card>
      <Card.Body style={{ gap: 12 }}>
        <Text style={{ fontWeight: '600' }}>Status</Text>

        {transition.isError ? (
          <Text>That change could not be saved. Nothing was altered.</Text>
        ) : null}

        {config ? (
          <>
            <Text>
              {config.label} {member.name}?
            </Text>

            <Text style={{ opacity: 0.7 }}>
              {config.reasonRequired
                ? 'The reason is recorded against this member and is what the office will refer to if they ask.'
                : 'You can add a note. It is recorded against this member.'}
            </Text>

            {/*
              FR-FINE-6, stated where it matters. Staff reasonably assume
              restoring a member clears what accrued while they were out; it
              does not, and only a recorded fine adjustment ever will.
            */}
            {pendingAction === 'reinstate' ? (
              <Text style={{ fontWeight: '600' }}>
                Reinstating does not clear fines accrued while suspended.
              </Text>
            ) : null}

            <TextArea
              value={reason}
              onChangeText={setReason}
              placeholder={config.reasonRequired ? 'Required' : 'Optional'}
            />

            <View style={{ flexDirection: 'row', gap: 8 }}>
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
                // Mirrors the server's required_if, so the approver is told
                // before the round trip rather than by a 422 afterwards.
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
          </>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
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
      </Card.Body>
    </Card>
  );
}

/**
 * The society record: the membership number and what the office recorded with it.
 *
 * Separate from "Edit details" because it is a different act by a different
 * person - the legacy system draws the same line, with its own screen and a
 * field labelled "Office use only". A member's address is a correction; their
 * membership number is a decision of the register.
 *
 * The number is TYPED, not generated, and that is deliberate. The association's
 * register runs 01 to 317 across 315 live members, with gaps at 221 and 245
 * where numbers were retired. A generator would either refuse to reproduce
 * those gaps or quietly reissue a retired number, and the register - not this
 * system - is the authority on which it is.
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
      <Card>
        <Card.Body style={{ gap: 8 }}>
          <Text style={{ fontWeight: '600' }}>Society record</Text>

          <Row label="Membership no." value={member.membership_no} />
          <Row label="Joined" value={member.join_date} />
          <Row label="Share no." value={member.share_no} />
          <Row label="Employer" value={member.company} />
          <Row label="Designation" value={member.designation} />

          {/*
            Say what is missing rather than showing a dash and leaving staff to
            wonder whether it failed to load. A member with no number cannot be
            quoted one on a receipt or an approval SMS.
          */}
          {!member.membership_no ? (
            <Text style={{ fontWeight: '600' }}>No membership number assigned yet.</Text>
          ) : null}

          {editable ? (
            <Button variant="secondary" onPress={() => setOpen(true)}>
              <Button.Label>
                {member.membership_no ? 'Edit society record' : 'Assign membership number'}
              </Button.Label>
            </Button>
          ) : null}
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Body style={{ gap: 12 }}>
        <Text style={{ fontWeight: '600' }}>Society record</Text>
        <Text style={{ opacity: 0.7 }}>
          Office use. The number must be unique within this association.
        </Text>

        <Field
          label="Membership no."
          value={fields.membership_no}
          onChangeText={set('membership_no')}
          errors={fieldErrors.membership_no}
        />
        <Field
          label="Joined"
          hint="YYYY-MM-DD"
          value={fields.join_date ?? ''}
          onChangeText={set('join_date')}
          errors={fieldErrors.join_date}
        />
        <Field
          label="Share no."
          value={fields.share_no ?? ''}
          onChangeText={set('share_no')}
          errors={fieldErrors.share_no}
        />
        <Field label="Employer" value={fields.company ?? ''} onChangeText={set('company')} />
        <Field
          label="Designation"
          value={fields.designation ?? ''}
          onChangeText={set('designation')}
        />

        <View style={{ flexDirection: 'row', gap: 8 }}>
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
      </Card.Body>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ opacity: 0.7 }}>{label}</Text>
      <Text>{value || '\u2014'}</Text>
    </View>
  );
}

/**
 * The fields `PUT /staff/members/{id}` will actually act on - and only those.
 *
 * The detail response carries far more (gender, NID, birth date, batch, joining
 * date, mother's name), but the update endpoint does not validate them, so
 * sending them changes nothing. Rendering them as inputs would produce a form
 * that accepts an edit, reports success, and silently discards it. They are
 * shown read-only below instead, which is at least true.
 */
function EditForm({ member }: { member: MemberDetail }) {
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

  if (!open) {
    return (
      <Button variant="secondary" onPress={() => setOpen(true)}>
        <Button.Label>Edit details</Button.Label>
      </Button>
    );
  }

  return (
    <Card>
      <Card.Body style={{ gap: 12 }}>
        <Text style={{ fontWeight: '600' }}>Edit details</Text>

        {update.isError ? (
          <Text>Those changes were not saved. The member is unchanged.</Text>
        ) : null}

        <Field label="Name" value={fields.name ?? ''} onChangeText={set('name')} />
        <Field
          label="Mobile"
          value={fields.mobile ?? ''}
          onChangeText={set('mobile')}
          keyboardType="phone-pad"
        />
        <Field
          label="Email"
          value={fields.email ?? ''}
          onChangeText={set('email')}
          keyboardType="email-address"
        />
        <Field
          label="Father's name"
          value={fields.father_name ?? ''}
          onChangeText={set('father_name')}
        />
        <Field
          label="Present address"
          value={fields.present_address ?? ''}
          onChangeText={set('present_address')}
        />
        <Field
          label="Permanent address"
          value={fields.permanent_address ?? ''}
          onChangeText={set('permanent_address')}
        />

        <View style={{ flexDirection: 'row', gap: 8 }}>
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
      </Card.Body>
    </Card>
  );
}

/** Everything the update endpoint will not touch, shown as the record it is. */
function ReadOnlyDetails({ member, editable }: { member: MemberDetail; editable: boolean }) {
  const rows: [string, string | null][] = [
    ["Mother's name", member.mother_name],
    ['BCS batch', member.bcs_batch],
    ['Joined', member.joining_date],
    ['Date of birth', member.birth_date],
    ['Gender', member.gender],
    ['NID', member.nid],
  ];

  return (
    <Card>
      <Card.Body style={{ gap: 8 }}>
        <Text style={{ fontWeight: '600' }}>Record</Text>

        {rows.map(([label, value]) => (
          <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ opacity: 0.7 }}>{label}</Text>
            <Text>{value || '—'}</Text>
          </View>
        ))}

        {editable ? (
          <Text style={{ opacity: 0.7, fontSize: 12 }}>
            These are set when the member is created and are not editable here.
          </Text>
        ) : null}
      </Card.Body>
    </Card>
  );
}

function Field({
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
