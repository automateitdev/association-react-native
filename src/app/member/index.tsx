import { router } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '@/features/auth/session';
import { useDues, useSummary, type Due } from '@/features/dues/queries';
import {
  Amount,
  AmountBreakdown,
  Button,
  Row,
  Screen,
  ScreenHeader,
  Section,
  StateView,
  Stat,
  Text,
  space,
  type,
} from '@/ui';

/**
 * What the member owes.
 *
 * Every figure here comes from the server, including the totals. Nothing on
 * this screen is added up locally - see api/money.ts for why that is a rule
 * rather than a preference.
 *
 * The outstanding total leads at display size because it is the one thing the
 * member opened the app to see. The per-period breakdown follows as rows rather
 * than cards: a member with twelve overdue months previously got twelve filled
 * boxes, which is a wall, not a list.
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
      <ScreenHeader
        title={session?.profile.name ?? 'Your dues'}
        subtitle={
          session?.profile.membership_no ? `Membership ${session.profile.membership_no}` : undefined
        }
      />

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
            <Section title="Outstanding" first>
              <View style={{ gap: space.md }}>
                {/* Instalments and fines apart, and a server-computed total. */}
                <AmountBreakdown
                  instalment={dues.data.meta.instalment_total}
                  fine={dues.data.meta.fine_total}
                  total={dues.data.meta.grand_total}
                  align="left"
                />

                <Button onPress={() => router.push('/member/pay')}>
                  <Button.Label>Pay now</Button.Label>
                </Button>
              </View>
            </Section>

            <Section title="By period">
              {dues.data.data.map((due, index) => (
                <DueRow
                  key={due.fee_assign_id}
                  due={due}
                  divider={index < dues.data.data.length - 1}
                />
              ))}
            </Section>
          </>
        ) : null}
      </StateView>

      {summary.data ? (
        <Section title="Since you joined">
          {/* Four numbers, never collapsed into one "savings" figure. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg }}>
            <Stat label="Instalments paid" value={String(summary.data.instalments_paid_count)} />
            <Stat label="Shares" value={String(summary.data.shares)} />
          </View>

          <View style={{ marginTop: space.md }}>
            <Row
              title="Instalments"
              trailing={<Amount value={summary.data.instalments_paid_amount} />}
            />
            <Row
              title="Fines"
              trailing={<Amount value={summary.data.fines_paid_amount} />}
              divider={false}
            />
          </View>
        </Section>
      ) : null}
    </Screen>
  );
}

function DueRow({ due, divider }: { due: Due; divider: boolean }) {
  return (
    <Row
      title={due.fee_head}
      meta={due.period}
      trailing={
        <AmountBreakdown
          instalment={due.instalment_amount}
          fine={due.fine_amount}
          total={due.total_due}
        />
      }
      footer={
        /* `Requested` means a payment is already submitted and waiting on staff
           - the member must not be told to pay it twice. */
        due.status === 'Requested' ? (
          <StatusLine text="Awaiting approval" />
        ) : due.overdue_periods > 0 ? (
          <StatusLine
            text={`${due.overdue_periods} month${due.overdue_periods === 1 ? '' : 's'} late`}
            tone="danger"
          />
        ) : null
      }
      divider={divider}
    />
  );
}

/**
 * A status line rather than a chip.
 *
 * A filled pill beside a filled amount competed with it, and down a list of
 * periods the pills read as the most important thing on screen when the money
 * is. Text carries the same information without shouting.
 */
function StatusLine({ text, tone }: { text: string; tone?: 'danger' }) {
  return (
    <Text tone={tone === 'danger' ? 'danger' : 'muted'} style={type.rowMeta}>
      {text}
    </Text>
  );
}
