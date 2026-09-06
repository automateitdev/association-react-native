import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/errors';
import { useSession } from '@/features/auth/session';
import { useMembers } from '@/features/staff/members';
import {
  useMemberShares,
  useShareTransfers,
  useTransferShares,
  type ShareTransfer,
} from '@/features/staff/shares';
import {
  Amount,
  Button,
  Cell,
  DataTable,
  Form,
  FormActions,
  Icon,
  InputField,
  Panel,
  PickerField,
  Screen,
  ScreenHeader,
  Section,
  StateView,
  Text,
  Toolbar,
  humanDate,
  space,
  type,
  type Column,
  type SortState,
} from '@/ui';

/**
 * Share transfers between members (FR-SHR-3).
 *
 * THE SELLER IS CHOSEN FIRST, AND THEIR HOLDINGS DECIDE THE REST. Shares are
 * held per fee head, so "transfer 4 shares" is only meaningful once you know
 * which of the seller's holdings it comes out of. Picking the head before the
 * seller would offer heads they hold nothing in.
 *
 * WHAT THIS SCREEN DOES NOT DO: touch the ledger. Whatever the buyer paid the
 * seller is between them; the association took no money. The amount is recorded
 * because members ask what a transfer was worth, and it is shown here for the
 * same reason — not as income.
 */
