import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { formatMoney } from '@/api/money';
import { useSession } from '@/features/auth/session';
import {
  newIdempotencyKey,
  useCollect,
  useMemberDues,
  type DueLine,
} from '@/features/staff/collections';
import { useLedgers } from '@/features/staff/fees';
import { useMembers } from '@/features/staff/members';
import {
  Button,
  Cell,
  Checkbox,
  DataTable,
  Divider,
  FilterSelect,
  Icon,
  NumberCell,
  Panel,
  Row,
  Screen,
  ScreenHeader,
  SearchField,
  Section,
  StateView,
  Text,
  Toolbar,
  space,
  type,
  type Column,
} from '@/ui';

/**
 * The counter: take a member's money.
 *
 * ITS OWN TAB, not a corner of the Fees screen, because of who uses it. A
 * cashier's role is `collections.*` and `members.view` - no fee setup, no
 * reports - so anything reached through Fees would be unreachable for exactly
 * the person doing this all day.
 *
 * IT DOES NOT SAY "PAID". The payment is created pending and goes to the
 * approvals queue (FR-PAY-2), which is the association's cash control - the
 * person who takes the money is not the person who confirms it. A screen that
 * showed "payment complete" would be describing something that has not
 * happened yet, and the receipt is not available until it has.
 */
