import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  useDecidePayments,
  usePendingPayments,
  type DecisionOutcome,
  type PendingPayment,
} from '@/features/staff/approvals';
import {
  AmountBreakdown,
  Button,
  Checkbox,
  Panel,
  Row,
  Screen,
  ScreenHeader,
  Section,
  StateView,
  Text,
  TextArea,
  space,
  type,
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
  const pending = usePendingPayments();
  const decide = useDecidePayments();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [outcome, setOutcome] = useState<DecisionOutcome | null>(null);

  const payments = useMemo(
    () => pending.data?.pages.flatMap((page) => page.data) ?? [],
    [pending.data],
  );

  const total = pending.data?.pages[0]?.meta.total ?? 0;

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

      <StateView
        loading={pending.isLoading}
        error={pending.error}
        empty={payments.length === 0}
        emptyTitle="Nothing waiting"
        emptyMessage="No payments are awaiting approval right now."
        onRetry={() => void pending.refetch()}
      >
        <Section first>
          {payments.map((payment, index) => (
            <PaymentRow
              key={payment.id}
              payment={payment}
              selected={selected.has(payment.id)}
              onToggle={() => toggle(payment.id)}
              divider={index < payments.length - 1}
            />
          ))}
        </Section>

        {/* No pagination control exists in HeroUI Native, and on a phone this is
            the better pattern regardless. */}
        {pending.hasNextPage ? (
          <View style={{ marginTop: space.lg }}>
            <Button
              variant="secondary"
              isDisabled={pending.isFetchingNextPage}
              onPress={() => void pending.fetchNextPage()}
            >
              <Button.Label>{pending.isFetchingNextPage ? 'Loading…' : 'Load more'}</Button.Label>
            </Button>
          </View>
        ) : null}
      </StateView>

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
                    style={{ flex: 1 }}
                    onPress={() => {
                      setRejecting(false);
                      setReason('');
                    }}
                  >
                    <Button.Label>Cancel</Button.Label>
                  </Button>

                  <Button
                    style={{ flex: 1 }}
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
                    style={{ flex: 1 }}
                    isDisabled={decide.isPending}
                    onPress={() => setRejecting(true)}
                  >
                    <Button.Label>Reject</Button.Label>
                  </Button>

                  <Button
                    style={{ flex: 1 }}
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

function PaymentRow({
  payment,
  selected,
  onToggle,
  divider,
}: {
  payment: PendingPayment;
  selected: boolean;
  onToggle: () => void;
  divider: boolean;
}) {
  const missingProof = payment.payment_type === 'manual' && payment.document_count === 0;

  return (
    <Row
      title={payment.member_name}
      meta={`${payment.invoice_no} · ${payment.payment_type} · ${payment.instalment_count} instalment${
        payment.instalment_count === 1 ? '' : 's'
      }`}
      leading={<Checkbox isSelected={selected} onSelectedChange={onToggle} />}
      trailing={
        <AmountBreakdown
          instalment={payment.payable_amount}
          fine={payment.fine_amount}
          total={payment.total_amount}
        />
      }
      footer={
        /*
          With no gateway involved, a manual payment carrying nothing is a claim
          that money moved, not evidence of it. Staff may still approve - they
          may have seen the counter receipt themselves - but not unknowingly.
        */
        missingProof ? (
          <Text tone="danger" style={type.rowMeta}>
            No slip attached
          </Text>
        ) : payment.document_count > 0 ? (
          <Text tone="muted" style={type.rowMeta}>
            {payment.document_count} document{payment.document_count === 1 ? '' : 's'} attached
          </Text>
        ) : null
      }
      onPress={onToggle}
      divider={divider}
    />
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

  return (
    <Panel tone={outcome.failed > 0 ? 'danger' : 'neutral'}>
      <Text style={type.rowTitle}>
        {outcome.decided} decided
        {outcome.failed > 0 ? `, ${outcome.failed} failed` : ''}
      </Text>

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

      <Button variant="secondary" onPress={onDismiss}>
        <Button.Label>Dismiss</Button.Label>
      </Button>
    </Panel>
  );
}
