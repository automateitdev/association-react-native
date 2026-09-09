import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/errors';
import { useSession } from '@/features/auth/session';
import { useMemberOptions } from '@/features/staff/members';
import {
  useMemberShares,
  useShareTransfers,
  useTransferShares,
  type ShareTransfer,
} from '@/features/staff/shares';
import { formatMoney } from '@/api/money';
import {
  Amount,
  Button,
  Cell,
  DataTable,
  Field,
  Form,
  FormActions,
  Icon,
  InputField,
  Panel,
  PickerField,
  Row,
  Screen,
  ScreenHeader,
  Section,
  StateView,
  Text,
  Toolbar,
  humanDate,
  todayIso,
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
      {
        // Last and widest: it is a sentence, and it is the column somebody
        // reads when they are asking why rather than how much.
        key: 'note',
        header: 'Why',
        width: 260,
        render: (row) => <Cell>{row.note ?? '—'}</Cell>,
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

      {/* Headed only while the transfer form is open above it; otherwise the
          page header has already said Share transfers. */}
      <Section title={transferring ? 'Transfers' : undefined} first={! transferring}>
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

/**
 * One transfer document: one seller, one date, one reason, any number of buyers.
 *
 * THE SHAPE IS THE LEGACY SCREEN'S, and it was not decoration there. A member
 * disposing of a holding splits it between several people on one day for one
 * reason - between two sons, across a family. The rewrite had narrowed this to
 * a single pair, which turns one decision into three unrelated records that
 * only look connected because their dates match, and gives an officer three
 * chances to overdraw a holding that each request thinks is intact.
 *
 * What is deliberately NOT carried over: the legacy's free "Amount" column,
 * which was auto-filled and read-only there and is not sent at all here. The
 * server computes it from the fee head. It reaches the member's statement and
 * the paid report, so it cannot be whatever reached the input.
 */
function TransferForm({
  onCancel,
  onDone,
  onError,
}: {
  onCancel: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const transfer = useTransferShares();

  const [sellerId, setSellerId] = useState('');
  const [date, setDate] = useState(todayIso() as string);
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<BuyerRow[]>([blankRow()]);

  // The seller's holdings decide which heads can be chosen, how many of each,
  // and what they are worth.
  const holdings = useMemberShares(sellerId === '' ? null : Number(sellerId));
  const byHead = holdings.data?.by_head ?? [];

  /**
   * What is left of a head after the OTHER rows have claimed their share.
   *
   * Without this each row offers the whole holding and two rows of six out of
   * ten both look fine until the server refuses the document. The legacy
   * screen tracked the same figure and put it in the dropdown label.
   */
  const remainingFor = (feeSetupId: string, exceptIndex: number) => {
    const held = byHead.find((h) => String(h.fee_setup_id) === feeSetupId)?.shares ?? 0;

    const claimed = rows.reduce(
      (sum, row, index) =>
        index === exceptIndex || row.feeSetupId !== feeSetupId
          ? sum
          : sum + (Number(row.shares) || 0),
      0,
    );

    return held - claimed;
  };

  const priceOf = (feeSetupId: string) =>
    byHead.find((h) => String(h.fee_setup_id) === feeSetupId)?.price ?? '0.00';

  const rowAmount = (row: BuyerRow) => {
    const count = Number(row.shares) || 0;
    if (count <= 0 || row.feeSetupId === '') return '0.00';

    // Two decimals, and the arithmetic done in paisa: a price of 33.33 times
    // three instalments must not arrive as 99.99000000000001.
    return (Math.round(Number(priceOf(row.feeSetupId)) * count * 100) / 100).toFixed(2);
  };

  const totalShares = rows.reduce((sum, row) => sum + (Number(row.shares) || 0), 0);
  const totalAmount = rows
    .reduce((sum, row) => sum + Number(rowAmount(row)), 0)
    .toFixed(2);

  const setRow = (index: number, patch: Partial<BuyerRow>) =>
    setRows((was) => was.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const rowComplete = (row: BuyerRow, index: number) =>
    row.buyerId !== '' &&
    row.buyerId !== sellerId &&
    row.feeSetupId !== '' &&
    Number(row.shares) > 0 &&
    Number(row.shares) <= remainingFor(row.feeSetupId, index);

  // The same buyer twice for one head is two rows that should have been one -
  // refused by the server, and worth saying before it is sent.
  const duplicates = new Set(
    rows
      .map((row) => `${row.buyerId}:${row.feeSetupId}`)
      .filter((pair, index, all) => pair !== ':' && all.indexOf(pair) !== index),
  );

  const complete =
    sellerId !== '' &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    rows.length > 0 &&
    duplicates.size === 0 &&
    rows.every(rowComplete);

  const submit = async () => {
    try {
      const result = await transfer.mutateAsync({
        seller_id: Number(sellerId),
        transferred_on: date,
        note: note.trim() === '' ? undefined : note.trim(),
        transfers: rows.map((row) => ({
          buyer_id: Number(row.buyerId),
          fee_setup_id: Number(row.feeSetupId),
          shares: Number(row.shares),
        })),
      });

      onDone(
        `${result.shares} instalment(s) moved to ${result.transfers.length} member(s). The seller now holds ${result.seller_balance}.`,
      );
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'The transfer could not be recorded.');
    }
  };

  return (
    <View>
      <Form dense maxWidth={null} columns={3}>
        <MemberPicker
          label="From"
          value={sellerId}
          onChange={(value) => {
            setSellerId(value);
            // Their holdings differ, so heads chosen for the last seller are
            // meaningless now. The buyers go with them.
            setRows([blankRow()]);
          }}
        />

        {/*
          A plain field rather than DateField: that one picks a RANGE by
          design, which is right for a report period and wrong for the day a
          transfer happened. Same shape the member form uses for "Joined".
        */}
        <InputField
          label="Transfer date"
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          required
        />

        {/*
          Optional, and worth asking for anyway.

          It is printed on every statement this document touches, so it is the
          only place the answer to "why do these instalments belong to somebody
          else now" is ever written down. Requiring it would produce the word
          "transfer" a thousand times, which answers nothing.
        */}
        <InputField
          label="Why"
          value={note}
          onChangeText={setNote}
          hint="Shown on both members' statements — an inheritance, a gift within a family, a settlement."
        />
      </Form>

      {/*
        WHAT THE SELLER ACTUALLY HAS, shown before anyone is asked how much to
        move. The legacy screen opens this table as soon as a seller is chosen,
        and it is the difference between choosing a number and guessing one.
      */}
      {sellerId !== '' ? (
        <View style={{ marginTop: space.md }}>
          <Text tone="muted" style={type.section}>
            WHAT THIS MEMBER HOLDS
          </Text>

          <StateView loading={holdings.isLoading} error={holdings.error}>
            {byHead.length === 0 ? (
              <Panel>
                <Text style={type.body}>
                  This member holds no instalments, so there is nothing to transfer.
                </Text>
              </Panel>
            ) : (
              byHead.map((head, index) => (
                <Row
                  key={head.fee_setup_id}
                  title={head.fee_head}
                  meta={`${formatMoney(head.price)} per instalment`}
                  trailing={
                    <Text style={type.rowTitle}>
                      {remainingFor(String(head.fee_setup_id), -1)} left of {head.shares}
                    </Text>
                  }
                  divider={index < byHead.length - 1}
                />
              ))
            )}
          </StateView>
        </View>
      ) : null}

      {/* ---------------------------------------------------------- buyers */}
      <View style={{ marginTop: space.lg }}>
        <Text tone="muted" style={type.section}>
          WHO RECEIVES THEM
        </Text>

        {sellerId === '' ? (
          <Panel>
            <Text tone="muted" style={type.body}>
              Choose who the instalments come from first.
            </Text>
          </Panel>
        ) : (
          <>
            {rows.map((row, index) => (
              <View
                key={row.key}
                style={{
                  marginTop: index === 0 ? 0 : space.md,
                  paddingTop: index === 0 ? 0 : space.md,
                  borderTopWidth: index === 0 ? 0 : 1,
                }}
                className={index === 0 ? undefined : 'border-border'}
              >
                <Form dense maxWidth={null} columns={4}>
                  <MemberPicker
                    label="Buyer"
                    value={row.buyerId}
                    onChange={(value) => setRow(index, { buyerId: value })}
                    exclude={sellerId}
                    error={
                      duplicates.has(`${row.buyerId}:${row.feeSetupId}`)
                        ? 'Already receiving this fee head on another line — combine them.'
                        : undefined
                    }
                  />

                  <PickerField
                    label="Fee head"
                    /*
                      Heads with nothing left are dropped, exactly as the legacy
                      dropdown drops them - except the one this row already
                      holds, or choosing it would make the row unreadable.
                    */
                    options={byHead
                      .filter(
                        (head) =>
                          remainingFor(String(head.fee_setup_id), index) > 0 ||
                          String(head.fee_setup_id) === row.feeSetupId,
                      )
                      .map((head) => ({
                        value: String(head.fee_setup_id),
                        label: `${head.fee_head} — ${remainingFor(String(head.fee_setup_id), index)} left`,
                      }))}
                    value={row.feeSetupId}
                    onChange={(value) => setRow(index, { feeSetupId: value, shares: '' })}
                    required
                  />

                  <InputField
                    label="Instalments"
                    value={row.shares}
                    onChangeText={(value) => setRow(index, { shares: value })}
                    keyboardType="phone-pad"
                    required
                    hint={
                      row.feeSetupId === ''
                        ? undefined
                        : Number(row.shares) > remainingFor(row.feeSetupId, index)
                          ? `Only ${remainingFor(row.feeSetupId, index)} left — this would be refused.`
                          : `${remainingFor(row.feeSetupId, index)} available.`
                    }
                  />

                  {/*
                    Shown, never entered. It is the value of the instalments
                    moving, and the server computes the same figure from the
                    same fee head - this is a preview of that, not an input the
                    officer can disagree with.
                  */}
                  <Field label="Worth" value={formatMoney(rowAmount(row))} />
                </Form>

                {rows.length > 1 ? (
                  <View style={{ alignItems: 'flex-start', marginTop: space.xs }}>
                    <Button
                      size="sm"
                      variant="tertiary"
                      onPress={() => setRows((was) => was.filter((_, i) => i !== index))}
                    >
                      <Icon name="close" size={14} tone="danger" />
                      <Button.Label>Remove</Button.Label>
                    </Button>
                  </View>
                ) : null}
              </View>
            ))}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: space.sm,
                marginTop: space.md,
              }}
            >
              <Button size="sm" variant="secondary" onPress={() => setRows((was) => [...was, blankRow()])}>
                <Icon name="add" size={15} tone="muted" />
                <Button.Label>Add another buyer</Button.Label>
              </Button>

              {/*
                The document's totals, which the legacy screen keeps in the
                table footer. With several rows, the only figure anybody checks
                before pressing the button is the one at the bottom.
              */}
              <Text tone="muted" style={type.rowMeta}>
                {totalShares} instalment(s) · {formatMoney(totalAmount)}
              </Text>
            </View>
          </>
        )}
      </View>

      <FormActions>
        <Button variant="secondary" onPress={onCancel}>
          <Button.Label>Cancel</Button.Label>
        </Button>
        <Button isDisabled={! complete || transfer.isPending} onPress={() => void submit()}>
          <Button.Label>{transfer.isPending ? 'Saving…' : 'Record transfer'}</Button.Label>
        </Button>
      </FormActions>
    </View>
  );
}

/** One line of the document: who receives what, and how much of it. */
type BuyerRow = {
  /** Stable across removals, so React does not reuse a removed row's state. */
  key: string;
  buyerId: string;
  feeSetupId: string;
  shares: string;
};

let rowSequence = 0;

function blankRow(): BuyerRow {
  rowSequence += 1;

  return { key: `row-${rowSequence}`, buyerId: '', feeSetupId: '', shares: '' };
}

/**
 * A member chosen by searching, not by scrolling.
 *
 * WHY THIS EXISTS. The form used `useMembers(..., page 1)`, which returns the
 * first 25 members and no indication that there are more. On this association
 * that is 25 of 45; on a real one it is 25 of several hundred, and the twenty-
 * sixth member alphabetically simply cannot be given or sold anything. Nothing
 * on screen said so - the menu just ended.
 *
 * The legacy screen got this right: its two selects are server-searched
 * autocompletes that reach every member on file. This is the same arrangement -
 * each picker holds its own search text and asks the server, exactly as each
 * select2 on that page did.
 */
function MemberPicker({
  label,
  value,
  onChange,
  exclude,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** The seller. Nobody can transfer to themselves, so they are not offered. */
  exclude?: string;
  error?: string;
}) {
  const [query, setQuery] = useState('');
  const members = useMemberOptions(useMemo(() => ({ q: query || undefined }), [query]));

  const options = useMemo(
    () =>
      (members.data?.pages.flatMap((page) => page.data) ?? [])
        .filter((m) => String(m.id) !== exclude)
        .map((m) => ({
          value: String(m.id),
          // The membership number is in the label because two members share a
          // name more often than anybody expects, and it is what the office
          // says out loud.
          label: m.membership_no ? `${m.name} (${m.membership_no})` : m.name,
        })),
    [members.data, exclude],
  );

  return (
    <PickerField
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      required
      error={error}
      // Server-searched: `search` carries the text and `onSearchChange` says
      // the caller is doing the matching, so the menu does not filter twice.
      search={query}
      onSearchChange={setQuery}
      searchPlaceholder="Name or member no."
    />
  );
}
