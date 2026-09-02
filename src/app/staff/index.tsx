import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSession } from '@/features/auth/session';
import {
  useDecidePayments,
  usePendingPayments,
  type DecisionOutcome,
  type PendingPayment,
} from '@/features/staff/approvals';
import { Button, Card, Checkbox, Chip, MoneyRow, Screen, StateView, Text, TextArea } from '@/ui';

/**
 * The payment approval queue.
 *
 * This is the first staff screen, chosen deliberately: it is the one with a
 * member blocked behind it, and it is the screen that settles how staff lists
 * are built - HeroUI Native has no table and no data grid (risk R-1), so a
 * "row" here is a Card. On a phone that is the right answer anyway; a table
 * would be unreadable at 375pt.
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
 */
export default function PaymentApprovalsScreen() {
  const { session, signOut } = useSession();
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
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 22, fontWeight: '700' }}>Payment approvals</Text>
          <Text style={{ opacity: 0.7 }}>
            {session?.profile.name} · {session?.role}
          </Text>
        </View>

        <Button
          variant="tertiary"
          onPress={async () => {
            await signOut();
            router.replace('/');
          }}
        >
          <Button.Label>Sign out</Button.Label>
        </Button>
      </View>

      {outcome ? <Outcome outcome={outcome} onDismiss={() => setOutcome(null)} /> : null}

      {decide.isError ? (
        <Card>
          <Card.Body>
            <Text style={{ fontWeight: '600' }}>The batch could not be sent</Text>
            <Text>Nothing was decided. Check your connection and try again.</Text>
          </Card.Body>
        </Card>
      ) : null}

      <StateView
        loading={pending.isLoading}
        error={pending.error}
        empty={payments.length === 0}
        emptyTitle="Nothing waiting"
        emptyMessage="No payments are awaiting approval right now."
        onRetry={() => void pending.refetch()}
      >
        <Text style={{ opacity: 0.7 }}>
          {total} awaiting approval
          {selected.size > 0 ? ` · ${selected.size} selected` : ''}
        </Text>

        {payments.map((payment) => (
          <PaymentCard
            key={payment.id}
            payment={payment}
            selected={selected.has(payment.id)}
            onToggle={() => toggle(payment.id)}
          />
        ))}

        {/* No pagination control exists in HeroUI Native, and on a phone this is
            the better pattern regardless. */}
        {pending.hasNextPage ? (
          <Button
            variant="secondary"
            isDisabled={pending.isFetchingNextPage}
            onPress={() => void pending.fetchNextPage()}
          >
            <Button.Label>
              {pending.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button.Label>
          </Button>
        ) : null}
      </StateView>

      {selected.size > 0 ? (
        <Card>
          <Card.Body style={{ gap: 12 }}>
            {rejecting ? (
              <>
                <Text style={{ fontWeight: '600' }}>Why is this being rejected?</Text>
                <Text style={{ opacity: 0.7 }}>
                  The member is told this reason, so write what they need to do next.
                </Text>

                <TextArea
                  value={reason}
                  onChangeText={setReason}
                  placeholder="e.g. The slip shows ৳1,000 but ৳1,200 is due."
                />

                <View style={{ flexDirection: 'row', gap: 8 }}>
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
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  variant="secondary"
                  style={{ flex: 1 }}
                  isDisabled={decide.isPending}
                  onPress={() => setRejecting(true)}
                >
                  <Button.Label>Reject {selected.size}</Button.Label>
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
            )}
          </Card.Body>
        </Card>
      ) : null}
    </Screen>
  );
}

function PaymentCard({
  payment,
  selected,
  onToggle,
}: {
  payment: PendingPayment;
  selected: boolean;
  onToggle: () => void;
}) {
  const hasProof = payment.document_count > 0;

  return (
    <Pressable onPress={onToggle}>
      <Card>
        <Card.Body style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <Checkbox isSelected={selected} onSelectedChange={onToggle} />

            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontWeight: '600' }}>{payment.member_name}</Text>
              <Text style={{ opacity: 0.7, fontSize: 12 }}>
                {payment.invoice_no} · {payment.instalment_count} instalment
                {payment.instalment_count === 1 ? '' : 's'}
              </Text>
            </View>

            <Chip>
              <Chip.Label>{payment.payment_type}</Chip.Label>
            </Chip>
          </View>

          {/*
            Instalment and fine stay apart on the approver's screen too. Someone
            approving a payment should be able to see what part of it is a fine
            without doing arithmetic - the total shown is the server's.
          */}
          <MoneyRow
            instalment={payment.payable_amount}
            fine={payment.fine_amount}
            total={payment.total_amount}
          />

          {/*
            With no gateway involved, a manual payment with nothing attached is
            an assertion that money moved. Staff may still approve it - they may
            have seen the counter receipt themselves - but not without noticing.
          */}
          {!hasProof && payment.payment_type === 'manual' ? (
            <Text style={{ fontWeight: '600' }}>No slip attached</Text>
          ) : null}

          {hasProof ? (
            <Text style={{ opacity: 0.7, fontSize: 12 }}>
              {payment.document_count} document{payment.document_count === 1 ? '' : 's'} attached
            </Text>
          ) : null}
        </Card.Body>
      </Card>
    </Pressable>
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
    <Card>
      <Card.Body style={{ gap: 8 }}>
        <Text style={{ fontWeight: '700' }}>
          {outcome.decided} decided
          {outcome.failed > 0 ? `, ${outcome.failed} failed` : ''}
        </Text>

        {failures.map((failure) => (
          <Text key={failure.payment_id}>
            Payment #{failure.payment_id}: {failure.error ?? 'Refused.'}
          </Text>
        ))}

        {outcome.failed > 0 ? (
          <Text style={{ opacity: 0.7 }}>
            The failed payments are still selected, so you can try them again.
          </Text>
        ) : null}

        <Button variant="secondary" onPress={onDismiss}>
          <Button.Label>Dismiss</Button.Label>
        </Button>
      </Card.Body>
    </Card>
  );
}
