import { router } from 'expo-router';
import { View } from 'react-native';
import { formatMoney, type Money } from '@/api/money';
import { useSession } from '@/features/auth/session';
import { useDashboard } from '@/features/staff/dashboard';
import {
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
 * The staff landing screen.
 *
 * TWO FIGURES WHERE A DASHBOARD USUALLY SHOWS ONE
 * -----------------------------------------------
 * Collections and outstanding are each a pair - instalments and fines, apart -
 * and there is deliberately no "total collected" anywhere on this screen. That
 * number would have to be produced by adding two amounts in the app, which it
 * must never do; and a single "collected" figure that silently includes fines
 * is exactly the defect the legacy reports carry (D-1). Showing two numbers is
 * the correct answer here, not a compromise.
 *
 * The pending-approvals count is the one figure that is also an instruction, so
 * it is the only thing on the page that is pressable.
 */
export default function DashboardScreen() {
  const { session, signOut } = useSession();
  const dashboard = useDashboard();

  const data = dashboard.data;

  return (
    <Screen onRefresh={() => void dashboard.refetch()} refreshing={dashboard.isRefetching}>
      <ScreenHeader
        title="Overview"
        subtitle={`${session?.profile.name} · ${session?.role}`}
        action={
          <Button
            variant="tertiary"
            onPress={async () => {
              await signOut();
              router.replace('/');
            }}
          >
            <Button.Label>Sign out</Button.Label>
          </Button>
        }
      />

      <StateView
        loading={dashboard.isLoading}
        error={dashboard.error}
        onRetry={() => void dashboard.refetch()}
      >
        {data ? (
          <>
            {/*
              Waiting on someone, so it leads. A dashboard whose first figure is
              a lifetime total tells staff nothing about what to do next.
            */}
            <Section title="Needs attention" first>
              <Row
                title="Payments awaiting approval"
                meta={
                  data.payments_pending_approval === 0
                    ? 'Nothing waiting'
                    : 'Tap to review and decide'
                }
                trailing={
                  <Text style={{ ...type.stat, fontVariant: ['tabular-nums'] }}>
                    {String(data.payments_pending_approval)}
                  </Text>
                }
                onPress={
                  data.payments_pending_approval > 0
                    ? () => router.push('/staff/approvals')
                    : undefined
                }
                divider={false}
              />
            </Section>

            <Section title="Collected">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg }}>
                <Stat label="Instalments" value={money(data.collections.instalments)} />
                <Stat label="Fines" value={money(data.collections.fines)} />
              </View>
            </Section>

            <Section title="Outstanding">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg }}>
                <Stat label="Instalments" value={money(data.outstanding.instalments)} />
                <Stat label="Fines" value={money(data.outstanding.fines)} />
              </View>
            </Section>

            <Section title="Members">
              <Row
                title="Active"
                trailing={<Count value={data.members.active} />}
                onPress={() => router.push('/staff/members')}
              />
              <Row
                title="Awaiting approval"
                meta={data.members.inactive > 0 ? 'Not yet admitted' : undefined}
                trailing={<Count value={data.members.inactive} />}
                onPress={() => router.push('/staff/members')}
              />
              <Row
                title="Suspended"
                trailing={<Count value={data.members.suspended} />}
                onPress={() => router.push('/staff/members')}
                divider={false}
              />
            </Section>
          </>
        ) : null}
      </StateView>
    </Screen>
  );
}

function Count({ value }: { value: number }) {
  return <Text style={{ ...type.amount, fontVariant: ['tabular-nums'] }}>{String(value)}</Text>;
}

/**
 * Stat takes a string, so the amount is formatted here rather than rendered.
 *
 * Still the app's one formatter - the dashboard and the lists must not disagree
 * about digit grouping, and Bangladeshi grouping is not what toLocaleString
 * gives you by default.
 */
function money(value: Money): string {
  return formatMoney(value);
}
