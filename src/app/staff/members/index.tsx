import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from '@/features/auth/session';
import { ExportButtons } from '@/features/staff/ExportButtons';
import { useMembers, type MemberStatus, type MemberSummary } from '@/features/staff/members';
import {
  Button,
  Cell,
  DataTable,
  DateField,
  Icon,
  FilterSelect,
  NumberCell,
  Screen,
  ScreenHeader,
  SearchField,
  Section,
  StateView,
  StatusBadge,
  Toolbar,
  type Column,
  type DateRange,
  type SortState,
} from '@/ui';

/**
 * The member list.
 *
 * A TABLE, like every other listing in the staff surface.
 *
 * It was a row per member, which was right when the alternative was a card per
 * member - eight bordered boxes to communicate eight things. It is wrong
 * against three hundred, because the questions staff actually ask here are
 * comparative: who holds the most shares, who was added recently, which of
 * these are suspended. A row list answers none of those without reading every
 * row; a sortable column answers each in one press.
 *
 * SEARCH, FILTER, SORT AND PAGE ALL GO TO THE SERVER. Any of them done here
 * would silently apply to the loaded page only, so a member on page three would
 * appear not to exist - a bug that looks like missing data rather than a broken
 * filter.
 */
/**
 * "All" is the ABSENCE of a filter, not a status.
 *
 * It carries a value of its own because a select has to have something
 * selected; the screen maps it back to null on the way out, so the query
 * string stays "no status parameter" rather than "status=all".
 */
