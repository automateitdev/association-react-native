import { router } from 'expo-router';
import { useSession } from '@/features/auth/session';
import { Row, Screen, ScreenHeader, Section, Text, type } from '@/ui';

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
        {can('reports.due') ? (
          <Row
            title="Outstanding dues"
            meta="Who owes what, as at a date"
            onPress={() => router.push('/staff/reports/due')}
          />
        ) : null}

        {can('reports.paid') ? (
          <Row
            title="Memberwise paid"
            meta="What each member has actually paid, over a period"
            onPress={() => router.push('/staff/reports/paid')}
            divider={false}
          />
        ) : null}
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