export default function SharesScreen() {
  const { can } = useSession();

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>(null);
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const transfers = useShareTransfers(page);
  const rows = transfers.data?.data ?? [];
  const meta = transfers.data?.meta;

  const columns = useMemo<Column<ShareTransfer>[]>(
    () => [
      {
        key: 'transferred_on',
        header: 'Date',
        width: 120,
        frozen: true,
        render: (row) => <Cell bold>{row.transferred_on ? humanDate(row.transferred_on) : '—'}</Cell>,
      },
      {
        key: 'seller_name',
        header: 'From',
        width: 190,
        render: (row) => <Cell>{row.seller_name ?? '—'}</Cell>,
      },
      {
        key: 'buyer_name',
        header: 'To',
        width: 190,
        render: (row) => <Cell>{row.buyer_name ?? '—'}</Cell>,
      },
      {
        key: 'fee_head',
        header: 'Fee head',
        width: 170,
        render: (row) => <Cell>{row.fee_head ?? '—'}</Cell>,
      },
      {
        key: 'shares',
        header: 'Shares',
        width: 90,
        align: 'right',
        render: (row) => <Cell>{String(row.shares)}</Cell>,
      },
      {
        key: 'amount',
        header: 'Amount',
        width: 130,
        align: 'right',
        type: 'money',
        render: (row) => <Amount value={row.amount} />,
      },
    ],
    [],
  );

  return (
    <Screen onRefresh={() => void transfers.refetch()} refreshing={transfers.isRefetching}>
      <ScreenHeader
        title="Share transfers"
        subtitle={meta ? `${meta.total} recorded` : undefined}
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

      {done ? (
        <View style={{ marginTop: space.lg }}>
          <Panel>
            <Text style={type.body}>{done}</Text>
          </Panel>
        </View>
      ) : null}

      {transferring ? (
        <Section title="New transfer" first>
          <TransferForm
            onCancel={() => {
              setTransferring(false);
              setError(null);
            }}
            onDone={(message) => {
              setTransferring(false);
              setDone(message);
            }}
            onError={setError}
          />
        </Section>
      ) : null}

      <Section title="Transfers" first={! transferring}>
        <Toolbar
          filters={null}
          actions={
            can('shares.transfer') && ! transferring ? (
              <Button size="sm" onPress={() => { setTransferring(true); setDone(null); }}>
                <Icon name="add" size={15} tone="inverse" />
                <Button.Label>Record a transfer</Button.Label>
              </Button>
            ) : undefined
          }
        />

        <StateView
          loading={transfers.isLoading}
          error={transfers.error}
          empty={rows.length === 0}
          emptyTitle="No transfers"
          emptyMessage="Shares have not been moved between members."
          onRetry={() => void transfers.refetch()}
        >
          <DataTable
            columns={columns}
            rows={rows}
            keyExtractor={(row) => row.id}
            server={
              meta
                ? {
                    page: meta.current_page,
                    pageCount: meta.last_page,
                    total: meta.total,
                    pageSize: meta.per_page,
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

function TransferForm({
  onCancel,
  onDone,
  onError,
}: {
  onCancel: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  // Everyone, unpaginated concerns aside: a transfer needs to find any member,
  // and the picker is searchable by the label it builds.
  const members = useMembers({ q: '', status: null }, 1, null);
  const transfer = useTransferShares();

  const [sellerId, setSellerId] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [feeSetupId, setFeeSetupId] = useState('');
  const [shares, setShares] = useState('');
  const [amount, setAmount] = useState('');

  // The seller's holdings decide which heads can be chosen and how many.
  const holdings = useMemberShares(sellerId === '' ? null : Number(sellerId));

  const memberOptions = (members.data?.data ?? []).map((m) => ({
    value: String(m.id),
    label: m.membership_no ? `${m.name} (${m.membership_no})` : m.name,
  }));

  const headOptions = (holdings.data?.by_head ?? []).map((h) => ({
    value: String(h.fee_setup_id),
    // The count is in the label because it is the constraint on the next field.
    label: `${h.fee_head} — ${h.shares} held`,
  }));

  const held = holdings.data?.by_head.find((h) => String(h.fee_setup_id) === feeSetupId)?.shares ?? 0;
  const wanted = Number(shares || 0);

  const complete =
    sellerId !== '' &&
    buyerId !== '' &&
    buyerId !== sellerId &&
    feeSetupId !== '' &&
    wanted > 0 &&
    wanted <= held;

  const submit = async () => {
    try {
      const result = await transfer.mutateAsync({
        seller_id: Number(sellerId),
        buyer_id: Number(buyerId),
        fee_setup_id: Number(feeSetupId),
        shares: wanted,
        amount: amount.trim() === '' ? 0 : Number(amount),
      });

      onDone(
        `${result.shares} share(s) moved. The seller now holds ${result.seller_balance}, the buyer ${result.buyer_balance}.`,
      );
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'The transfer could not be recorded.');
    }
  };

  return (
    <Form dense>
      <PickerField
        label="From"
        options={memberOptions}
        value={sellerId}
        onChange={(value) => {
          setSellerId(value);
          // Their holdings differ, so a head chosen for the last seller is
          // meaningless now.
          setFeeSetupId('');
        }}
        required
      />

      <PickerField
        label="Fee head"
        options={headOptions}
        value={feeSetupId}
        onChange={setFeeSetupId}
        required
        hint={
          sellerId === ''
            ? 'Choose who the shares come from first.'
            : headOptions.length === 0
              ? 'This member holds no shares.'
              : undefined
        }
      />

      <PickerField
        label="To"
        options={memberOptions.filter((o) => o.value !== sellerId)}
        value={buyerId}
        onChange={setBuyerId}
        required
      />

      <InputField
        label="Shares"
        value={shares}
        onChangeText={setShares}
        keyboardType="phone-pad"
        required
        hint={
          feeSetupId === ''
            ? undefined
            : wanted > held
              ? `Only ${held} held — the transfer would be refused.`
              : `${held} available.`
        }
      />

      <InputField
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="phone-pad"
        hint="What the buyer paid, if anything. Recorded for the members' sake — it is not association income and posts nothing to the ledger."
      />

      <FormActions>
        <Button variant="secondary" onPress={onCancel}>
          <Button.Label>Cancel</Button.Label>
        </Button>
        <Button isDisabled={! complete || transfer.isPending} onPress={() => void submit()}>
          <Button.Label>{transfer.isPending ? 'Saving…' : 'Record transfer'}</Button.Label>
        </Button>
      </FormActions>
    </Form>
  );
}
