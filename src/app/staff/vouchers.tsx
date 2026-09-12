import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/errors';
import { useSession } from '@/features/auth/session';
import { useLedgers } from '@/features/staff/ledgers';
import {
  useDecideVoucher,
  useDeleteVoucher,
  useReverseVoucher,
  useSaveVoucher,
  useVouchers,
  type Voucher,
} from '@/features/staff/vouchers';
import {
  Amount,
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
  PickerField,
  Screen,
  ScreenHeader,
  Section,
  space,
  Spacer,
  Stack,
  StateView,
  Text,
  Toolbar,
  type,
} from '@/ui';

/**
 * Manual accounting documents (FR-ACC-4).
 *
 * NOT A TABLE. A voucher is a document with a variable number of lines, and
 * what a reader needs is the lines themselves — which account, which side, how
 * much. Flattening that into a row would put the interesting part behind a tap.
 *
 * THE BALANCE IS SHOWN, NEVER COMPUTED HERE. Both totals come from the server
 * (FR-MON-4), and the difference is displayed while a draft is being written
 * because "out by 400" is the fastest route to the wrong line. The server
 * decides whether it balances; this only reports what it said.
 */
export default function VouchersScreen() {
  const { can } = useSession();

  const [status, setStatus] = useState('draft');
  const [page, setPage] = useState(1);
  const [writing, setWriting] = useState(false);
  const [reversing, setReversing] = useState<Voucher | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vouchers = useVouchers(status, page);
  const decide = useDecideVoucher();
  const remove = useDeleteVoucher();
  const reverse = useReverseVoucher();

  const rows = vouchers.data?.data ?? [];
  const meta = vouchers.data?.meta;

  const run = async (work: () => Promise<unknown>) => {
    setError(null);

    try {
      await work();
      setReversing(null);
    } catch (e) {
      // The server's refusals name the line and the difference, so they are
      // shown as they are rather than replaced with something vaguer.
      setError(e instanceof ApiError ? e.message : 'That could not be done.');
    }
  };

  return (
    <Screen onRefresh={() => void vouchers.refetch()} refreshing={vouchers.isRefetching}>
      <ScreenHeader
        title="Vouchers"
        subtitle={meta ? `${meta.drafts} draft${meta.drafts === 1 ? '' : 's'}` : undefined}
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

      {writing ? (
        <Section title="New voucher" first>
          <VoucherForm
            onCancel={() => {
              setWriting(false);
              setError(null);
            }}
            onDone={() => setWriting(false)}
            onError={setError}
          />
        </Section>
      ) : null}

      {reversing ? (
        <Section title={`Reverse ${reversing.voucher_no}`} first>
          <ReverseForm
            voucher={reversing}
            pending={reverse.isPending}
            onCancel={() => {
              setReversing(null);
              setError(null);
            }}
            onSubmit={(reason) => void run(() => reverse.mutateAsync({ id: reversing.id, reason }))}
          />
        </Section>
      ) : null}

      {/*
        Headed only while a form is open above it - the same condition as
        `first`, inverted. With "New voucher" on screen the list needs telling
        apart from it; without one, the page header has already said Vouchers.
      */}
      <Section title={writing || reversing ? 'Vouchers' : undefined} first={!writing && !reversing}>
        <Toolbar
          filters={
            <FilterSelect
              options={[
                { value: 'draft', label: 'Drafts' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Refused' },
                { value: 'all', label: 'All' },
              ]}
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              icon="voucher"
              width={170}
            />
          }
          actions={
            can('vouchers.create') && !writing && !reversing ? (
              <Button size="sm" onPress={() => setWriting(true)}>
                <Icon name="add" size={15} tone="inverse" />
                <Button.Label>Write a voucher</Button.Label>
              </Button>
            ) : undefined
          }
        />

        <StateView
          loading={vouchers.isLoading}
          error={vouchers.error}
          empty={rows.length === 0}
          emptyTitle="No vouchers"
          emptyMessage={
            status === 'draft'
              ? 'Nothing is waiting to be approved.'
              : 'No voucher with that status.'
          }
          onRetry={() => void vouchers.refetch()}
        >
          {rows.map((voucher, index) => (
            <View key={voucher.id} style={{ paddingVertical: space.md }}>
              <Stack gap="sm">
                <Inline gap="sm">
                  <Text style={type.rowTitle}>{voucher.voucher_no}</Text>
                  <Text tone="muted" style={type.rowMeta}>
                    {voucher.type} · {voucher.voucher_date}
                  </Text>
                </Inline>

                {voucher.narration ? (
                  <Text tone="muted" style={type.rowMeta}>
                    {voucher.narration}
                  </Text>
                ) : null}

                <Stack gap="xs">
                  {/*
                    Headed, because two right-aligned columns of money are
                    otherwise a guess, and which side a figure sits on is the
                    entire content of a ledger line.
                  */}
                  <LedgerLine
                    label={null}
                    debit={<ColumnHeading>Debit</ColumnHeading>}
                    credit={<ColumnHeading>Credit</ColumnHeading>}
                  />

                  {voucher.lines.map((line, i) => (
                    <LedgerLine
                      key={line.id ?? i}
                      label={line.ledger ?? '—'}
                      debit={line.debit !== '0.00' ? <Amount value={line.debit} size="sm" /> : null}
                      credit={
                        line.credit !== '0.00' ? <Amount value={line.credit} size="sm" /> : null
                      }
                    />
                  ))}

                  <Divider />

                  <LedgerLine
                    label="Total"
                    muted
                    debit={<Amount value={voucher.total_debit} size="sm" />}
                    credit={<Amount value={voucher.total_credit} size="sm" />}
                  />
                </Stack>

                <Inline gap="sm" wrap>
                  <StatusBadgeForVoucher status={voucher.status} />

                  {voucher.status === 'draft' && can('vouchers.approve') ? (
                    <>
                      <Button
                        size="sm"
                        isDisabled={decide.isPending}
                        onPress={() =>
                          void run(() =>
                            decide.mutateAsync({
                              id: voucher.id,
                              decision: 'approve',
                            }),
                          )
                        }
                      >
                        <Button.Label>Approve</Button.Label>
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        isDisabled={decide.isPending}
                        onPress={() =>
                          void run(() =>
                            decide.mutateAsync({
                              id: voucher.id,
                              decision: 'reject',
                            }),
                          )
                        }
                      >
                        <Button.Label>Refuse</Button.Label>
                      </Button>
                    </>
                  ) : null}

                  {voucher.status === 'draft' && can('vouchers.create') ? (
                    <Button
                      size="sm"
                      variant="danger"
                      isDisabled={remove.isPending}
                      onPress={() => void run(() => remove.mutateAsync(voucher.id))}
                    >
                      <Button.Label>Delete</Button.Label>
                    </Button>
                  ) : null}

                  {/*
                  Offered only while there is something to offer. A voucher
                  that has already been reversed would have the request refused
                  by the server, and a button whose one outcome is a refusal is
                  not a choice — it is a trap with a label on it.
                */}
                  {voucher.status === 'approved' &&
                  !voucher.reversed_by &&
                  can('vouchers.approve') ? (
                    <Button size="sm" variant="secondary" onPress={() => setReversing(voucher)}>
                      <Button.Label>Reverse</Button.Label>
                    </Button>
                  ) : null}

                  {voucher.reversed_by ? (
                    <Text tone="muted" style={type.rowMeta}>
                      reversed by {voucher.reversed_by}
                    </Text>
                  ) : null}

                  {voucher.reverses ? (
                    <Text tone="muted" style={type.rowMeta}>
                      reverses {voucher.reverses}
                    </Text>
                  ) : null}

                  {voucher.approved_by ? (
                    <Text tone="muted" style={type.rowMeta}>
                      by {voucher.approved_by}
                      {/*
                      Said plainly where the voucher is read. An approval
                      performed on one's own work is not the control it looks
                      like, and a reviewer is entitled to notice.
                    */}
                      {voucher.self_approved ? ' · who also wrote it' : ''}
                    </Text>
                  ) : null}
                </Inline>

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

/**
 * Draft / approved / refused, in the words an accountant would use.
 *
 * NOT `StatusBadge`. That component speaks about members — its three states
 * read "Active", "Suspended", "Awaiting approval", which is the right
 * vocabulary at the counter and the wrong one entirely for a document. An
 * approved voucher is not "active"; a refused one is not "suspended".
 *
 * It borrows the same grammar, though: the settled state is quiet muted text,
 * and only the states that need somebody to do something are given a glyph and
 * a colour. Most vouchers in a list are approved, and a column of loud badges
 * saying "normal" draws the eye to every row equally.
 */
/**
 * One line of a voucher: what it is, and which side its money sits on.
 *
 * THE COLUMN WIDTH IS DECLARED ONCE. It was written out six times as
 * `{ width: 110, alignItems: 'flex-end' }` - the heading row, every ledger
 * line, and the totals - which is six places to miss when the widest figure
 * the association posts stops fitting in 110.
 *
 * Fixed rather than flexed, because the two sides have to line up DOWN the
 * document. A column sized to its own contents puts the debits of one voucher
 * at a different x than the debits of the next, and reading a ledger is mostly
 * reading down.
 */
const MONEY_COLUMN = 110;

function LedgerLine({
  label,
  debit,
  credit,
  muted = false,
}: {
  /** Null for the heading row, which has nothing to name. */
  label: string | null;
  debit: ReactNode;
  credit: ReactNode;
  muted?: boolean;
}) {
  return (
    <Inline gap="sm" align="stretch">
      {label === null ? (
        <Spacer />
      ) : (
        <Text tone={muted ? 'muted' : 'default'} style={{ ...type.rowMeta, flex: 1 }}>
          {label}
        </Text>
      )}

      <View style={{ width: MONEY_COLUMN, alignItems: 'flex-end' }}>{debit}</View>
      <View style={{ width: MONEY_COLUMN, alignItems: 'flex-end' }}>{credit}</View>
    </Inline>
  );
}

function ColumnHeading({ children }: { children: ReactNode }) {
  return (
    <Text tone="muted" style={type.rowMeta}>
      {children}
    </Text>
  );
}

function StatusBadgeForVoucher({ status }: { status: Voucher['status'] }) {
  if (status === 'approved') {
    return (
      <Text tone="muted" style={type.rowMeta}>
        Approved
      </Text>
    );
  }

  const refused = status === 'rejected';

  return (
    <Inline gap="xs">
      <Icon
        name={refused ? 'suspended' : 'awaiting'}
        size={15}
        tone={refused ? 'danger' : 'accent'}
      />
      <Text tone={refused ? 'danger' : 'accent'} style={type.rowMeta}>
        {refused ? 'Refused' : 'Draft'}
      </Text>
    </Inline>
  );
}

function VoucherForm({
  onCancel,
  onDone,
  onError,
}: {
  onCancel: () => void;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const ledgers = useLedgers();
  const save = useSaveVoucher();

  const [voucherType, setVoucherType] = useState('journal');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');

  /*
    Two lines to begin with, because that is the smallest thing a voucher can
    be. Starting with one would invite a document that cannot post.
  */
  const [lines, setLines] = useState([
    { ledger_id: '', debit: '', credit: '' },
    { ledger_id: '', debit: '', credit: '' },
  ]);

  const ledgerOptions = (ledgers.data ?? []).map((l) => ({
    value: String(l.id),
    label: l.group ? `${l.name} · ${l.group}` : l.name,
  }));

  const set = (index: number, key: 'ledger_id' | 'debit' | 'credit', value: string) =>
    setLines((current) =>
      current.map((line, i) => {
        if (i !== index) {
          return line;
        }

        /*
          Entering one side clears the other. A line with both is refused by the
          server, and clearing it here means the reader never has to be told —
          the form simply cannot express the invalid thing.
        */
        if (key === 'debit') {
          return {
            ...line,
            debit: value,
            credit: value.trim() === '' ? line.credit : '',
          };
        }

        if (key === 'credit') {
          return {
            ...line,
            credit: value,
            debit: value.trim() === '' ? line.debit : '',
          };
        }

        return { ...line, ledger_id: value };
      }),
    );

  // Shown as guidance only. The server's balance check is the one that decides.
  const sum = (key: 'debit' | 'credit') =>
    lines.reduce((total, line) => total + (Number(line[key]) || 0), 0);

  const debits = sum('debit');
  const credits = sum('credit');
  const difference = Math.round((debits - credits) * 100) / 100;

  const complete =
    lines.length >= 2 &&
    lines.every((l) => l.ledger_id !== '' && (l.debit.trim() !== '' || l.credit.trim() !== '')) &&
    debits > 0 &&
    difference === 0;

  const submit = async () => {
    try {
      await save.mutateAsync({
        type: voucherType,
        voucher_date: date,
        narration: narration.trim() || null,
        lines: lines.map((l) => ({
          ledger_id: Number(l.ledger_id),
          ...(l.debit.trim() !== '' ? { debit: l.debit.trim() } : {}),
          ...(l.credit.trim() !== '' ? { credit: l.credit.trim() } : {}),
        })),
      });

      onDone();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'The voucher could not be saved.');
    }
  };

  return (
    <Form maxWidth={null} dense>
      <PickerField
        label="Type"
        options={[
          { value: 'journal', label: 'Journal' },
          { value: 'payment', label: 'Payment' },
          { value: 'receipt', label: 'Receipt' },
        ]}
        value={voucherType}
        onChange={setVoucherType}
      />

      <InputField
        label="Date"
        value={date}
        onChangeText={setDate}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        required
      />

      <InputField
        label="Narration"
        value={narration}
        onChangeText={setNarration}
        hint="Why this document exists. It reaches the ledger, where somebody reads it a year later."
      />

      {lines.map((line, index) => (
        <Stack key={index} gap="sm">
          <Text tone="muted" style={type.section}>
            LINE {index + 1}
          </Text>

          <PickerField
            label="Account"
            options={ledgerOptions}
            value={line.ledger_id}
            onChange={(value) => set(index, 'ledger_id', value)}
            required
          />

          <Inline gap="sm" align="stretch">
            <Stack grow>
              <InputField
                label="Debit"
                value={line.debit}
                onChangeText={(value) => set(index, 'debit', value)}
                keyboardType="phone-pad"
              />
            </Stack>
            <Stack grow>
              <InputField
                label="Credit"
                value={line.credit}
                onChangeText={(value) => set(index, 'credit', value)}
                keyboardType="phone-pad"
              />
            </Stack>
          </Inline>

          {lines.length > 2 ? (
            <Stack align="start">
              <Button
                size="sm"
                variant="secondary"
                onPress={() => setLines((c) => c.filter((_, i) => i !== index))}
              >
                <Button.Label>Remove line</Button.Label>
              </Button>
            </Stack>
          ) : null}
        </Stack>
      ))}

      <Stack align="start">
        <Button
          size="sm"
          variant="secondary"
          onPress={() => setLines((c) => [...c, { ledger_id: '', debit: '', credit: '' }])}
        >
          <Icon name="add" size={15} tone="muted" />
          <Button.Label>Add a line</Button.Label>
        </Button>
      </Stack>

      <Panel tone={difference === 0 && debits > 0 ? undefined : 'danger'}>
        <Text style={type.body}>
          Debits {debits.toFixed(2)} · Credits {credits.toFixed(2)}
          {difference === 0 ? ' · balanced' : ` · out by ${Math.abs(difference).toFixed(2)}`}
        </Text>
        <Text tone="muted" style={type.rowMeta}>
          A voucher that does not balance is refused. Saving it as a draft posts nothing — approval
          is what reaches the ledger.
        </Text>
      </Panel>

      <FormActions>
        <Button variant="secondary" onPress={onCancel}>
          <Button.Label>Cancel</Button.Label>
        </Button>
        <Button isDisabled={!complete || save.isPending} onPress={() => void submit()}>
          <Button.Label>{save.isPending ? 'Saving…' : 'Save as draft'}</Button.Label>
        </Button>
      </FormActions>
    </Form>
  );
}

function ReverseForm({
  voucher,
  pending,
  onCancel,
  onSubmit,
}: {
  voucher: Voucher;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <Form dense>
      <Panel>
        <Text style={type.body}>
          {voucher.voucher_no} posted {voucher.total_debit} on {voucher.voucher_date}.
        </Text>
        <Text tone="muted" style={type.rowMeta}>
          Reversing does not delete it. A new voucher posts the opposite of every line, so a report
          run last month still reconciles with what it said.
        </Text>
      </Panel>

      <InputField
        label="Why"
        value={reason}
        onChangeText={setReason}
        required
        hint="This appears in the accounts, on the reversing document."
      />

      <FormActions>
        <Button variant="secondary" onPress={onCancel}>
          <Button.Label>Cancel</Button.Label>
        </Button>
        <Button
          isDisabled={pending || reason.trim().length < 5}
          onPress={() => onSubmit(reason.trim())}
        >
          <Button.Label>{pending ? 'Posting…' : 'Post the reversal'}</Button.Label>
        </Button>
      </FormActions>
    </Form>
  );
}
