import { router } from 'expo-router';
import { useSession } from '@/features/auth/session';
import { Screen, ScreenHeader, Section, StatGrid, Text, Tile, type } from '@/ui';

/**
 * The reports available, and what each one answers.
 *
 * Each gets a sentence saying what question it settles. A list of report names
 * tells staff nothing about which to open; "who owes what, right now" does.
 *
 * TWO GROUPS, BECAUSE THEY ARE ABOUT TWO DIFFERENT SUBJECTS.
 *
 * The first two answer questions about a MEMBER - what this person owes, what
 * that person paid. The income statement answers a question about the
 * ASSOCIATION, reads from the ledger rather than from payments, and is written
 * for a committee rather than for the counter. Listed as one undivided row they
 * looked like three of a kind, and a treasurer looking for the year's result
 * had to read all three descriptions to find out which one was not about
 * members.
 *
 * The grouping is also what makes room for what is coming. The legacy keeps a
 * `Core Report` menu of four - balance sheet, trial balance, income statement,
 * cash summary - and only one of them exists here. When the other three arrive
 * they join the second group; without it, this screen would become two
 * unrelated families sharing one heading.
 */
export default function ReportsScreen() {
  const { can } = useSession();

  /*
   * A heading with nothing under it is worse than no heading: it reads as a
   * section that failed to load rather than as one this account cannot see.
   * `reports.income-statement` is genuinely narrower than the other two - the
   * association's own result is not the counter clerk's business - so an
   * account with an empty second group is the ordinary case, not an edge one.
   */
  const members = can('reports.due') || can('reports.paid');
  const accounts = can('reports.income-statement');

  return (
    <Screen>
      <ScreenHeader title="Reports" />

      {members ? (
        <Section title="Member by member" first>
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
      ) : null}

      {accounts ? (
        <Section title="The association's accounts" first={!members}>
          <StatGrid>
            <Tile
              title="Income statement"
              description="What the association earned and spent over a period, and the surplus between them"
              icon="reports"
              onPress={() => router.push('/staff/reports/income-statement')}
            />
          </StatGrid>

          {/*
            Named rather than left absent. An association's treasurer opens this
            group looking for four statements, and "not built yet" is a better
            answer than a group that appears to hold one report by choice - the
            same reason the Admin screen says what it does not have.
          */}
          <Text tone="muted" style={type.rowMeta}>
            Balance sheet, trial balance and cash summary are not built yet.
          </Text>
        </Section>
      ) : null}

      {/*
        Where the download lives is worth saying once here, because it is not
        on this screen. Each report carries its own, under the filters, so the
        file matches the period and status you are actually looking at - a
        download from this menu could only ever guess at those.
      */}
      {can('reports.export') ? (
        <Section title="Downloads">
          <Text tone="muted" style={type.body}>
            Open a report to download it as Excel, CSV or PDF. The file follows the filters you have
            set, and carries the same totals.
          </Text>
        </Section>
      ) : null}
    </Screen>
  );
}
