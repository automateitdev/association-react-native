import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/errors';
import { useMembers } from '@/features/staff/members';
import {
  recentPeriods,
  useAssignFees,
  useFeeSetups,
  type AssignSummary,
} from '@/features/staff/fees';
import {
  Button,
  Checkbox,
  Chip,
  Input,
  Panel,
  PickerField,
  Row,
  Screen,
  ScreenHeader,
  Section,
  StateView,
  Text,
  TextField,
  space,
  type,
} from '@/ui';

/**
 * Assign a fee head to members, across one or more months.
 *
 * THE SUMMARY IS THE POINT OF THE SCREEN.
 * The API answers with created / skipped_duplicate / failed rather than a bare
 * success, and all three are shown. "180 created, 20 already assigned" is the
 * answer staff need; reporting only success reads as "all 200 were created",
 * and a month that was quietly skipped - or quietly double-assigned - is not
 * discovered until someone disputes their balance.
 *
 * Periods are chosen from a list rather than typed. The server validates
 * `YYYY-MM` strictly, and a hand-typed "2026-6" comes back as a regex failure
 * that means nothing to the person who typed it. HeroUI Native ships no date
 * picker (R-1) - for whole months a list is simpler and cannot be got wrong.
 */
export default function AssignFeesScreen() {
  const setups = useFeeSetups();
  const assign = useAssignFees();

  const [feeSetupId, setFeeSetupId] = useState<string | null>(null);
  const [periods, setPeriods] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [memberIds, setMemberIds] = useState<Set<number>>(new Set());
  const [summary, setSummary] = useState<AssignSummary | null>(null);

  const query = useDebounced(search, 300);

  /*
   * Active members only.
   *
   * Assigning a fee to someone awaiting approval bills a person the association
   * has not admitted; assigning to a suspended member adds to a debt that is
   * already the reason they are suspended. Both are decisions, not defaults, so
   * neither is offered here.
   */
  const members = useMembers(
    useMemo(() => ({ q: query || undefined, status: 'active' as const }), [query]),
  );

  const rows = useMemo(
    () => members.data?.pages.flatMap((page) => page.data) ?? [],
    [members.data],
  );

  // Only active fee heads can be assigned; the server refuses the rest with
  // FEE_HEAD_INACTIVE, so they are not offered.
  const options = useMemo(
    () =>
      (setups.data ?? [])
        .filter((s) => s.is_active)
        .map((s) => ({ value: String(s.id), label: `${s.fee_head} · ${s.amount}` })),
    [setups.data],
  );

  const months = useMemo(() => recentPeriods(new Date()), []);

  const togglePeriod = (period: string) =>
    setPeriods((current) =>
      current.includes(period) ? current.filter((p) => p !== period) : [...current, period],
    );

  const toggleMember = (id: number) =>
    setMemberIds((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const canSubmit = feeSetupId !== null && periods.length > 0 && memberIds.size > 0;

  const submit = async () => {
    if (!feeSetupId) return;

    try {
      const result = await assign.mutateAsync({
        feeSetupId: Number(feeSetupId),
        memberIds: [...memberIds],
        periods,
      });

      setSummary(result);
      setMemberIds(new Set());
      setPeriods([]);
    } catch {
      // Surfaced inline.
    }
  };

  return (
    <Screen>
      <ScreenHeader
        title="Assign fees"
        action={
          <Button variant="tertiary" onPress={() => router.back()}>
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      {summary ? (
        <View style={{ marginTop: space.lg }}>
          <Outcome summary={summary} onDismiss={() => setSummary(null)} />
        </View>
      ) : null}

      {assign.isError ? (
        <View style={{ marginTop: space.lg }}>
          <Panel tone="danger">
            <Text style={type.body}>
              {assign.error instanceof ApiError
                ? assign.error.message
                : 'Nothing was assigned. Check your connection and try again.'}
            </Text>
          </Panel>
        </View>
      ) : null}

      <Section title="1 · Which fee" first>
        <PickerField
          label="Fee head"
          value={feeSetupId}
          onChange={setFeeSetupId}
          options={options}
          placeholder={setups.isLoading ? 'Loading…' : 'Choose a fee head'}
          isDisabled={setups.isLoading}
          hint="Only fee heads in use can be assigned."
        />
      </Section>

      <Section title="2 · Which months">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {months.map((period) => (
            <Chip
              key={period}
              variant={periods.includes(period) ? 'primary' : 'secondary'}
              onPress={() => togglePeriod(period)}
            >
              <Chip.Label>{period}</Chip.Label>
            </Chip>
          ))}
        </View>
      </Section>

      <Section
        title="3 · Which members"
        action={
          rows.length > 0 ? (
            <Button
              variant="tertiary"
              onPress={() =>
                setMemberIds((current) =>
                  current.size === rows.length ? new Set() : new Set(rows.map((m) => m.id)),
                )
              }
            >
              <Button.Label>
                {memberIds.size === rows.length ? 'Clear' : `Select ${rows.length}`}
              </Button.Label>
            </Button>
          ) : undefined
        }
      >
        <Text tone="muted" style={{ ...type.rowMeta, marginBottom: space.sm }}>
          Active members only. Assigning to a suspended or unapproved member is a
          separate decision.
        </Text>

        <TextField>
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search name or mobile"
            autoCapitalize="none"
          />
        </TextField>

        <StateView
          loading={members.isLoading}
          error={members.error}
          empty={rows.length === 0}
          emptyTitle="No active members"
          emptyMessage="Nobody matches this search."
          onRetry={() => void members.refetch()}
        >
          {rows.map((member, index) => (
            <Row
              key={member.id}
              title={member.name}
              meta={member.membership_no ? `No. ${member.membership_no}` : 'No number yet'}
              leading={
                <Checkbox
                  isSelected={memberIds.has(member.id)}
                  onSelectedChange={() => toggleMember(member.id)}
                />
              }
              onPress={() => toggleMember(member.id)}
              divider={index < rows.length - 1}
            />
          ))}

          {members.hasNextPage ? (
            <View style={{ marginTop: space.md }}>
              <Button
                variant="secondary"
                isDisabled={members.isFetchingNextPage}
                onPress={() => void members.fetchNextPage()}
              >
                <Button.Label>
                  {members.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </Button.Label>
              </Button>
            </View>
          ) : null}
        </StateView>
      </Section>

      <View style={{ marginTop: space.xl, gap: space.sm }}>
        <Button isDisabled={!canSubmit || assign.isPending} onPress={() => void submit()}>
          <Button.Label>
            {assign.isPending
              ? 'Assigning…'
              : canSubmit
                ? `Assign to ${memberIds.size} member${memberIds.size === 1 ? '' : 's'} · ${periods.length} month${periods.length === 1 ? '' : 's'}`
                : 'Assign'}
          </Button.Label>
        </Button>

        {/*
          No total value anywhere on this screen, deliberately. Members times
          periods times amount is money arithmetic, and the app does not do
          money arithmetic - the counts say what will happen without inventing a
          figure the server never sent.
        */}
        {!canSubmit ? (
          <Text tone="muted" style={{ ...type.rowMeta, textAlign: 'center' }}>
            Choose a fee head, at least one month, and at least one member.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

/**
 * What the batch actually did.
 *
 * Skipped duplicates are reported as plainly as successes. They are not a
 * failure - re-running an assignment is a normal thing to do - but staff have to
 * be able to tell "180 were already there" from "180 were created", and only
 * the number distinguishes them.
 */
function Outcome({ summary, onDismiss }: { summary: AssignSummary; onDismiss: () => void }) {
  return (
    <Panel tone={summary.failed.length > 0 ? 'danger' : 'neutral'}>
      <Text style={type.rowTitle}>{summary.created} instalments created</Text>

      {summary.skipped_duplicate > 0 ? (
        <Text style={type.body}>
          {summary.skipped_duplicate} skipped — already assigned for those months.
        </Text>
      ) : null}

      {/*
        Each failure carries its own reason, so they are listed rather than
        counted. "member 3, period 2026-08: ..." tells staff who to go back to;
        "3 failed" does not.
      */}
      {summary.failed.map((failure) => (
        <Text key={failure} tone="danger" style={type.body}>
          {failure}
        </Text>
      ))}

      <Button variant="secondary" onPress={onDismiss}>
        <Button.Label>Dismiss</Button.Label>
      </Button>
    </Panel>
  );
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
