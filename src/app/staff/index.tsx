import { router } from 'expo-router';
import { View } from 'react-native';
import { formatMoney, type Money } from '@/api/money';
import { useSession } from '@/features/auth/session';
import { useDashboard, type DashboardBlock } from '@/features/staff/dashboard';
import {
  Panel,
  Screen,
  ScreenHeader,
  Section,
  Stat,
  StatGrid,
  StateView,
  Text,
  Trend,
  type,
} from '@/ui';

/**
 * The staff landing screen.
 *
 * WHAT IS ON IT DEPENDS ON WHO IS LOOKING, AND THE SERVER DECIDES. Each block
 * is gated on the permission that owns the report behind it - a dashboard
 * figure is that report's information, smaller - so a cashier sees the queue
 * and the register and not the association's arrears. This screen renders what
 * arrived and says so when that is nothing; it does not itself decide who may
 * see what, because a rule enforced in a client is a rule one client enforces.
 *
 * TWO FIGURES WHERE A DASHBOARD USUALLY SHOWS ONE
 * -----------------------------------------------
 * Collections and outstanding are each a pair - instalments and fines, apart -
 * and there is deliberately no "total collected" anywhere. That number would
 * have to be produced by adding two amounts in the app, which it must never do;
 * and a single "collected" figure that silently includes fines is exactly the
 * defect the legacy reports carry (D-1). Two cards is the correct answer here,
 * not a compromise.
 *
 * EVERY FIGURE THAT LEADS SOMEWHERE, LEADS THERE. A dashboard is a set of
 * questions and the answer to each is a screen this app already has. A card
 * showing ৳1,26,000 owed that cannot be opened makes a reader go and find the
 * report themselves - and the one they find may not be the one the figure came
 * from. Cards stop being doors only where this account may not walk through.
 */