const STATUS_OPTIONS = [
  { value: 'all', label: 'All members' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Awaiting approval' },
  { value: 'suspended', label: 'Suspended' },
];

export default function MembersScreen() {
  const { can } = useSession();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<MemberStatus | null>(null);
  const [added, setAdded] = useState<DateRange>({});
  const [draft, setDraft] = useState<DateRange>({});
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>(null);

  /*
   * Debounced, so typing does not fire a request per keystroke. 300ms is short
   * enough to feel immediate and long enough that "Fatema" is one query.
   */
  const query = useDebounced(search, 300);

  const filters = useMemo(
    () => ({ q: query || undefined, status, from: added.from, to: added.to }),
    [query, status, added],
  );

  /*
   * Back to page one whenever the filters or the order change.
   *
   * Without this, narrowing a 300-member list to the four matching "Rahim"
   * while sitting on page five asks the server for page five of one and shows
   * an empty table - which reads as "no matches" for a search that has four.
   */
  useEffect(() => {
    setPage(1);
  }, [filters, sort]);

  const members = useMembers(filters, page, sort);
  const rows = members.data?.data ?? [];
  const meta = members.data?.meta;

  const filtered = Boolean(query) || status !== null || Boolean(added.from);

  const columns = useMemo<Column<MemberSummary>[]>(
    () => [
      {
        key: 'name',
        header: 'Member',
        width: 200,
        // Frozen, so scrolling right to reach the shares column does not take
        // the name with it and leave figures belonging to nobody.
        frozen: true,
        render: (row) => <Cell bold>{row.name}</Cell>,
        sort: (row) => row.name,
      },
      {
        key: 'membership_no',
        header: 'No.',
        width: 90,
        render: (row) => (
          /*
            A dash rather than a blank. A member legitimately exists before the
            office assigns a number, and an empty cell reads as data that failed
            to load rather than as a state someone has to act on.
          */
          <Cell>{row.membership_no ?? '—'}</Cell>
        ),
        sort: (row) => row.membership_no ?? '',
      },
      {
        key: 'mobile',
        header: 'Mobile',
        width: 130,
        render: (row) => <Cell>{row.mobile}</Cell>,
        sort: (row) => row.mobile,
      },
      {
        key: 'status',
        header: 'Status',
        width: 150,
        render: (row) => <StatusBadge status={row.status} />,
        sort: (row) => row.status,
      },
      {
        key: 'shares',
        header: 'Shares',
        width: 90,
        align: 'right',
        // An integer, NOT money: a share is a unit of membership, and rendering
        // it through formatMoney would give it the same shape as an amount.
        render: (row) => <NumberCell>{String(row.shares)}</NumberCell>,
        sort: (row) => row.shares,
      },
    ],
    [],
  );

  return (
    <Screen onRefresh={() => void members.refetch()} refreshing={members.isRefetching}>
      <ScreenHeader
        title="Members"
        subtitle={
          meta && meta.total > 0
            ? `${meta.total}${filtered ? ' matching' : ' in this association'}`
            : undefined
        }
        action={
          can('members.create') ? (
            <Button size="sm" onPress={() => router.push('/staff/members/new')}>
              <Icon name="add" size={15} tone="inverse" />
              <Button.Label>Add member</Button.Label>
            </Button>
          ) : undefined
        }
      />

      <Section title="Members" first>
        {/*
          The toolbar sits OUTSIDE the StateView below it, and that is not a
          layout preference.

          StateView replaces its children with the empty state. With the
          filters inside it, narrowing a list to nothing took the controls
          away along with the rows - so a filter returning no matches could
          not be undone, and the only way out was to reload the page.
          Filtering into a dead end is precisely when those controls are
          needed most.
        */}
        <Toolbar
          filters={
            <>
              <SearchField
                value={search}
                onChangeText={setSearch}
                placeholder="Search name, no., mobile or email"
              />

              {/*
                A dropdown rather than a row of chips.

                Four chips is four controls competing for attention to
                express ONE decision, and only one of them can be true at a
                time - which is a select. It also stops the bar growing every
                time a status is added.
              */}
              <FilterSelect
                icon="members"
                width={190}
                options={STATUS_OPTIONS}
                value={status ?? 'all'}
                onChange={(next) => setStatus(next === 'all' ? null : (next as MemberStatus))}
              />

              {/*
                The range is on when the office ADDED the member, not on the
                society join date. join_date exists on the record but nothing
                populates it yet, and a filter that silently returns nothing
                because its column is empty is worse than one answering a
                slightly narrower question.
              */}
              <DateField
                  value={added.from && added.to ? added : draft}
                onChange={(next) => {
                  setDraft(next);

                  // Committed only once both ends are chosen: a half-drawn
                  // range would fetch "from X onwards" for a moment.
                  if (next.from && next.to) setAdded(next);
                }}
                placeholder="Added: any date"
                onClear={() => {
                  setAdded({});
                  setDraft({});
                }}
              />
            </>
          }
          actions={
            can('reports.export') ? (
              <ExportButtons
                path="/staff/members/export"
                name="members"
                scope="Every member matching these filters, not just this page."
                query={{
                  ...(query ? { q: query } : {}),
                  ...(status ? { status } : {}),
                  ...(added.from ? { from: added.from } : {}),
                  ...(added.to ? { to: added.to } : {}),
                  ...(sort ? { sort: sort.key, direction: sort.direction } : {}),
                }}
                disabled={members.isLoading || rows.length === 0}
              />
            ) : undefined
          }
        />

        <StateView
          loading={members.isLoading}
          error={members.error}
          empty={rows.length === 0}
          emptyTitle={filtered ? 'No matches' : 'No members yet'}
          emptyMessage={
            filtered
              ? 'No member matches this search and filter.'
              : 'Add the association’s first member to get started.'
          }
          onRetry={() => void members.refetch()}
        >
          <DataTable
            columns={columns}
            rows={rows}
            keyExtractor={(row) => row.id}
            onRowPress={(row) => router.push(`/staff/members/${row.id}`)}
            server={
              meta
                ? {
                    page: meta.current_page,
                    pageCount: meta.last_page,
                    total: meta.total,
                    // What the hook asks the API for. See ServerPaging.pageSize.
                    pageSize: 25,
                    onPageChange: setPage,
                    sort,
                    onSortChange: setSort,
                  }
                : undefined
            }
          />
        </StateView>
      </Section>
    </Screen>
  );
}

/**
 * Delays a value until it stops changing, so search does not fire per keystroke.
 *
 * useEffect, NOT useMemo. useMemo does not run the cleanup it is handed, so a
 * memo-based version cancels nothing: typing "Fatema" would schedule six
 * timeouts and fire all six. It would look like it worked - the final value is
 * still correct - while sending exactly the requests the debounce exists to
 * prevent.
 */
function useDebounced<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
