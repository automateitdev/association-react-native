import { router } from 'expo-router';
import { View } from 'react-native';
import { formatMoney } from '@/api/money';
import { useSession } from '@/features/auth/session';
import { useDues, useSummary } from '@/features/dues/queries';
import { usePayments } from '@/features/payments/queries';
import { useProfileUpdates } from '@/features/member/profile';
import {
  Button,
  Row,
  Screen,
  ScreenHeader,
  Section,
  space,
  Stack,
  Stat,
  StatGrid,
  StateView,
  Text,
  type,
} from '@/ui';

/**
 * What a member sees when they open the app.
 *
 * THIS TAB USED TO BE THE PAY SCREEN. That was right when there was one thing
 * to do and three instalments to do it with. Against a real association it was
 * not: COCSOL's first member opens to eighteen rows of identical periods
 * running to 2027-12, and the answer to "am I up to date" is somewhere in the
 * middle of them. Paying moved to its own tab; this one answers the question
 * people actually open an app to ask.
 *
 * ONE NUMBER LEADS, AND IT IS THE RIGHT ONE. What is owed TODAY, not the sum
 * of every instalment ever assigned - see `DuesController` for why those are
 * different by fifteen thousand taka for a member who is one month late.
 *
 * NOTHING HERE IS ADDED UP IN THE APP. Every figure is a server field. That is
 * not ceremony: a dashboard is precisely where a convenient client-side total
 * would get written, and it is the one place a wrong one would be believed.
 *
 * ORDER IS BY WHAT IT ASKS OF THE READER. What you owe (a task), what is
 * waiting on somebody else (a fact you can do nothing about but should know),
 * what you have paid since joining (reassurance), then recent receipts.
 */
export default function MemberDashboard() {
  const dues = useDues();
  const summary = useSummary();
  const payments = usePayments();
  const updates = useProfileUpdates();
  const { session } = useSession();

  const meta = dues.data?.meta;
  const owedNow = meta?.due_grand_total ?? '0.00';
  const isClear = (meta?.due_count ?? 0) === 0;

  /*
   * A payment the member has filed and staff have not decided. It matters more
   * than its size suggests: without it a member who paid yesterday sees the
   * same amount owing today and pays twice.
   */
  const awaiting = (payments.data ?? []).filter((p) => p.status === 'pending');
  const pendingChange = (updates.data?.data ?? []).filter((u) => u.status === 'pending');

  const recent = (payments.data ?? []).filter((p) => p.status === 'completed').slice(0, 4);

  return (
    <Screen>
      <ScreenHeader
        title={session?.profile.name ?? 'Your association'}
        subtitle={
          session?.profile.membership_no
            ? `Membership ${session.profile.membership_no}`
            : undefined
        }
      />

      <StateView
        loading={dues.isPending || summary.isPending}
        error={dues.error ?? summary.error}
        onRetry={() => {
          void dues.refetch();
          void summary.refetch();
        }}
      >
        {/*
          THE ONE FIGURE, on its own surface.

          Green when there is nothing owed, because "you are up to date" is a
          different message from "you owe nothing right now" and members who are
          paid ahead deserve the first one.
        */}
        <Section title={isClear ? 'You are up to date' : 'Due now'} first>
          <View
            className={
              isClear ? 'bg-surface border border-border' : 'bg-accent-soft border border-accent'
            }
            style={{ padding: space.lg, borderRadius: 12 }}
          >
            <Stack gap="md">
              <Stack gap="xs">
                <Text tone="muted" style={type.label}>
                  {isClear ? 'NOTHING OUTSTANDING' : 'TOTAL DUE'}
                </Text>
                <Text style={type.amount}>{formatMoney(owedNow)}</Text>

                {isClear ? (
                  <Text tone="muted" style={type.rowMeta}>
                    {(meta?.scheduled_count ?? 0) > 0
                      ? `${meta?.scheduled_count} instalment${meta?.scheduled_count === 1 ? '' : 's'} scheduled ahead, none owed yet.`
                      : 'Every instalment assigned to you is paid.'}
                  </Text>
                ) : (
                  <Text tone="muted" style={type.rowMeta}>
                    {formatMoney(meta?.due_instalment_total ?? '0.00')} instalments
                    {meta && meta.due_fine_total !== '0.00'
                      ? ` + ${formatMoney(meta.due_fine_total)} fine`
                      : ''}
                    {` · ${meta?.due_count} period${meta?.due_count === 1 ? '' : 's'}`}
                  </Text>
                )}
              </Stack>

              {isClear ? null : (
                <Button onPress={() => router.push('/member/pay')}>Pay now</Button>
              )}
            </Stack>
          </View>
        </Section>

        {/*
          WAITING ON SOMEBODY ELSE. Only rendered when there is something -
          an empty "nothing pending" panel is a row of furniture that teaches
          the reader to skip the area where the real message will appear.
        */}
        {awaiting.length > 0 || pendingChange.length > 0 ? (
          <Section title="Waiting to be reviewed">
            <Stack gap="sm">
              {awaiting.map((payment) => (
                <Row
                  key={payment.id}
                  title={`${formatMoney(payment.total_amount)} · ${payment.invoice_no}`}
                  meta={
                    payment.payment_date
                      ? `Submitted ${payment.payment_date} · with the office`
                      : 'With the office'
                  }
                  onPress={() => router.push(`/member/payment/${payment.id}`)}
                />
              ))}

              {pendingChange.length > 0 ? (
                <Row
                  title={`${pendingChange.length} change${pendingChange.length === 1 ? '' : 's'} to your details`}
                  meta="Nothing changes until the office approves it"
                  onPress={() => router.push('/member/profile')}
                />
              ) : null}
            </Stack>
          </Section>
        ) : null}

        <Section title="Since you joined">
          <StatGrid>
            <Stat
              label="Instalments paid"
              value={String(summary.data?.instalments_paid_count ?? 0)}
              icon="check"
            />
            <Stat label="Shares held" value={String(summary.data?.shares ?? 0)} icon="shares" />
            <Stat
              label="Instalments"
              value={formatMoney(summary.data?.instalments_paid_amount ?? '0.00')}
              icon="pay"
            />
            <Stat
              label="Fines"
              value={formatMoney(summary.data?.fines_paid_amount ?? '0.00')}
              icon="fine"
            />
          </StatGrid>
        </Section>

        {recent.length > 0 ? (
          <Section
            title="Recent payments"
            action={
              <Button variant="tertiary" onPress={() => router.push('/member/statement')}>
                See all
              </Button>
            }
          >
            <Stack gap="none">
              {recent.map((payment, index) => (
                <Row
                  key={payment.id}
                  title={formatMoney(payment.total_amount)}
                  meta={`${payment.payment_date ?? ''} · ${payment.invoice_no}`}
                  onPress={() => router.push(`/member/payment/${payment.id}`)}
                  divider={index < recent.length - 1}
                />
              ))}
            </Stack>
          </Section>
        ) : null}
      </StateView>
    </Screen>
  );
}