export default function CollectScreen() {
  const { can } = useSession();

  const [search, setSearch] = useState('');
  const [memberId, setMemberId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [ledgerId, setLedgerId] = useState<string | null>(null);
  const [done, setDone] = useState<{ invoice: string; total: string } | null>(null);

  /*
   * One key per ATTEMPT, generated when the member is chosen and kept until the
   * collection succeeds. Regenerating it per press would defeat the whole
   * mechanism - at a counter that means taking the money twice.
   */
  const [attemptKey, setAttemptKey] = useState(() => newIdempotencyKey());

  const query = useDebounced(search, 300);

  const members = useMembers(
    useMemo(() => ({ q: query || undefined, status: null }), [query]),
    1,
    null,
  );

  const dues = useMemberDues(memberId);
  const collect = useCollect();

  // Where the money went. Asset accounts only - a cash box or a bank account,
  // never an income ledger, which is the other half of the entry.
  const ledgers = useLedgers('asset');

  const lines = dues.data?.data ?? [];
  const meta = dues.data?.meta;

  // Choosing a different member starts a different collection.
  useEffect(() => {
    setSelected(new Set());
    setDone(null);
    setAttemptKey(newIdempotencyKey());
  }, [memberId]);

  /*
   * Only UNPAID lines can be collected.
   *
   * An instalment already on a pending payment comes back as `Requested` and
   * still appears here - it is genuinely still outstanding, so the dues
   * endpoint is right to list it. But ticking it again would build a
   * collection the server refuses, and the clerk would have no idea why. It is
   * shown, labelled, and not selectable.
   */
  const collectable = (line: DueLine) => line.status === 'Unpaid';

  const toggle = (id: number) => {
    const line = lines.find((l) => l.fee_assign_id === id);
    if (line && ! collectable(line)) return;

    setSelected((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const columns = useMemo<Column<DueLine>[]>(
    () => [
      {
        key: 'select',
        header: '',
        width: 46,
        frozen: true,
        render: (row) => (
          <Checkbox
            isSelected={selected.has(row.fee_assign_id)}
            isDisabled={! collectable(row)}
            onSelectedChange={() => toggle(row.fee_assign_id)}
          />
        ),
      },
      {
        key: 'fee_head',
        header: 'Fee head',
        width: 180,
        frozen: true,
        render: (row) => <Cell bold>{row.fee_head}</Cell>,
        sort: (row) => row.fee_head,
      },
      {
        key: 'period',
        header: 'Period',
        width: 100,
        render: (row) => <Cell>{row.period}</Cell>,
        sort: (row) => row.period,
      },
      /*
       * Instalment and fine as separate columns, and the server's totals row
       * beneath. Nothing on this screen adds anything up - see the note in
       * ui/DataTable.
       */
      {
        key: 'status',
        header: 'Status',
        width: 130,
        render: (row) =>
          collectable(row) ? (
            <Cell>Outstanding</Cell>
          ) : (
            /*
              Named rather than left blank. "Already submitted" tells the clerk
              the money is accounted for and waiting on approval, which is the
              answer to "why can I not tick this".
            */
            <Text tone="muted" numberOfLines={1} style={type.body}>
              Awaiting approval
            </Text>
          ),
        sort: (row) => row.status,
      },
      {
        key: 'instalment',
        header: 'Instalment',
        width: 130,
        align: 'right',
        render: (row) => <NumberCell>{formatMoney(row.instalment_amount)}</NumberCell>,
        sort: (row) => row.instalment_amount,
        sortType: 'decimal',
        total: meta ? <NumberCell bold>{formatMoney(meta.instalment_total)}</NumberCell> : undefined,
      },
      {
        key: 'fine',
        header: 'Fine',
        width: 120,
        align: 'right',
        render: (row) => <NumberCell>{formatMoney(row.fine_amount)}</NumberCell>,
        sort: (row) => row.fine_amount,
        sortType: 'decimal',
        total: meta ? <NumberCell bold>{formatMoney(meta.fine_total)}</NumberCell> : undefined,
      },
      {
        key: 'total',
        header: 'Due',
        width: 130,
        align: 'right',
        render: (row) => <NumberCell bold>{formatMoney(row.total_due)}</NumberCell>,
        sort: (row) => row.total_due,
        sortType: 'decimal',
        total: meta ? <NumberCell bold>{formatMoney(meta.grand_total)}</NumberCell> : undefined,
      },
    ],
    [meta, selected, lines],
  );

  const submit = async () => {
    if (memberId === null || ledgerId === null || selected.size === 0) return;

    try {
      const collection = await collect.mutateAsync({
        memberId,
        feeAssignIds: [...selected],
        ledgerId: Number(ledgerId),
        idempotencyKey: attemptKey,
      });

      setDone({ invoice: collection.invoice_no, total: collection.total_amount });
      setSelected(new Set());

      // The next collection is a new attempt and needs its own key.
      setAttemptKey(newIdempotencyKey());
    } catch {
      // Surfaced by the mutation's error state below.
    }
  };

  return (
    <Screen onRefresh={() => void dues.refetch()} refreshing={dues.isRefetching}>
      <ScreenHeader
        title="Collect"
        subtitle={meta ? `${meta.member_name}${meta.membership_no ? ` · No. ${meta.membership_no}` : ''}` : 'Take a payment at the counter'}
      />

      {done ? (
        <View style={{ marginTop: space.lg }}>
          <Panel>
            <Text style={type.rowTitle}>Recorded as {done.invoice}</Text>
            {/*
              "Awaiting approval", not "paid". The money is in the drawer; the
              association has not confirmed it yet, and the receipt is not
              available until it has.
            */}
            <Text style={type.body}>
              {formatMoney(done.total)} taken, awaiting approval. It is in the
              approvals queue now, and the receipt can be printed once approved.
            </Text>
            <Button variant="secondary" size="sm" onPress={() => setDone(null)}>
              <Button.Label>Dismiss</Button.Label>
            </Button>
          </Panel>
        </View>
      ) : null}

      {collect.isError ? (
        <View style={{ marginTop: space.lg }}>
          <Panel tone="danger">
            <Text style={type.rowTitle}>The collection was not recorded</Text>
            <Text style={type.body}>
              {collect.error instanceof Error
                ? collect.error.message
                : 'Nothing was taken. Check the details and try again.'}
            </Text>
          </Panel>
        </View>
      ) : null}

      <Section title="Who is paying" first>
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or membership no."
          width={320}
        />

        {/*
          The list appears only while searching. A counter clerk knows who is in
          front of them; showing three hundred members by default would make
          them scroll past everybody to reach a search box.
        */}
        {query ? (
          <View style={{ marginTop: space.md }}>
            <StateView
              loading={members.isLoading}
              error={members.error}
              empty={(members.data?.data.length ?? 0) === 0}
              emptyTitle="No matches"
              emptyMessage="No member matches that name or number."
              onRetry={() => void members.refetch()}
            >
              {(members.data?.data ?? []).slice(0, 8).map((member, index, all) => (
                <Row
                  key={member.id}
                  title={member.name}
                  meta={[
                    member.membership_no ? `No. ${member.membership_no}` : 'No number yet',
                    member.mobile,
                  ].join(' · ')}
                  trailing={
                    memberId === member.id ? <Icon name="check" size={16} tone="accent" /> : undefined
                  }
                  onPress={() => {
                    setMemberId(member.id);
                    setSearch('');
                  }}
                  divider={index < all.length - 1}
                />
              ))}
            </StateView>
          </View>
        ) : null}
      </Section>

      {memberId === null ? (
        <Section title="Then what they owe">
          <Text tone="muted" style={type.body}>
            Search for a member above to see their outstanding instalments.
          </Text>
        </Section>
      ) : (
        <Section title="What they owe">
          <Toolbar
            filters={
              <FilterSelect
                icon="bank"
                width={230}
                options={(ledgers.data ?? []).map((l) => ({ value: String(l.id), label: l.name }))}
                value={ledgerId ?? ''}
                onChange={setLedgerId}
              />
            }
          />

          {/*
            Said plainly, because it is the one thing a receiving account
            silently gets wrong. The fee head decides which income account the
            instalment credits; this is the other half - where the cash landed.
          */}
          <Text tone="muted" style={{ ...type.rowMeta, marginBottom: space.md }}>
            Choose the account the money went into - the cash box or the bank.
          </Text>

          <StateView
            loading={dues.isLoading}
            error={dues.error}
            empty={lines.length === 0}
            emptyTitle="Nothing outstanding"
            emptyMessage="This member has no unpaid instalments."
            onRetry={() => void dues.refetch()}
          >
            <DataTable
              columns={columns}
              rows={lines}
              keyExtractor={(row) => row.fee_assign_id}
              totalsLabelKey="fee_head"
              totalsLabel="Total owed"
              onRowPress={(row) => toggle(row.fee_assign_id)}
              pageSize={0}
            />
          </StateView>
        </Section>
      )}

      {selected.size > 0 && can('collections.create') ? (
        <View style={{ marginTop: space.xl }}>
          <Panel>
            <Text style={type.rowTitle}>
              {selected.size} instalment{selected.size === 1 ? '' : 's'} selected
            </Text>

            <Divider />

            {/*
              NO TOTAL FOR THE SELECTION, and its absence is deliberate.

              Adding up the chosen lines would mean this screen doing money
              arithmetic, which is the class of bug the platform was rebuilt to
              remove. The server returns the figures the moment the collection
              is recorded, and those are what the receipt carries.
            */}
            <Text tone="muted" style={type.rowMeta}>
              The amount is calculated by the server when the collection is
              recorded, and shown on the receipt.
            </Text>

            <Button
              isDisabled={ledgerId === null || collect.isPending}
              onPress={() => void submit()}
            >
              <Button.Label>
                {collect.isPending
                  ? 'Recording…'
                  : ledgerId === null
                    ? 'Choose a receiving account first'
                    : `Record collection`}
              </Button.Label>
            </Button>
          </Panel>
        </View>
      ) : null}
    </Screen>
  );
}

/**
 * Delays a value until it stops changing, so search does not fire per keystroke.
 *
 * useEffect, NOT useMemo - useMemo does not run the cleanup it is handed, so a
 * memo-based version cancels nothing and fires once per character.
 */
function useDebounced<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
