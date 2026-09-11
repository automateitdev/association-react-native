import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/errors';
import {
  useCreateNominee,
  useDeleteNominee,
  useNominees,
  useUpdateNominee,
  type Nominee,
  type NomineeInput,
} from '@/features/staff/nominees';
import { DocumentsSection } from '@/features/DocumentsSection';
import {
  Button,
  Form,
  FormActions,
  Icon,
  InputField,
  Panel,
  PickerField,
  Row,
  Screen,
  ScreenHeader,
  Section,
  space,
  Stack,
  StateView,
  Text,
  type,
} from '@/ui';

/**
 * A member's nominees: who their savings go to if they die.
 *
 * A LIST, NOT A TABLE. Every other listing here is a table because it exists to
 * be compared and sorted. Nobody sorts three nominees. What matters is each
 * person's details and their share, which reads better as rows than as a grid
 * with two-thirds empty cells.
 *
 * THE PERCENTAGE IS THE POINT. Several nominees are only a split if the shares
 * add up, so the screen shows what is still unallocated and the server refuses
 * anything over 100%. It deliberately does not insist on reaching 100 - somebody
 * part way through naming three people must be able to save the first two.
 */
export default function NomineesScreen() {
  const params = useLocalSearchParams<{ member?: string }>();
  const memberId = Number(params.member);

  const nominees = useNominees(memberId);
  const create = useCreateNominee(memberId);
  const update = useUpdateNominee(memberId);
  const remove = useDeleteNominee(memberId);

  const [editing, setEditing] = useState<Nominee | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = nominees.data?.data ?? [];
  const meta = nominees.data?.meta;
  const allocated = meta?.allocated_percentage ?? '0.00';

  const submit = async (values: NomineeInput) => {
    setError(null);

    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...values });
      } else {
        await create.mutateAsync(values);
      }

      setEditing(null);
      setAdding(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The nominee could not be saved.');
    }
  };

  const destroy = async (nominee: Nominee) => {
    setError(null);

    try {
      await remove.mutateAsync(nominee.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The nominee could not be removed.');
    }
  };

  return (
    <Screen onRefresh={() => void nominees.refetch()} refreshing={nominees.isRefetching}>
      <ScreenHeader
        title="Nominees"
        subtitle={meta ? meta.member_name : undefined}
        action={
          <Button size="sm" variant="tertiary" onPress={() => router.back()}>
            <Icon name="back" size={15} tone="muted" />
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      {error ? (
        <Section>
          <Panel tone="danger">
            <Text style={type.body}>{error}</Text>
          </Panel>
        </Section>
      ) : null}

      {editing || adding ? (
        <Section title={editing ? `Edit ${editing.name}` : 'New nominee'} first>
          <NomineeForm
            nominee={editing}
            allocatedElsewhere={
              editing ? subtract(allocated, editing.share_percentage ?? '0.00') : allocated
            }
            pending={create.isPending || update.isPending}
            onCancel={() => {
              setEditing(null);
              setAdding(false);
              setError(null);
            }}
            onSubmit={submit}
          />
        </Section>
      ) : null}

      {/*
        A nominee's own documents, and only for one that already exists - there
        is nothing to attach them to until the record is saved.

        Here rather than on the row, because it is the same decision as editing:
        you open a nominee, and everything about that nominee is in front of
        you. The legacy carries applicant AND nominee NID images through its
        approval queue, and this is the half of that which needs no queue.
      */}
      {editing ? (
        <DocumentsSection
          owner={{ kind: 'nominee', id: editing.id }}
          editable
          title={`${editing.name}'s documents`}
        />
      ) : null}

      {/* Headed only while a form is open above it; otherwise the page header
          has already said Nominees. */}
      <Section title={editing || adding ? 'Nominated' : undefined} first={!editing && !adding}>
        <Panel>
          <Text style={type.body}>
            {allocated === '0.00'
              ? 'Nobody has been allocated a share yet.'
              : `${allocated}% allocated${
                  allocated === '100.00' ? '' : `, ${subtract('100.00', allocated)}% still free`
                }.`}
          </Text>
          <Text tone="muted" style={type.rowMeta}>
            Shares cannot add up to more than 100%. They may add up to less while the member is
            still deciding.
          </Text>
        </Panel>

        {!editing && !adding ? (
          <Stack align="start">
            <Button size="sm" onPress={() => setAdding(true)}>
              <Icon name="add" size={15} tone="inverse" />
              <Button.Label>Add nominee</Button.Label>
            </Button>
          </Stack>
        ) : null}

        <Section>
          <StateView
            loading={nominees.isLoading}
            error={nominees.error}
            empty={list.length === 0}
            emptyTitle="No nominees"
            emptyMessage="This member has not said who their savings should go to."
            onRetry={() => void nominees.refetch()}
          >
            {list.map((nominee, index) => (
              <Row
                key={nominee.id}
                title={nominee.name}
                /*
                  The parents' names are on the row, not only in the form.
                  Identifying a nominee is the reason the record exists, and a
                  list that shows only "Rahima Begum · Spouse" cannot tell two
                  of them apart - which is the moment the office needs it to.
                */
                meta={[
                  nominee.relation,
                  parentage(nominee),
                  nominee.share_percentage ? `${nominee.share_percentage}%` : 'no share set',
                  nominee.mobile,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                trailing={
                  <Button
                    size="sm"
                    variant="danger"
                    isDisabled={remove.isPending}
                    onPress={() => void destroy(nominee)}
                  >
                    <Button.Label>Remove</Button.Label>
                  </Button>
                }
                onPress={() => setEditing(nominee)}
                divider={index < list.length - 1}
              />
            ))}
          </StateView>
        </Section>
      </Section>
    </Screen>
  );
}

function NomineeForm({
  nominee,
  allocatedElsewhere,
  pending,
  onCancel,
  onSubmit,
}: {
  nominee: Nominee | null;
  /** What the OTHER nominees hold, so this form can say what is left for this one. */
  allocatedElsewhere: string;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (values: NomineeInput) => void;
}) {
  const [name, setName] = useState(nominee?.name ?? '');
  const [relation, setRelation] = useState(nominee?.relation ?? '');
  const [fatherName, setFatherName] = useState(nominee?.father_name ?? '');
  const [motherName, setMotherName] = useState(nominee?.mother_name ?? '');
  const [gender, setGender] = useState<string | null>(nominee?.gender ?? null);
  const [profession, setProfession] = useState(nominee?.profession ?? '');
  const [birthDate, setBirthDate] = useState(nominee?.birth_date ?? '');
  const [nid, setNid] = useState(nominee?.nid ?? '');
  const [mobile, setMobile] = useState(nominee?.mobile ?? '');
  const [address, setAddress] = useState(nominee?.address ?? '');
  const [share, setShare] = useState(nominee?.share_percentage ?? '');

  const free = subtract('100.00', allocatedElsewhere);

  return (
    <Form dense maxWidth={null} columns={2}>
      <InputField label="Name" value={name} onChangeText={setName} required />

      <InputField
        label="Relation"
        value={relation}
        onChangeText={setRelation}
        placeholder="e.g. Spouse, Son, Sister"
      />

      <InputField
        label="Share"
        value={share}
        onChangeText={setShare}
        keyboardType="phone-pad"
        hint={`Percentage of the balance. Up to ${free}% is free.`}
      />

      {/*
        WHO THIS PERSON IS, which a name and a relation do not settle.

        The association may have to identify a nominee to a bank or a court
        after the member has died, and in Bangladesh that identification is a
        name plus a father's and a mother's name. Two nominees called Rahima
        Begum are told apart by these and not by an address that may be a decade
        old. Every one of the association's 315 nominees carries all three in
        the system this replaces.
      */}
      <InputField label="Father's name" value={fatherName} onChangeText={setFatherName} />

      <InputField label="Mother's name" value={motherName} onChangeText={setMotherName} />

      {/*
        A picker rather than the chip row the member form uses. In a two-column
        grid of labelled fields a rank of chips is the one control that does not
        line up with its neighbours - the same argument that took the months on
        the fee-assign screen from chips to a dropdown.
      */}
      <PickerField
        label="Gender"
        value={gender}
        onChange={setGender}
        options={[
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
          { value: 'other', label: 'Other' },
        ]}
        placeholder="Not recorded"
      />

      {/*
        A plain field, not DateField: that one picks a RANGE by design, which is
        right for a report period and wrong for a date of birth. Same shape the
        member form uses for "Joined".
      */}
      <InputField
        label="Date of birth"
        value={birthDate}
        onChangeText={setBirthDate}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
      />

      <InputField label="National ID" value={nid} onChangeText={setNid} autoCapitalize="none" />

      <InputField label="Mobile" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" />

      <InputField label="Address" value={address} onChangeText={setAddress} />

      {/* A job and a workplace together, which is how it is written down:
          "Lecturer, Noakhali Science & Technology University". */}
      <InputField
        label="Profession"
        value={profession}
        onChangeText={setProfession}
        placeholder="e.g. Lecturer, Dhaka University"
      />

      <FormActions>
        <Button variant="secondary" onPress={onCancel}>
          <Button.Label>Cancel</Button.Label>
        </Button>

        <Button
          isDisabled={pending || name.trim() === ''}
          onPress={() =>
            onSubmit({
              name: name.trim(),
              relation: relation.trim() || null,
              father_name: fatherName.trim() || null,
              mother_name: motherName.trim() || null,
              gender,
              birth_date: birthDate || null,
              nid: nid.trim() || null,
              mobile: mobile.trim() || null,
              address: address.trim() || null,
              profession: profession.trim() || null,
              share_percentage: share.trim() === '' ? null : Number(share),
            })
          }
        >
          <Button.Label>
            {pending ? 'Saving…' : nominee ? 'Save nominee' : 'Add nominee'}
          </Button.Label>
        </Button>
      </FormActions>
    </Form>
  );
}

/**
 * Two-decimal subtraction on strings.
 *
 * The app never does money arithmetic (FR-MON-4), and a percentage is not
 * money - but it is displayed to the same standard, so this keeps the two
 * decimals rather than letting 100 - 33.33 render as 66.67000000000001.
 */
function subtract(a: string, b: string): string {
  return (Math.round((Number(a) - Number(b)) * 100) / 100).toFixed(2);
}

/**
 * `s/o Abdul Karim`, `d/o Abdul Karim`, or the plain fact when gender is unknown.
 *
 * The abbreviations are what a Bangladeshi record actually uses, and they are
 * only correct if the right one is chosen - which is possible now that a
 * nominee's gender is recorded and was not before. Where it is not known the
 * row says whose child they are without guessing which.
 */
function parentage(nominee: Nominee): string | null {
  if (!nominee.father_name) return null;

  if (nominee.gender === 'female') return `d/o ${nominee.father_name}`;
  if (nominee.gender === 'male') return `s/o ${nominee.father_name}`;

  return `father: ${nominee.father_name}`;
}
