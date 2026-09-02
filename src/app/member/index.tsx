import { router } from 'expo-router';
import { View } from 'react-native';
import { formatMoney } from '@/api/money';
import { useSession } from '@/features/auth/session';
import { useDues, useSummary, type Due } from '@/features/dues/queries';
import { Button, Card, Chip, MoneyRow, Screen, StateView, Text } from '@/ui';

/**
 * What the member owes.
 *
 * Every figure here comes from the server, including the totals. Nothing on
 * this screen is added up locally - see api/money.ts for why that is a rule
 * rather than a preference.
 */
export default function DuesScreen() {
  const dues = useDues();
  const summary = useSummary();
  const { session } = useSession();

  const refreshing = dues.isRefetching || summary.isRefetching;
  const refresh = () => {
    dues.refetch();
    summary.refetch();
  };

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>
          {session?.profile.name ?? 'Your dues'}
        </Text>
        {session?.profile.membership_no ? (
          <Text style={{ opacity: 0.7 }}>Membership {session.profile.membership_no}</Text>
        ) : null}
      </View>

      <StateView
        loading={dues.isPending}
        error={dues.error}
        empty={dues.data?.data.length === 0}
        emptyTitle="Nothing outstanding"
        emptyMessage="You have no unpaid instalments right now."
        onRetry={dues.refetch}
      >
        {dues.data ? (
          <>
            <Card>
              <Card.Body style={{ gap: 8 }}>
                <Text style={{ fontWeight: '700' }}>Outstanding</Text>

                {/* Instalments and fines apart, and a server-computed total. */}
                <MoneyRow
                  instalment={dues.data.meta.instalment_total}
                  fine={dues.data.meta.fine_total}
                  total={dues.data.meta.grand_total}
                  emphasis
                />

                <Button onPress={() => router.push('/member/pay')}>
                  <Button.Label>Pay now</Button.Label>
                </Button>
              </Card.Body>
            </Card>

            <View style={{ gap: 12 }}>
              {dues.data.data.map((due) => (
                <DueCard key={due.fee_assign_id} due={due} />
              ))}
            </View>
          </>
        ) : null}
      </StateView>

      {summary.data ? (
        <Card>
          <Card.Body style={{ gap: 6 }}>
            <Text style={{ fontWeight: '700' }}>Since you joined</Text>

            {/* Four numbers, never collapsed into one "savings" figure. */}
            <Stat
              label="Instalments paid"
              value={String(summary.data.instalments_paid_count)}
            />
            <Stat label="Instalments" value={formatMoney(summary.data.instalments_paid_amount)} />
            <Stat label="Fines" value={formatMoney(summary.data.fines_paid_amount)} />
            <Stat label="Shares" value={String(summary.data.shares)} />
          </Card.Body>
        </Card>
      ) : null}
    </Screen>
  );
}

function DueCard({ due }: { due: Due }) {
  return (
    <Card>
      <Card.Body style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '600' }}>{due.fee_head}</Text>
            <Text style={{ opacity: 0.7 }}>{due.period}</Text>
          </View>

          {/* `Requested` means a payment is already submitted and waiting on
              staff - the member should not be told to pay it twice. */}
          {due.status === 'Requested' ? (
            <Chip>
              <Chip.Label>Awaiting approval</Chip.Label>
            </Chip>
          ) : due.overdue_periods > 0 ? (
            <Chip>
              <Chip.Label>
                {due.overdue_periods} month{due.overdue_periods === 1 ? '' : 's'} late
              </Chip.Label>
            </Chip>
          ) : null}
        </View>

        <MoneyRow
          instalment={due.instalment_amount}
          fine={due.fine_amount}
          total={due.total_due}
        />
      </Card.Body>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text>{label}</Text>
      <Text style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}