export default function DashboardScreen() {
  const { can } = useSession();
  const dashboard = useDashboard();

  const data = dashboard.data?.data;
  const visible = dashboard.data?.meta.visible ?? [];

  const shows = (block: DashboardBlock) => visible.includes(block);

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
              NOTHING AT ALL is a real outcome, not a bug. An account holding
              `dashboard.view` and little else - the seeded operator role - can
              legitimately reach this screen and be entitled to none of the
              figures on it. Saying so beats a blank page, which reads as a
              failure to load.
            */}
            {visible.length === 0 ? (
              <Section first>
                <Panel>
                  <Text style={type.rowTitle}>Nothing to show here yet.</Text>
                  <Text tone="muted" style={type.rowMeta}>
                    Your account does not include any of the figures this page carries. What it can
                    reach is in the menu.
                  </Text>
                </Panel>
              </Section>
            ) : null}

            {/*
              Waiting on a person, so it leads - and these are the only tinted
              cards on the page. If everything were coloured, nothing would be.
            */}
            {shows('approvals') || shows('members') ? (
              <Section title="Needs attention" first>
                <StatGrid>
                  {shows('approvals') ? (
                    <Stat
                      label="Payments to approve"
                      value={String(data.payments_pending_approval ?? 0)}
                      icon="approvals"
                      tone={(data.payments_pending_approval ?? 0) > 0 ? 'attention' : 'neutral'}
                      meta={
                        (data.payments_pending_approval ?? 0) === 0
                          ? 'Nothing waiting'
                          : 'Review and decide'
                      }
                      /*
                        No `can` check here any more. The figure only arrived
                        because the server decided this account may see the
                        queue, so the door and the number are one decision
                        instead of two that can drift apart.
                      */
                      onPress={() => router.push('/staff/approvals')}
                    />
                  ) : null}

                  {shows('members') && data.members ? (
                    <>
                      <Stat
                        label="Members to admit"
                        value={String(data.members.inactive)}
                        icon="awaiting"
                        tone={data.members.inactive > 0 ? 'attention' : 'neutral'}
                        meta={data.members.inactive === 0 ? 'None' : 'Not yet admitted'}
                        /*
                          Straight to the ones it counted. Landing on the whole
                          register and leaving somebody to find the filter is
                          how a figure and the screen behind it come to disagree.
                        */
                        onPress={() => router.push('/staff/members?status=inactive')}
                      />
                      <Stat
                        label="Suspended"
                        value={String(data.members.suspended)}
                        icon="suspended"
                        tone={data.members.suspended > 0 ? 'danger' : 'neutral'}
                        meta={data.members.suspended === 0 ? 'None' : 'For arrears'}
                        onPress={() => router.push('/staff/members?status=suspended')}
                      />
                    </>
                  ) : null}
                </StatGrid>
              </Section>
            ) : null}

            {shows('collections') && data.collections ? (
              <Section title="Collected this month">
                {/*
                  THIS MONTH LEADS, and the all-time figure follows underneath.

                  All-time collections against all-time arrears reads as a
                  failing association when it may be a young one: the two cover
                  different spans and are not comparable. What a committee asks
                  is "how are we doing", and a month is the unit that answers it.
                */}
                <StatGrid>
                  <Stat
                    label="Instalments"
                    value={money(data.collections.this_month.instalments)}
                    icon="pay"
                    meta="Since the 1st"
                    onPress={
                      can('reports.paid') ? () => router.push('/staff/reports/paid') : undefined
                    }
                  />
                  <Stat
                    label="Fines"
                    value={money(data.collections.this_month.fines)}
                    icon="warning"
                    meta="Since the 1st"
                    onPress={
                      can('reports.paid') ? () => router.push('/staff/reports/paid') : undefined
                    }
                  />
                </StatGrid>

                {data.collections.by_month.length > 0 ? (
                  <Panel>
                    <Text tone="muted" style={{ ...type.section, textTransform: 'uppercase' }}>
                      Instalments, last six months
                    </Text>

                    <Trend
                      points={data.collections.by_month.map((month) => ({
                        label: month.label,
                        /*
                          Number() for a BAR HEIGHT, which is a proportion and
                          not a figure anybody reads. Every amount printed on
                          this screen is still formatted from the server's own
                          decimal string.
                        */
                        value: Number(month.instalments),
                      }))}
                    />

                    <Text tone="muted" style={type.rowMeta}>
                      Scaled to the largest month, so the bars compare months rather than state
                      amounts. {money(data.collections.instalments)} in instalments has been
                      collected altogether; fines are not charted with them.
                    </Text>
                  </Panel>
                ) : null}
              </Section>
            ) : null}

            {shows('outstanding') && data.outstanding ? (
              <Section title="Outstanding">
                <StatGrid>
                  <Stat
                    label="Instalments"
                    value={money(data.outstanding.instalments)}
                    icon="dues"
                    tone="danger"
                    meta="Owed now"
                    onPress={
                      can('reports.due') ? () => router.push('/staff/reports/due') : undefined
                    }
                  />
                  <Stat
                    label="Fines"
                    value={money(data.outstanding.fines)}
                    icon="warning"
                    tone="danger"
                    meta="Owed now"
                    onPress={
                      can('reports.due') ? () => router.push('/staff/reports/due') : undefined
                    }
                  />
                </StatGrid>

                <Text tone="muted" style={type.rowMeta}>
                  Instalments and fines are never added together — an association has to be able to
                  say how much of what it is owed is subscription and how much is penalty.
                </Text>
              </Section>
            ) : null}

            {shows('members') && data.members ? (
              <Section title="Membership">
                <StatGrid>
                  <Stat
                    label="Active members"
                    value={String(data.members.active)}
                    icon="members"
                    meta="Able to sign in and pay"
                    onPress={() => router.push('/staff/members?status=active')}
                  />
                  {/* Keeps a lone card to one column's width instead of letting
                      it stretch across the grid. */}
                  <View style={{ flex: 1, minWidth: 190 }} />
                </StatGrid>
              </Section>
            ) : null}
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
