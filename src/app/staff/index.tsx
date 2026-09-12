import { router } from 'expo-router';
import { formatMoney, type Money } from '@/api/money';
import { useSession } from '@/features/auth/session';
import { useDashboard, type DashboardBlock } from '@/features/staff/dashboard';
import {
  Button,
  Divider,
  Icon,
  Inline,
  Panel,
  Screen,
  ScreenHeader,
  Section,
  Stack,
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
 * THREE CATEGORIES, THREE SHAPES. Every card on this screen used to be the
 * same size on the same surface, which ranked nothing: "4 payments waiting for
 * you" and "43 members on the register" are an instruction and a fact, and they
 * were set identically. Now the shape says which is which -
 *
 *   what needs doing   large, tinted cards, at the top
 *   the money          ordinary cards, and the chart that gives them a period
 *   the register       one wide strip, because it is reference and not action
 *
 * - and the categories are separated by more space than the things inside them,
 * which is the whole of why a page reads as groups rather than as a list.
 *
 * A VISIBLE CARD IS NOT NECESSARILY A DOOR. Each card has its own permission -
 * `dashboard.approvals`, `dashboard.members` and so on - precisely so a counter
 * clerk can be shown how many payments are waiting without being handed the
 * queue. Seeing a count and being allowed to open what it counts are different
 * questions, so a card links somewhere only when this account may go there.
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
                      emphasis="lead"
                      tone={(data.payments_pending_approval ?? 0) > 0 ? 'attention' : 'neutral'}
                      meta={
                        (data.payments_pending_approval ?? 0) === 0
                          ? 'Nothing waiting'
                          : 'Review and decide'
                      }
                      /*
                        Shown by `dashboard.approvals`, opened by
                        `payments.view`. An operator can be given the first and
                        not the second - which is the whole point of splitting
                        them - so the card is a figure until it is also a door.
                      */
                      onPress={
                        can('payments.view') ? () => router.push('/staff/approvals') : undefined
                      }
                    />
                  ) : null}

                  {shows('members') && data.members ? (
                    <>
                      <Stat
                        label="Members to admit"
                        value={String(data.members.inactive)}
                        icon="awaiting"
                        emphasis="lead"
                        tone={data.members.inactive > 0 ? 'attention' : 'neutral'}
                        meta={data.members.inactive === 0 ? 'None' : 'Not yet admitted'}
                        /*
                          Straight to the ones it counted, when this account may
                          open the register at all. Landing on the whole thing
                          and leaving somebody to find the filter is how a figure
                          and the screen behind it come to disagree.
                        */
                        onPress={
                          can('members.view')
                            ? () => router.push('/staff/members?status=inactive')
                            : undefined
                        }
                      />
                      <Stat
                        label="Suspended"
                        value={String(data.members.suspended)}
                        icon="suspended"
                        emphasis="lead"
                        tone={data.members.suspended > 0 ? 'danger' : 'neutral'}
                        meta={data.members.suspended === 0 ? 'None' : 'For arrears'}
                        onPress={
                          can('members.view')
                            ? () => router.push('/staff/members?status=suspended')
                            : undefined
                        }
                      />
                    </>
                  ) : null}
                </StatGrid>
              </Section>
            ) : null}

            {shows('collections') && data.collections ? (
              <Section title="The money coming in" icon="pay">
                {/*
                  THIS MONTH LEADS, and the all-time figure follows underneath.

                  All-time collections against all-time arrears reads as a
                  failing association when it may be a young one: the two cover
                  different spans and are not comparable. What a committee asks
                  is "how are we doing", and a month is the unit that answers it.
                */}
                {/*
                  A STACK, not four children touching. The chart panel sat
                  against the cards above it with nothing between, which made
                  the group read as one undifferentiated block of surfaces.
                */}
                <Stack gap="lg">
                  <StatGrid>
                    <Stat
                      label="Instalments this month"
                      value={money(data.collections.this_month.instalments)}
                      icon="pay"
                      meta="Since the 1st"
                      onPress={
                        can('reports.paid') ? () => router.push('/staff/reports/paid') : undefined
                      }
                    />
                    <Stat
                      label="Fines this month"
                      value={money(data.collections.this_month.fines)}
                      icon="fine"
                      meta="Since the 1st"
                      onPress={
                        can('reports.paid') ? () => router.push('/staff/reports/paid') : undefined
                      }
                    />
                  </StatGrid>

                  {data.collections.by_month.length > 0 ? (
                    <Panel>
                      <Text tone="muted" style={{ ...type.section, textTransform: 'uppercase' }}>
                        Collected, last six months
                      </Text>

                      <Trend
                        legend={{ primary: 'Instalments', secondary: 'Fines' }}
                        points={data.collections.by_month.map((month) => ({
                          label: month.label,
                          /*
                          Number() for BAR HEIGHTS, which are proportions and
                          not figures anybody reads. Every amount printed on
                          this screen - including the caption below - is still
                          formatted from the server's own decimal string.
                        */
                          value: Number(month.instalments),
                          second: Number(month.fines),
                          caption: `${month.label}: ${money(month.instalments)} in instalments, ${money(month.fines)} in fines`,
                        }))}
                      />

                      <Text tone="muted" style={type.rowMeta}>
                        Touch a month for its figures. Bars are scaled to the largest of them, so
                        they compare months rather than state amounts — and the two are never added
                        together. {money(data.collections.instalments)} in instalments has been
                        collected altogether.
                      </Text>
                    </Panel>
                  ) : null}
                </Stack>
              </Section>
            ) : null}

            {shows('outstanding') && data.outstanding ? (
              <Section title="What is still owed" icon="dues">
                <Stack gap="md">
                  <StatGrid>
                    {/*
                      NOT `danger`, which is what these were.

                      Arrears are the normal condition of a cooperative, not an
                      emergency, and a permanently red ৳1,24,000 spends the one
                      signal this screen has on a number that is simply large.
                      Red is kept for the suspended card above - something a
                      person has to put right. The heading says what these are.
                    */}
                    <Stat
                      label="Instalments"
                      value={money(data.outstanding.instalments)}
                      icon="dues"
                      meta="Owed now"
                      onPress={
                        can('reports.due') ? () => router.push('/staff/reports/due') : undefined
                      }
                    />
                    <Stat
                      label="Fines"
                      value={money(data.outstanding.fines)}
                      icon="fine"
                      meta="Owed now"
                      onPress={
                        can('reports.due') ? () => router.push('/staff/reports/due') : undefined
                      }
                    />
                  </StatGrid>

                  <Text tone="muted" style={type.rowMeta}>
                    Instalments and fines are never added together — an association has to be able
                    to say how much of what it is owed is subscription and how much is penalty.
                  </Text>
                </Stack>
              </Section>
            ) : null}

            {shows('members') && data.members ? (
              <Section title="The register" icon="members">
                {/*
                  A WIDE STRIP, not a card with a hole beside it.

                  This was one Stat next to an empty spacer, which is a card
                  shaped like the four above it and half a row of nothing. The
                  register is reference rather than action - it is here to be
                  known, not done - so it gets a shape of its own: the whole
                  width, the figure at the end, and no pretence of being another
                  tile in the grid.
                */}
                <Panel>
                  <Inline gap="md" justify="between">
                    <Inline gap="sm">
                      <Icon name="members" size={16} tone="muted" />
                      <Stack gap="xs">
                        <Text style={type.rowTitle}>Active members</Text>
                        <Text tone="muted" style={type.rowMeta}>
                          Able to sign in and pay
                        </Text>
                      </Stack>
                    </Inline>

                    <Text style={{ ...type.statLead, fontVariant: ['tabular-nums'] }}>
                      {data.members.active}
                    </Text>
                  </Inline>

                  {can('members.view') ? (
                    <>
                      <Divider />
                      {/*
                        A button, not a tappable line of text. Text with an
                        onPress has the hit area of the glyphs themselves, which
                        is a fine target with a mouse and a poor one with a
                        thumb - and this app is used on both.
                      */}
                      <Inline gap="sm">
                        <Button
                          size="sm"
                          variant="tertiary"
                          onPress={() => router.push('/staff/members?status=active')}
                        >
                          <Button.Label>Open the register</Button.Label>
                          <Icon name="chevron" size={15} tone="muted" />
                        </Button>
                      </Inline>
                    </>
                  ) : null}
                </Panel>
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
