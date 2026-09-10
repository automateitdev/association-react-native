import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/errors';
import { useMembers } from '@/features/staff/members';
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
  Cell,
  Checkbox,
  Chip,
  DataTable,
  Icon,
  Panel,
  PickerField,
  Screen,
  ScreenHeader,
  Section,
  SearchField,
  StateView,
  Text,
  type Column,
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

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [memberIds, setMemberIds] = useState<Set<number>>(new Set());
  const [summary, setSummary] = useState<AssignSummary | null>(null);

  const query = useDebounced(search, 300);

  /*
   * A new search starts at page one. Without this, searching while on page
   * three asks the server for page three of two results and the table comes
   * back empty - which reads as "no matches" for a search that has plenty.
   */
  useEffect(() => {
    setPage(1);
  }, [query]);

  /*
   * Active members only.
   *
   * Assigning a fee to someone awaiting approval bills a person the association
   * has not admitted; assigning to a suspended member adds to a debt that is
   * already the reason they are suspended. Both are decisions, not defaults, so
   * neither is offered here.
   */
  /*
   * PAGED, like every other table in the app.
   *
   * This used useMemberOptions - the infinite query built for pickers - whose
   * own note argues against paging here, on the grounds that a control which
   * reshuffles under a part-made selection is hostile. The concern is real and
   * the conclusion was wrong: selection is a Set of member ids, so it survives
   * paging untouched, and the legacy screen paginates too (its DataTables
   * table pages client-side over every member at once).
   *
   * What was actually hostile was the result: the one table in the app with no
   * pager and a "Load more" button instead, so a counter clerk could not tell
   * how many members there were or jump to the end.
   */
  const members = useMembers(
    useMemo(() => ({ q: query || undefined, status: 'active' as const }), [query]),
    page,
    null,
  );

  const rows = members.data?.data ?? [];
  const meta = members.data?.meta;

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

  const toggleMonth = (month: number) =>
    setMonths((current) =>
      current.includes(month) ? current.filter((m) => m !== month) : [...current, month],
    );

  /*
   * The years offered, as the legacy screen offers them - a dropdown you tick.
   *
   * Its own list is range(2022, 5000): three thousand options to pick this
   * year from, and the only reason that is survivable is that nobody scrolls
   * past the default. A window that moves with the clock covers the same real
   * work - a few years back for corrections, a few forward for billing ahead -
   * without asking anyone to scroll to the year 5000.
   */
  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();

    return Array.from({ length: 12 }, (_, i) => now - 6 + i).map((year) => ({
      value: String(year),
      label: String(year),
    }));
  }, []);

  const toggleYear = (value: string) =>
    setYears((current) => {
      const year = Number(value);

      return current.includes(year)
        ? current.filter((y) => y !== year)
        : [...current, year].sort((a, b) => a - b);
    });

  /*
   * THE SAME TABLE AS EVERY OTHER MEMBER LIST, with the approvals queue's
   * checkbox column in front of it.
   *
   * This was a list of Row + Checkbox, on the reasoning that choosing from a
   * list is a different act from reading one. That reasoning survives contact
   * with neither this app nor the legacy one. ui/DataTable already supports a
   * checkbox first column - its own docblock cites the approvals queue's 46pt
   * one - and the legacy fee-assign screen is a table with a select-all
   * checkbox, a name, a member id, an email and a mobile.
   *
   * So the Row list was not a considered pattern. It was the screen nobody
   * converted: the only member list in the app showing a name and a number
   * where every other one shows a number, a mobile and a status.
   */
  const memberColumns = useMemo<Column<(typeof rows)[number]>[]>(
    () => [
      {
        key: 'select',
        header: '',
        width: 46,
        frozen: true,
        // No `sort`: ordering a list by which rows happen to be ticked is not
        // a question anybody asks.
        render: (row) => (
          <Checkbox
            isSelected={memberIds.has(row.id)}
            onSelectedChange={() => toggleMember(row.id)}
          />
        ),
      },
      {
        key: 'name',
        header: 'Member',
        width: 200,
        frozen: true,
        render: (row) => <Cell bold>{row.name}</Cell>,
      },
      {
        key: 'membership_no',
        header: 'No.',
        width: 90,
        render: (row) => <Cell>{row.membership_no || '—'}</Cell>,
      },
      {
        key: 'mobile',
        header: 'Mobile',
        width: 130,
        render: (row) => <Cell>{row.mobile ?? '—'}</Cell>,
      },
      {
        key: 'email',
        header: 'Email',
        width: 210,
        render: (row) => <Cell>{row.email || '—'}</Cell>,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [memberIds],
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

          A DROPDOWN YOU TICK, which is what the legacy screen uses - a
          multi-select of years beside the month checkboxes. It replaced first
          a rank of year chips with a moving window, then a stepper: the chips
          put a permanent row of years on screen to express a choice that is
          nearly always just "this one", and the stepper made a second year
          awkward enough that nobody would reach for it.

          A closed dropdown is one line saying "2026", and every year it offers
          is one press away without anything else moving.
        */}
        <View style={{ maxWidth: 260, marginTop: space.md }}>
          <PickerField
            label="Years"
            options={yearOptions}
            value={null}
            onChange={() => {}}
            values={years.map(String)}
            onToggleValue={toggleYear}
            placeholder="Choose a year"
          />
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
                  rows.every((m) => current.has(m.id))
                    ? new Set([...current].filter((id) => !rows.some((m) => m.id === id)))
                    : new Set([...current, ...rows.map((m) => m.id)]),
                )
              }
            >
              {/*
                THIS PAGE, not all matches - and it says so, because with a
                pager "Select 25" beside a total of 45 invites exactly the
                wrong assumption. Selecting every match would need the server
                to answer with ids it has not been asked for.
              */}
              <Button.Label>
                {rows.every((m) => memberIds.has(m.id))
                  ? 'Clear this page'
                  : `Select these ${rows.length}`}
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
          <DataTable
            columns={memberColumns}
            rows={rows}
            keyExtractor={(member) => member.id}
            server={
              meta
                ? {
                    page: meta.current_page,
                    pageCount: meta.last_page,
                    total: meta.total,
                    // What the hook asks the API for. See ServerPaging.pageSize.
                    pageSize: 25,
                    onPageChange: setPage,
                    sort: null,
                    onSortChange: () => {},
                  }
                : undefined
            }
          />

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
