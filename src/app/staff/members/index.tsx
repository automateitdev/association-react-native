import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSession } from '@/features/auth/session';
import { useMembers, type MemberStatus, type MemberSummary } from '@/features/staff/members';
import {
  Button,
  Card,
  Chip,
  Input,
  Screen,
  StateView,
  StatusBadge,
  Text,
  TextField,
} from '@/ui';

/**
 * The member list.
 *
 * A card per member rather than a table - the precedent set by the approval
 * queue, and the right answer at 375pt. HeroUI Native has no table and no
 * pagination control (R-1); "load more" replaces the latter and is the better
 * phone pattern regardless.
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
   * Debounced, so typing does not fire a request per keystroke.
   *
   * 300ms is short enough to feel immediate and long enough that "Fatema" is
   * one query rather than six.
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
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Members</Text>

        {can('members.create') ? (
          <Button onPress={() => router.push('/staff/members/new')}>
            <Button.Label>Add</Button.Label>
          </Button>
        ) : null}
      </View>

      <TextField>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, mobile or email"
          autoCapitalize="none"
        />
      </TextField>

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <StatusChip label="All" active={status === null} onPress={() => setStatus(null)} />
        <StatusChip
          label="Active"
          active={status === 'active'}
          onPress={() => setStatus('active')}
        />
        <StatusChip
          label="Awaiting approval"
          active={status === 'inactive'}
          onPress={() => setStatus('inactive')}
        />
        <StatusChip
          label="Suspended"
          active={status === 'suspended'}
          onPress={() => setStatus('suspended')}
        />
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
        <Text style={{ opacity: 0.7 }}>
          {total} member{total === 1 ? '' : 's'}
          {filtered ? ' matching' : ''}
        </Text>

        {rows.map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}

        {members.hasNextPage ? (
          <Button
            variant="secondary"
            isDisabled={members.isFetchingNextPage}
            onPress={() => void members.fetchNextPage()}
          >
            <Button.Label>{members.isFetchingNextPage ? 'Loading…' : 'Load more'}</Button.Label>
          </Button>
        ) : null}
      </StateView>
    </Screen>
  );
}

function StatusChip({
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

function MemberCard({ member }: { member: MemberSummary }) {
  return (
    <Pressable onPress={() => router.push(`/staff/members/${member.id}`)}>
      <Card>
        <Card.Body style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontWeight: '600' }}>{member.name}</Text>
              <Text style={{ opacity: 0.7, fontSize: 12 }}>
                {member.membership_no ?? 'No membership no.'} · {member.mobile}
              </Text>
            </View>

            <StatusBadge status={member.status} />
          </View>

          <Text style={{ opacity: 0.7, fontSize: 12 }}>
            {member.shares} share{member.shares === 1 ? '' : 's'}
          </Text>
        </Card.Body>
      </Card>
    </Pressable>
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
