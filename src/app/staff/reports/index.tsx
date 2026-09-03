import { router } from 'expo-router';
import { useSession } from '@/features/auth/session';
import { Screen, ScreenHeader, Section, StatGrid, Text, Tile, type } from '@/ui';

/**
 * The reports available, and what each one answers.
 *
 * Two, and each gets a sentence saying what question it settles. A list of
 * report names tells staff nothing about which to open; "who owes what, right
 * now" does.
 */
export default function ReportsScreen() {
  const { can } = useSession();

  return (
    <Screen>
      <ScreenHeader title="Reports" />

      <Section first>
        {/*
          Cards rather than rows. A list of report NAMES tells staff nothing
          about which to open; each of these is a thing you go into, and the
          sentence under it is what makes the choice.
        */}
        <StatGrid>
          {can('reports.due') ? (
            <Tile
              title="Outstanding dues"
              description="Who owes what, as at any date — by member status"
              icon="dues"
              onPress={() => router.push('/staff/reports/due')}
            />
          ) : null}

          {can('reports.paid') ? (
            <Tile
              title="Memberwise paid"
              description="What each member actually paid over a period — instalments and fines apart"
              icon="pay"
              onPress={() => router.push('/staff/reports/paid')}
            />
          ) : null}
        </StatGrid>
      </Section>

      {/*
        Where the download lives is worth saying once here, because it is not
        on this screen. Each report carries its own, under the filters, so the
        file matches the period and status you are actually looking at - a
        download from this menu could only ever guess at those.
      */}
      {can('reports.export') ? (
        <Section title="Downloads">
          <Text tone="muted" style={type.body}>
            Open a report to download it as Excel, CSV or PDF. The file follows
            the filters you have set, and carries the same totals.
          </Text>
        </Section>
      ) : null}
    </Screen>
  );
}
