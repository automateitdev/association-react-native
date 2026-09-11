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
 * The grouping is also what made room for what was coming. The legacy keeps a
 * `Core Report` menu of four - balance sheet, trial balance, income statement,
 * cash summary - of which only the income statement existed here when this
 * screen was split in two. All four are now in the second group, with the
 * voucher-wise report under them; without the split this screen would have
 * become two unrelated families sharing one heading.
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
  const accounts =
    can('reports.income-statement') ||
    can('reports.balance-sheet') ||
    can('reports.trial-balance') ||
    can('reports.cash-summary') ||
    can('reports.voucherwise');

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
          {/*
            THE ORDER IS HOW AN ACCOUNTANT READS THEM, not alphabetical. The
            income statement says what happened, the balance sheet what is left
            because of it, the cash summary what of that is money, and the trial
            balance is the check underneath all three - which is why it is
            fourth rather than first: it is the one you open when something is
            wrong. The voucher-wise report is under it for the same reason and
            one step further: the trial balance says the books are out, and this
            is where you go to find which document did it.
          */}
          <StatGrid>
            {can('reports.income-statement') ? (
              <Tile
                title="Income statement"
                description="What the association earned and spent over a period, and the surplus between them"
                icon="reports"
                onPress={() => router.push('/staff/reports/income-statement')}
              />
            ) : null}

            {can('reports.balance-sheet') ? (
              <Tile
                title="Balance sheet"
                description="What the association owns, owes and is worth — as at any date"
                icon="reports"
                onPress={() => router.push('/staff/reports/balance-sheet')}
              />
            ) : null}

            {can('reports.cash-summary') ? (
              <Tile
                title="Cash summary"
                description="What was in the till and the bank, what moved, and what is left"
                icon="pay"
                onPress={() => router.push('/staff/reports/cash-summary')}
              />
            ) : null}

            {can('reports.trial-balance') ? (
              <Tile
                title="Trial balance"
                description="Every account's balance, and whether the books balance at all"
                icon="dues"
                onPress={() => router.push('/staff/reports/trial-balance')}
              />
            ) : null}

            {can('reports.voucherwise') ? (
              <Tile
                title="Voucher-wise report"
                description="Every payment and voucher that reached the ledger, one row each — open one to see its entries"
                icon="document"
                onPress={() => router.push('/staff/reports/voucherwise')}
              />
            ) : null}
          </StatGrid>
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
