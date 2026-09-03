import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { formatMoney } from '@/api/money';
import { ReceiptButton } from '@/features/payments/ReceiptButton';
import { useSession } from '@/features/auth/session';
import { ExportButtons } from '@/features/staff/ExportButtons';
import {
  useDecidePayments,
  usePendingPayments,
  type DecisionOutcome,
  type PendingPayment,
} from '@/features/staff/approvals';
import {
  Actions,
  useActionButtonStyle,
  Button,
  Cell,
  Checkbox,
  DataTable,
  DateField,
  NumberCell,
  Panel,
  Screen,
  ScreenHeader,
  SearchField,
  Section,
  StateView,
  Toolbar,
  Text,
  TextArea,
  space,
  type,
  type Column,
  type DateRange,
  type SortState,
} from '@/ui';

/**
 * The payment approval queue.
 *
 * TWO THINGS THIS SCREEN WILL NOT DO
 * ----------------------------------
 * 1. It never sums money. There is no "total selected" figure, however natural
 *    that would feel on a batch screen, because producing one means adding
 *    amounts in the client - and adding instalments to fines is the exact class
 *    of bug this platform was rebuilt to eliminate. Each payment shows the
 *    total the SERVER calculated, and that is all.
 *
 * 2. It never reports a batch as wholly successful when it was not. The API
 *    answers 207 with per-payment outcomes precisely because the legacy system
 *    lost approvals silently; showing "12 approved" over a response that said
 *    10 succeeded would reintroduce the defect at the presentation layer.
 *
 * The layout changed with the design layer: a payment used to be a filled card
 * with three stacked label/value money lines, which made a queue of them a wall
 * of small text with nothing to fix on. Now the server's total anchors the row
 * and the breakdown sits under it, quieter - still two figures, still visibly
 * apart, still never added here.
 */
