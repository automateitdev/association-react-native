import { router } from 'expo-router';
import { View } from 'react-native';
import { formatMoney, type Money } from '@/api/money';
import { useSession } from '@/features/auth/session';
import { useDashboard } from '@/features/staff/dashboard';
import {
  Screen,
  ScreenHeader,
  Section,
  StateView,
  Stat,
  StatGrid,
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
 * must never do; and a single "collected" figure that silently includes fines is
 * exactly the defect the legacy reports carry (D-1). Showing two cards is the
 * correct answer here, not a compromise.
 *
 * The figures sit on cards rather than stacked as bare text. An earlier version
 * had no surfaces at all - the whole page was a column of numbers with nothing
 * separating one from the next and nothing saying which mattered. A dashboard
 * figure is a distinct object, and it reads as one when it has an edge.
 */
export default function DashboardScreen() {
  const { can } = useSession();
  const dashboard = useDashboard();
  const data = dashboard.data;

  return (
    <Screen onRefresh={() => void dashboard.refetch()} refreshing={dashboard.isRefetching}>
      <ScreenHeader title="Overview" />

      <StateView
        loading={dashboard.isLoading}
        error={dashboard.error}
        onRetry={() => void dashboard.refetch()}
      >
        {data ? (
          <>
            {/*
              Waiting on a person, so it leads - and these are the only tinted
              cards on the page. If everything were coloured, nothing would be.
            */}
            <Section title="Needs attention" first>
              <StatGrid>
                <Stat
                  label="Payments to approve"
                  value={String(data.payments_pending_approval)}
                  icon="approvals"
                  tone={data.payments_pending_approval > 0 ? 'attention' : 'neutral'}
                  meta={
                    data.payments_pending_approval === 0 ? 'Nothing waiting' : 'Review and decide'
                  }
                  /*
                    Only where this account may actually go.

                    A cashier holds collections and members and nothing else,
                    so offering the approvals queue here sends them to a screen
                    that answers 403 - the same gap the sidebar had before its
                    tabs were gated. A figure worth knowing is still worth
                    showing; it simply stops being a door.
                  */
                  onPress={
                    data.payments_pending_approval > 0 && can('payments.view')
                      ? () => router.push('/staff/approvals')
                      : undefined
                  }
                />
                <Stat
                  label="Members to admit"
                  value={String(data.members.inactive)}
                  icon="awaiting"
                  tone={data.members.inactive > 0 ? 'attention' : 'neutral'}
                  meta={data.members.inactive === 0 ? 'None' : 'Not yet admitted'}
                  onPress={can('members.view') ? () => router.push('/staff/members') : undefined}
                />
                <Stat
                  label="Suspended"
                  value={String(data.members.suspended)}
                  icon="suspended"
                  tone={data.members.suspended > 0 ? 'danger' : 'neutral'}
                  meta={data.members.suspended === 0 ? 'None' : 'For arrears'}
                  onPress={can('members.view') ? () => router.push('/staff/members') : undefined}
                />
              </StatGrid>
            </Section>

            <Section title="Collected">
              <StatGrid>
                <Stat label="Instalments" value={money(data.collections.instalments)} icon="pay" />
                <Stat label="Fines" value={money(data.collections.fines)} icon="warning" />
              </StatGrid>
            </Section>

            <Section title="Outstanding">
              <StatGrid>
                <Stat
                  label="Instalments"
                  value={money(data.outstanding.instalments)}
                  icon="dues"
                  tone="danger"
                />
                <Stat
                  label="Fines"
                  value={money(data.outstanding.fines)}
                  icon="warning"
                  tone="danger"
                />
              </StatGrid>

              <Text tone="muted" style={{ ...type.rowMeta, marginTop: space.sm }}>
                Instalments and fines are never added together — an association has to be able to
                say how much of what it is owed is subscription and how much is penalty.
              </Text>
            </Section>

            <Section title="Membership">
              <StatGrid>
                <Stat
                  label="Active members"
                  value={String(data.members.active)}
                  icon="members"
                  meta="Able to sign in and pay"
                  onPress={can('members.view') ? () => router.push('/staff/members') : undefined}
                />
                {/* Keeps a lone card to one column's width instead of letting it
                    stretch across the grid. */}
                <View style={{ flex: 1, minWidth: 190 }} />
              </StatGrid>
            </Section>
          </>
        ) : null}
      </StateView>
    </Screen>
  );
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
