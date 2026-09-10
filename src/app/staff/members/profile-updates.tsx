import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/errors';
import { useSession } from '@/features/auth/session';
import {
  useDecideProfileUpdate,
  useProfileUpdates,
  type ProfileUpdate,
} from '@/features/staff/profileUpdates';
import {
  Button,
  Divider,
  FilterSelect,
  Form,
  FormActions,
  Icon,
  Inline,
  InputField,
  Pager,
  Panel,
  Screen,
  ScreenHeader,
  Section,
  space,
  Stack,
  StateView,
  Text,
  Toolbar,
  type,
} from '@/ui';

/**
 * Changes members have asked the office to make (FR-MEM-8).
 *
 * NOT A TABLE. Every other listing here is one, because tables exist to be
 * compared and sorted. These are read one at a time and decided one at a time,
 * and what matters in each is a before and an after per field — which is a
 * shape a row of columns cannot hold when one request changes an address and
 * the next changes a name.
 *
 * THE CURRENT VALUE IS SHOWN BESIDE THE PROPOSED ONE, always. Approving
 * "mobile: 01799887766" without seeing the number on file is not a decision,
 * it is a rubber stamp — and a replaced number is what taking over an account
 * looks like.
 */
export default function ProfileUpdatesScreen() {
  const { can } = useSession();

  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<ProfileUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updates = useProfileUpdates(status, page);
  const decide = useDecideProfileUpdate();

  const rows = updates.data?.data ?? [];
  const meta = updates.data?.meta;

  const act = async (id: number, decision: 'approve' | 'reject', reason?: string) => {
    setError(null);

    try {
      await decide.mutateAsync({ id, decision, reason });
      setRejecting(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That decision could not be recorded.');
    }
  };

  return (
    <Screen onRefresh={() => void updates.refetch()} refreshing={updates.isRefetching}>
      <ScreenHeader
        title="Requested changes"
        subtitle={meta ? `${meta.pending} waiting` : undefined}
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

      {rejecting ? (
        <Section title={`Refuse ${rejecting.member_name}'s request`} first>
          <RejectForm
            update={rejecting}
            pending={decide.isPending}
            onCancel={() => {
              setRejecting(null);
              setError(null);
            }}
            onSubmit={(reason) => void act(rejecting.id, 'reject', reason)}
          />
        </Section>
      ) : null}

      {/* Headed only while the refusal form is open above it; otherwise the page
          header has already said Requested changes. */}
      <Section title={rejecting ? 'Requests' : undefined} first={!rejecting}>
        <Toolbar
          filters={
            <FilterSelect
              options={[
                { value: 'pending', label: 'Waiting' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Refused' },
                { value: 'all', label: 'All' },
              ]}
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
                setRejecting(null);
              }}
              icon="members"
              width={170}
            />
          }
        />

        <StateView
          loading={updates.isLoading}
          error={updates.error}
          empty={rows.length === 0}
          emptyTitle="Nothing waiting"
          emptyMessage={
            status === 'pending'
              ? 'No member has asked for a change.'
              : 'No request with that status.'
          }
          onRetry={() => void updates.refetch()}
        >
          {rows.map((update, index) => (
            <View key={update.id} style={{ paddingVertical: space.md }}>
              <Stack gap="sm">
                <Stack gap="none">
                  <Text style={type.rowTitle}>{update.member_name}</Text>
                  <Text tone="muted" style={type.rowMeta}>
                    {update.member_mobile} · asked {update.requested_at}
                  </Text>
                </Stack>

                <Stack gap="xs">
                  {update.fields.map((field) => (
                    <Inline key={field.field} gap="sm" align="stretch">
                      <Text tone="muted" style={{ ...type.rowMeta, width: 130 }}>
                        {label(field.field)}
                      </Text>
                      {/*
                      Current, then proposed. The order matters: read left to
                      right it says what is changing, not merely what is wanted.
                    */}
                      <Text tone="muted" style={{ ...type.rowMeta, flex: 1 }}>
                        {field.current || '—'}
                      </Text>
                      <Text style={{ ...type.rowMeta, flex: 1 }}>{field.proposed || '—'}</Text>
                    </Inline>
                  ))}
                </Stack>

                {update.status === 'pending' ? (
                  can('profile-updates.decide') ? (
                    <Inline gap="sm">
                      <Button
                        size="sm"
                        isDisabled={decide.isPending}
                        onPress={() => void act(update.id, 'approve')}
                      >
                        <Button.Label>Approve</Button.Label>
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        isDisabled={decide.isPending}
                        onPress={() => setRejecting(update)}
                      >
                        <Button.Label>Refuse</Button.Label>
                      </Button>
                    </Inline>
                  ) : (
                    <Text tone="muted" style={type.rowMeta}>
                      You can see these but not decide them.
                    </Text>
                  )
                ) : (
                  <Text tone="muted" style={type.rowMeta}>
                    {update.status === 'approved' ? 'Approved' : 'Refused'} {update.decided_at}
                    {update.decision_reason ? ` · ${update.decision_reason}` : ''}
                  </Text>
                )}

                {index < rows.length - 1 ? <Divider /> : null}
              </Stack>
            </View>
          ))}
        </StateView>

        {meta ? (
          <View style={{ marginTop: space.md }}>
            <Pager page={meta.current_page} pageCount={meta.last_page} onGoTo={setPage} />
          </View>
        ) : null}
      </Section>
    </Screen>
  );
}

function RejectForm({
  update,
  pending,
  onCancel,
  onSubmit,
}: {
  update: ProfileUpdate;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <Form dense>
      <Panel>
        <Text style={type.body}>
          {update.member_name} asked to change{' '}
          {update.fields.map((f) => label(f.field).toLowerCase()).join(', ')}.
        </Text>
      </Panel>

      <InputField
        label="Why it is being refused"
        value={reason}
        onChangeText={setReason}
        required
        hint="The member sees this. Refusing without a reason leaves them to guess and ask again."
      />

      <FormActions>
        <Button variant="secondary" onPress={onCancel}>
          <Button.Label>Cancel</Button.Label>
        </Button>
        <Button
          variant="danger"
          isDisabled={pending || reason.trim().length < 3}
          onPress={() => onSubmit(reason.trim())}
        >
          <Button.Label>{pending ? 'Saving…' : 'Refuse the request'}</Button.Label>
        </Button>
      </FormActions>
    </Form>
  );
}

/** `present_address` reads as a column name; "Present address" reads as English. */
function label(field: string): string {
  const words = field.replace(/_/g, ' ');

  return words.charAt(0).toUpperCase() + words.slice(1);
}