export default function PaymentApprovalsScreen() {
  const { can } = useSession();
  const actionStyle = useActionButtonStyle();
  const decide = useDecidePayments();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [outcome, setOutcome] = useState<DecisionOutcome | null>(null);

  const [submitted, setSubmitted] = useState<DateRange>({});
  const [draft, setDraft] = useState<DateRange>({});
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>(null);

  const [search, setSearch] = useState('');

  // Debounced, so typing does not fire a request per keystroke.
  const query = useDebounced(search, 300);

  const filters = useMemo(
    () => ({ from: submitted.from, to: submitted.to, q: query || undefined }),
    [submitted, query],
  );

  // Back to the first page whenever the question changes - otherwise a narrowed
  // queue asks for page 5 of 1 and shows an empty table.
  useEffect(() => {
    setPage(1);
  }, [filters, sort]);

  const pending = usePendingPayments(filters, page, sort);

  const payments = pending.data?.data ?? [];
  const meta = pending.data?.meta;
  const total = meta?.total ?? 0;

  const toggle = useCallback((id: number) => {
    setSelected((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const submit = useCallback(
    async (decision: 'completed' | 'suspended') => {
      const ids = [...selected];
      if (ids.length === 0) return;

      try {
        const result = await decide.mutateAsync({
          paymentIds: ids,
          decision,
          reason: decision === 'suspended' ? reason.trim() : undefined,
        });

        setOutcome(result);
        setRejecting(false);
        setReason('');

        /*
         * Keep the ones that FAILED selected.
         *
         * Clearing everything would hide the work still outstanding behind a
         * message the approver may well dismiss, leaving them to rediscover it
         * on the next refresh. Keeping the failures selected means the retry is
         * already set up.
         */
        setSelected(new Set(result.results.filter((r) => !r.ok).map((r) => r.payment_id)));
      } catch {
        // Surfaced by the mutation's own error state below.
      }
    },
    [decide, reason, selected],
  );

  const columns = useMemo<Column<PendingPayment>[]>(
    () => [
      {
        key: 'select',
        header: '',
        width: 46,
        frozen: true,
        // No `sort`: ordering a queue by which rows happen to be ticked is not
        // a question anyone asks.
        render: (row) => (
          <Checkbox isSelected={selected.has(row.id)} onSelectedChange={() => toggle(row.id)} />
        ),
      },
      {
        key: 'member_name',
        header: 'Member',
        width: 170,
        frozen: true,
        render: (row) => <Cell bold>{row.member_name}</Cell>,
        sort: (row) => row.member_name,
      },
      {
        key: 'membership_no',
        header: 'No.',
        width: 80,
        render: (row) => <Cell>{row.membership_no || '—'}</Cell>,
        sort: (row) => row.membership_no,
      },
      {
        key: 'invoice_no',
        header: 'Invoice',
        width: 130,
        render: (row) => <Cell>{row.invoice_no}</Cell>,
        sort: (row) => row.invoice_no,
      },
      {
        key: 'instalment_count',
        header: 'Items',
        width: 70,
        align: 'right',
        render: (row) => <NumberCell>{String(row.instalment_count)}</NumberCell>,
      },
      /*
       * Instalment, fine and total as THREE columns.
       *
       * This is FR-REP-3 on the one screen where it matters most: an approver
       * signing off a batch is deciding about other people's money, and a
       * single "amount" column is how they end up unable to say afterwards how
       * much of what they approved was penalty.
       *
       * The totals are the SERVER'S, computed across the whole queue. Nothing
       * here adds anything up - see the note at the top of this file.
       */
      {
        key: 'payable_amount',
        header: 'Instalments',
        width: 130,
        align: 'right',
        render: (row) => <NumberCell>{formatMoney(row.payable_amount)}</NumberCell>,
        sort: (row) => row.payable_amount,
        sortType: 'decimal',
        total: meta ? <NumberCell bold>{formatMoney(meta.instalments_amount)}</NumberCell> : undefined,
      },
      {
        key: 'fine_amount',
        header: 'Fines',
        width: 110,
        align: 'right',
        render: (row) => <NumberCell>{formatMoney(row.fine_amount)}</NumberCell>,
        sort: (row) => row.fine_amount,
        sortType: 'decimal',
        total: meta ? <NumberCell bold>{formatMoney(meta.fines_amount)}</NumberCell> : undefined,
      },
      {
        key: 'total_amount',
        header: 'Total',
        width: 130,
        align: 'right',
        render: (row) => <NumberCell bold>{formatMoney(row.total_amount)}</NumberCell>,
        sort: (row) => row.total_amount,
        sortType: 'decimal',
        total: meta ? <NumberCell bold>{formatMoney(meta.total_amount)}</NumberCell> : undefined,
      },
      {
        key: 'document_count',
        header: 'Slips',
        width: 80,
        align: 'right',
        render: (row) => (
          /*
            Zero slips is the one worth seeing. With no gateway, a manual
            payment with nothing attached is a claim rather than evidence, so it
            is called out rather than shown as a quiet 0.
          */
          <Text
            tone={row.document_count === 0 ? 'danger' : 'default'}
            numberOfLines={1}
            style={{ ...type.body, fontVariant: ['tabular-nums'] }}
          >
            {row.document_count === 0 ? 'None' : String(row.document_count)}
          </Text>
        ),
      },
      {
        key: 'submitted',
        header: 'Submitted',
        width: 120,
        render: (row) => <Cell>{(row.created_at ?? '').slice(0, 10)}</Cell>,
        sort: (row) => row.created_at ?? '',
      },
    ],
    [meta, selected, toggle],
  );

  return (
    <Screen onRefresh={() => void pending.refetch()} refreshing={pending.isRefetching}>
      <ScreenHeader
        title="Approvals"
        subtitle={total === 0 ? undefined : `${total} awaiting a decision`}
      />

      {outcome ? (
        <View style={{ marginTop: space.lg }}>
          <Outcome outcome={outcome} onDismiss={() => setOutcome(null)} />
        </View>
      ) : null}

      {decide.isError ? (
        <View style={{ marginTop: space.lg }}>
          <Panel tone="danger">
            <Text style={type.rowTitle}>The batch could not be sent</Text>
            <Text style={type.body}>Nothing was decided. Check your connection and try again.</Text>
          </Panel>
        </View>
      ) : null}

      <Section title="Awaiting a decision" first>
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
              {/*
                By member name, membership number OR invoice.

                The number is how the office identifies a member, and an
                approver checking a slip against a record has it to hand. The
                invoice is what the member quotes when they ring up to ask
                where their payment went.
              */}
              <SearchField
                value={search}
                onChangeText={setSearch}
                placeholder="Search member, no. or invoice"
              />

              <DateField
                value={submitted.from && submitted.to ? submitted : draft}
                onChange={(next) => {
                  setDraft(next);
                  if (next.from && next.to) setSubmitted(next);
                }}
                placeholder="Submitted: any date"
                onClear={() => {
                  setSubmitted({});
                  setDraft({});
                }}
              />
            </>
          }
          actions={
            can('reports.export') ? (
              <ExportButtons
                path="/staff/payments/pending/export"
                name="payments-awaiting-approval"
                scope="The whole queue matching these dates, not just this page."
                query={{
                  ...(submitted.from ? { from: submitted.from } : {}),
                  ...(submitted.to ? { to: submitted.to } : {}),
                  ...(query ? { q: query } : {}),
                  ...(sort ? { sort: sort.key, direction: sort.direction } : {}),
                }}
                disabled={pending.isLoading || payments.length === 0}
              />
            ) : undefined
          }
        />

        <StateView
          loading={pending.isLoading}
          error={pending.error}
          empty={payments.length === 0}
          emptyTitle="Nothing waiting"
          emptyMessage="No payments are awaiting approval right now."
          onRetry={() => void pending.refetch()}
        >
          <DataTable
            columns={columns}
            rows={payments}
            keyExtractor={(row) => row.id}
            // Not the checkbox column, which is 46pt wide and truncates it.
            totalsLabelKey="member_name"
            /*
              Pressing anywhere on the row toggles it, not just the checkbox.
              An approver working down a queue is aiming at a name, and a 16pt
              target beside it is the wrong thing to have to hit.
            */
            onRowPress={(row) => toggle(row.id)}
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

      {selected.size > 0 ? (
        <View style={{ marginTop: space.xl }}>
          <Panel>
            {rejecting ? (
              <>
                <Text style={type.rowTitle}>Why is this being rejected?</Text>
                <Text tone="muted" style={type.rowMeta}>
                  The member is told this reason, so write what they need to do next.
                </Text>

                <TextArea
                  value={reason}
                  onChangeText={setReason}
                  placeholder="e.g. The slip shows ৳1,000 but ৳1,200 is due."
                />

                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Button
                    variant="secondary"
                    style={actionStyle}
                    onPress={() => {
                      setRejecting(false);
                      setReason('');
                    }}
                  >
                    <Button.Label>Cancel</Button.Label>
                  </Button>

                  <Button
                    style={actionStyle}
                    // Refusing a member's payment is destructive, and the button
                    // that does it should not look like the one that cancels.
                    variant="danger"
                    // The server requires a reason when rejecting. Enforcing it
                    // here too means the approver is told before the round trip.
                    isDisabled={reason.trim().length === 0 || decide.isPending}
                    onPress={() => void submit('suspended')}
                  >
                    <Button.Label>
                      {decide.isPending ? 'Rejecting…' : `Reject ${selected.size}`}
                    </Button.Label>
                  </Button>
                </View>
              </>
            ) : (
              <>
                <Text tone="muted" style={type.rowMeta}>
                  {selected.size} selected
                </Text>

                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Button
                    variant="secondary"
                    style={actionStyle}
                    isDisabled={decide.isPending}
                    onPress={() => setRejecting(true)}
                  >
                    <Button.Label>Reject</Button.Label>
                  </Button>

                  <Button
                    style={actionStyle}
                    isDisabled={decide.isPending}
                    onPress={() => void submit('completed')}
                  >
                    <Button.Label>
                      {decide.isPending ? 'Approving…' : `Approve ${selected.size}`}
                    </Button.Label>
                  </Button>
                </View>
              </>
            )}
          </Panel>
        </View>
      ) : null}
    </Screen>
  );
}

/**
 * What actually happened to the batch.
 *
 * Deliberately blunt about partial results. The legacy failure was not that
 * approvals failed - it was that they failed invisibly, and staff believed a
 * batch had gone through when half of it had been rolled back. Any failure at
 * all is named, per payment, with the server's own message.
 */
function Outcome({ outcome, onDismiss }: { outcome: DecisionOutcome; onDismiss: () => void }) {
  const failures = outcome.results.filter((r) => !r.ok);
  const receipts = outcome.results.filter((r) => r.ok && r.status === 'completed');

  return (
    <Panel tone={outcome.failed > 0 ? 'danger' : 'neutral'}>
      <Text style={type.rowTitle}>
        {outcome.decided} decided
        {outcome.failed > 0 ? `, ${outcome.failed} failed` : ''}
      </Text>

      {/*
        Receipts, right here, for the payments that just completed.

        This is the moment a clerk wants one: the member is usually still at the
        counter. Sending them to look the payment up again afterwards is the
        difference between the app fitting the desk and merely storing the data.

        Only `completed` results qualify - a suspended payment has no receipt,
        and the server refuses to produce one.
      */}
      {receipts.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
          {receipts.map((result) => (
            <ReceiptButton
              key={result.payment_id}
              path={`/staff/payments/${result.payment_id}/invoice`}
              invoiceNo={String(result.payment_id)}
            />
          ))}
        </View>
      ) : null}

      {failures.map((failure) => (
        <Text key={failure.payment_id} style={type.body}>
          Payment #{failure.payment_id}: {failure.error ?? 'Refused.'}
        </Text>
      ))}

      {outcome.failed > 0 ? (
        <Text tone="muted" style={type.rowMeta}>
          The failed payments are still selected, so you can try them again.
        </Text>
      ) : null}

      <Actions>
        <Button variant="secondary" onPress={onDismiss}>
          <Button.Label>Dismiss</Button.Label>
        </Button>
      </Actions>
    </Panel>
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
