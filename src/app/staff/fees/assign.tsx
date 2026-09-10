import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/errors';
import { useMemberOptions } from '@/features/staff/members';
import {
  MONTH_NAMES,
  periodsFor,
  useAssignFees,
  useFeeSetups,
  type AssignSummary,
} from '@/features/staff/fees';
import {
  Actions,
  Button,
  Checkbox,
  Chip,
  Icon,
  Panel,
  PickerField,
  Row,
  Screen,
  ScreenHeader,
  Section,
  SearchField,
  StateView,
  Text,
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
 * Periods are chosen as MONTHS TIMES YEARS rather than from a list of recent
 * months, which is the legacy screen's model and the only one that covers the
 * work: billing a month ahead, setting up a whole year at once, or applying
 * the same months across several years. The rewrite offered the last eighteen
 * months and nothing else, so none of those were possible - a limit the UI
 * invented, since the API accepts any well-formed YYYY-MM.
 *
 * Still chosen rather than typed. The server validates `YYYY-MM` strictly, and
 * a hand-typed "2026-6" comes back as a regex failure that means nothing to
 * the person who typed it. HeroUI Native ships no date picker (R-1), and a
 * calendar would be the wrong instrument anyway: it picks days and ranges,
 * where a fee period is a whole month and the months wanted are often not
 * next to each other.
 */
export default function AssignFeesScreen() {
  const setups = useFeeSetups();
  const assign = useAssignFees();

  const [feeSetupId, setFeeSetupId] = useState<string | null>(null);

  /*
   * Months and years are held apart and multiplied, rather than a flat list of
   * periods. It is what makes "every month of next year" one gesture instead
   * of twelve, and it is the legacy screen's own model - see periodsFor.
   */
  const [months, setMonths] = useState<number[]>([]);
  const [years, setYears] = useState<number[]>([new Date().getFullYear()]);

  /*
   * The window of years OFFERED, not the years assignable.
   *
   * The legacy dropdown ran range(2022, 5000) - three thousand options to pick
   * this year from. A five-year window covers ordinary work, and the arrows
   * move it, so no year is out of reach. Bounding what is SHOWN is fine;
   * bounding what can be CHOSEN is the mistake this screen just came from.
   */
  const [yearBase, setYearBase] = useState(new Date().getFullYear() - 2);
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
  const members = useMemberOptions(
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

  const periods = useMemo(() => periodsFor(years, months), [years, months]);

  /*
   * The offered years, plus any already chosen that the window has since moved
   * away from - a selection must never become invisible because the thing that
   * shows it scrolled.
   */
  const yearChips = useMemo(() => {
    const window = [0, 1, 2, 3, 4].map((i) => yearBase + i);

    return [...new Set([...window, ...years])].sort((a, b) => a - b);
  }, [yearBase, years]);

  const toggleMonth = (month: number) =>
    setMonths((current) =>
      current.includes(month) ? current.filter((m) => m !== month) : [...current, month],
    );

  const toggleYear = (year: number) =>
    setYears((current) =>
      current.includes(year) ? current.filter((y) => y !== year) : [...current, year],
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
      setMonths([]);
    } catch {
      // Surfaced inline.
    }
  };

  return (
    <Screen>
      <ScreenHeader
        title="Assign fees"
        action={
          <Button size="sm" variant="tertiary" onPress={() => router.back()}>
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

      <Section
        title="2 · Which months"
        action={
          <Button
            variant="tertiary"
            onPress={() =>
              setMonths((current) =>
                current.length === 12 ? [] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
              )
            }
          >
            <Button.Label>{months.length === 12 ? 'Clear' : 'All 12'}</Button.Label>
          </Button>
        }
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {MONTH_NAMES.map((name, index) => {
            const month = index + 1;

            return (
              <Chip
                size="sm"
                key={name}
                variant={months.includes(month) ? 'primary' : 'secondary'}
                onPress={() => toggleMonth(month)}
              >
                <Chip.Label>{name}</Chip.Label>
              </Chip>
            );
          })}
        </View>

        {/*
          YEARS ARE A SECOND AXIS, not a prefix on each month. Twelve months
          times three years is thirty-six chips as one list and twelve plus
          three as two.
        */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: space.sm,
            marginTop: space.md,
          }}
        >
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => setYearBase((y) => y - 1)}
            accessibilityLabel="Show earlier years"
          >
            <Icon name="back" size={14} tone="muted" />
          </Button>

          {yearChips.map((year) => (
            <Chip
              size="sm"
              key={year}
              variant={years.includes(year) ? 'primary' : 'secondary'}
              onPress={() => toggleYear(year)}
            >
              <Chip.Label>{String(year)}</Chip.Label>
            </Chip>
          ))}

          <Button
            size="sm"
            variant="tertiary"
            onPress={() => setYearBase((y) => y + 1)}
            accessibilityLabel="Show later years"
          >
            <Icon name="chevron" size={14} tone="muted" />
          </Button>
        </View>

        {/*
          A cross product multiplies quietly. Six months across two years is
          twelve instalments per member, and with forty selected members that
          is four hundred and eighty rows from one press of a button - which
          nothing on the screen would otherwise say before it happened.
        */}
        <Text tone="muted" style={{ ...type.rowMeta, marginTop: space.md }}>
          {periods.length === 0
            ? 'Choose at least one month and one year.'
            : `${periods.length} instalment${periods.length === 1 ? '' : 's'} per member — ${periods[0]} to ${periods[periods.length - 1]}`}
        </Text>
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

        {/*
          SearchField, like every other list in the app.

          This was a raw TextField + Input at maxWidth 340 - which is precisely
          the shape ui/SearchField was written to replace, in its own words: a
          FORM field, 48pt tall, sitting half again the height of everything
          around it. Six screens moved to SearchField and this one was missed,
          so the only member list in the app that filters like a form rather
          than like a filter was this one.
        */}
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or mobile"
        />

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
              // Selects, does not navigate. The checkbox says what tapping does.
              chevron={false}
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
        <Actions>
        <Button isDisabled={!canSubmit || assign.isPending} onPress={() => void submit()}>
          <Button.Label>
            {assign.isPending
              ? 'Assigning…'
              : canSubmit
                ? `Assign to ${memberIds.size} member${memberIds.size === 1 ? '' : 's'} · ${periods.length} instalment${periods.length === 1 ? '' : 's'} each`
                : 'Assign'}
          </Button.Label>
        </Button>
        </Actions>

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

      <Actions>
        <Button variant="secondary" onPress={onDismiss}>
          <Button.Label>Dismiss</Button.Label>
        </Button>
      </Actions>
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
