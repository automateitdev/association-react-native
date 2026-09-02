import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSession } from '@/features/auth/session';
import { useMembers, type MemberStatus, type MemberSummary } from '@/features/staff/members';
import {
  Button,
  Chip,
  Input,
  Row,
  Screen,
  ScreenHeader,
  Section,
  StateView,
  StatusBadge,
  TextField,
  space,
} from '@/ui';

/**
 * The member list.
 *
 * A row per member separated by a hairline, rather than the card-per-member the
 * first version used: eight members meant eight bordered, filled boxes stacked
 * with gaps - roughly forty edges on screen to communicate eight things.
 *
 * Search and the status filter are sent to the SERVER, not applied to a loaded
 * page. Filtering client-side would silently only search whatever happened to
 * be fetched, so a member on page three would appear not to exist - the kind of
 * bug that looks like missing data rather than a broken filter.
 */
export default function MembersScreen() {
  const { can } = useSession();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<MemberStatus | null>(null);

  /*
   * Debounced, so typing does not fire a request per keystroke. 300ms is short
   * enough to feel immediate and long enough that "Fatema" is one query.
   */
  const query = useDebounced(search, 300);

  const filters = useMemo(() => ({ q: query || undefined, status }), [query, status]);
  const members = useMembers(filters);

  const rows = useMemo(
    () => members.data?.pages.flatMap((page) => page.data) ?? [],
    [members.data],
  );

  const total = members.data?.pages[0]?.meta.total ?? 0;
  const filtered = Boolean(query) || status !== null;

  return (
    <Screen onRefresh={() => void members.refetch()} refreshing={members.isRefetching}>
      <ScreenHeader
        title="Members"
        subtitle={
          total > 0 ? `${total}${filtered ? ' matching' : ' in this association'}` : undefined
        }
        action={
          can('members.create') ? (
            <Button onPress={() => router.push('/staff/members/new')}>
              <Button.Label>Add</Button.Label>
            </Button>
          ) : undefined
        }
      />

      <View style={{ marginTop: space.lg, gap: space.md }}>
        <TextField>
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, mobile or email"
            autoCapitalize="none"
          />
        </TextField>

        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <FilterChip label="All" active={status === null} onPress={() => setStatus(null)} />
          <FilterChip
            label="Active"
            active={status === 'active'}
            onPress={() => setStatus('active')}
          />
          <FilterChip
            label="Awaiting approval"
            active={status === 'inactive'}
            onPress={() => setStatus('inactive')}
          />
          <FilterChip
            label="Suspended"
            active={status === 'suspended'}
            onPress={() => setStatus('suspended')}
          />
        </View>
      </View>

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
        <Section first>
          {rows.map((member, index) => (
            <MemberRow key={member.id} member={member} divider={index < rows.length - 1} />
          ))}
        </Section>

        {members.hasNextPage ? (
          <View style={{ marginTop: space.lg }}>
            <Button
              variant="secondary"
              isDisabled={members.isFetchingNextPage}
              onPress={() => void members.fetchNextPage()}
            >
              <Button.Label>{members.isFetchingNextPage ? 'Loading…' : 'Load more'}</Button.Label>
            </Button>
          </View>
        ) : null}
      </StateView>
    </Screen>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Chip variant={active ? 'primary' : 'secondary'}>
        <Chip.Label>{label}</Chip.Label>
      </Chip>
    </Pressable>
  );
}

function MemberRow({ member, divider }: { member: MemberSummary; divider: boolean }) {
  return (
    <Row
      title={member.name}
      meta={[
        // "No number yet" rather than a blank: it is a real state the office has
        // to act on, not missing data.
        member.membership_no ? `No. ${member.membership_no}` : 'No number yet',
        member.mobile,
        `${member.shares} share${member.shares === 1 ? '' : 's'}`,
      ].join(' · ')}
      trailing={<StatusBadge status={member.status} />}
      onPress={() => router.push(`/staff/members/${member.id}`)}
      divider={divider}
    />
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
