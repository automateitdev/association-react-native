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
        Said plainly rather than left as an empty space where a button should
        be. Export is a real requirement (FR-REP-10) with no endpoint behind it
        yet, and staff who expect to download a report should know it is coming
        rather than assume it is broken.
      */}
      <Section title="Not built yet">
        <Text tone="muted" style={type.body}>
          Downloading a report as PDF, Excel or CSV is not available yet. The
          figures on screen are complete and can be read from here.
        </Text>
      </Section>
    </Screen>
  );
}
