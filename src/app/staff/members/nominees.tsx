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
import {
  Button,
  Form,
  FormActions,
  Icon,
  InputField,
  Panel,
  Row,
  Screen,
  ScreenHeader,
  Section,
  StateView,
  Text,
  space,
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
        <View style={{ marginTop: space.lg }}>
          <Panel tone="danger">
            <Text style={type.body}>{error}</Text>
          </Panel>
        </View>
      ) : null}

      {editing || adding ? (
        <Section title={editing ? `Edit ${editing.name}` : 'New nominee'} first>
          <NomineeForm
            nominee={editing}
            allocatedElsewhere={
              editing
                ? subtract(allocated, editing.share_percentage ?? '0.00')
                : allocated
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

      <Section title="Nominated" first={! editing && ! adding}>
        <Panel>
          <Text style={type.body}>
            {allocated === '0.00'
              ? 'Nobody has been allocated a share yet.'
              : `${allocated}% allocated${
                  allocated === '100.00' ? '' : `, ${subtract('100.00', allocated)}% still free`
                }.`}
          </Text>
          <Text tone="muted" style={{ ...type.rowMeta, marginTop: 4 }}>
            Shares cannot add up to more than 100%. They may add up to less while the member
            is still deciding.
          </Text>
        </Panel>

        {! editing && ! adding ? (
          <View style={{ marginTop: space.md, alignItems: 'flex-start' }}>
            <Button size="sm" onPress={() => setAdding(true)}>
              <Icon name="add" size={15} tone="inverse" />
              <Button.Label>Add nominee</Button.Label>
            </Button>
          </View>
        ) : null}

        <View style={{ marginTop: space.md }}>
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
                meta={[
                  nominee.relation,
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
        </View>
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
  const [birthDate, setBirthDate] = useState(nominee?.birth_date ?? '');
  const [nid, setNid] = useState(nominee?.nid ?? '');
  const [mobile, setMobile] = useState(nominee?.mobile ?? '');
  const [address, setAddress] = useState(nominee?.address ?? '');
  const [share, setShare] = useState(nominee?.share_percentage ?? '');

  const free = subtract('100.00', allocatedElsewhere);

  return (
    <Form dense>
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
              birth_date: birthDate || null,
              nid: nid.trim() || null,
              mobile: mobile.trim() || null,
              address: address.trim() || null,
              share_percentage: share.trim() === '' ? null : Number(share),
            })
          }
        >
          <Button.Label>{pending ? 'Saving…' : nominee ? 'Save nominee' : 'Add nominee'}</Button.Label>
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
