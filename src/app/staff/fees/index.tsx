import { router } from 'expo-router';
import { useMemo } from 'react';
import { formatMoney } from '@/api/money';
import { useSession } from '@/features/auth/session';
import { ExportButtons } from '@/features/staff/ExportButtons';
import { useFeeSetups, type FeeSetup } from '@/features/staff/fees';
import {
  Button,
  Cell,
  DataTable,
  Icon,
  NumberCell,
  Screen,
  ScreenHeader,
  Section,
  StateView,
  Text,
  Toolbar,
  space,
  type,
  type Column,
} from '@/ui';

/**
 * Fee heads: what the association charges, and where the money posts.
 *
 * BOTH LEDGERS ARE COLUMNS, not a footnote. A fee head whose fines land in the
 * wrong account is invisible until someone reads the income statement months
 * later, and by then the postings are history. Side by side in a table they can
 * be scanned down in one pass, which is the whole reason this stopped being a
 * list of rows: the question here is comparative - do all of these post where
 * they should - and a row list answers it one fee at a time.
 *
 * Deactivated heads stay in the same table rather than in a section of their
 * own, with a Status column to tell them apart. Two tables made the same
 * comparison twice and let a mis-pointed fine account hide in whichever half
 * the reader was not looking at.
 */
export default function FeeSetupsScreen() {
  const { can } = useSession();
  const setups = useFeeSetups();

  const rows = setups.data ?? [];
  const active = rows.filter((s) => s.is_active).length;

  const columns = useMemo<Column<FeeSetup>[]>(
    () => [
      {
        key: 'fee_head',
        header: 'Fee head',
        width: 190,
        frozen: true,
        render: (row) => <Cell bold>{row.fee_head}</Cell>,
        sort: (row) => row.fee_head,
      },
      {
        key: 'amount',
        header: 'Amount',
        width: 120,
        align: 'right',
        render: (row) => <NumberCell>{formatMoney(row.amount)}</NumberCell>,
        sort: (row) => row.amount,
        sortType: 'decimal',
        /*
         * NO total, deliberately.
         *
         * Summing the amounts of every fee head produces a figure that looks
         * like money and means nothing - nobody is charged the sum of all fee
         * heads. FR-REP-8 asks for totals on summable columns; this column is
         * not summable in any useful sense.
         */
      },
      {
        key: 'monthly',
        header: 'Frequency',
        width: 110,
        render: (row) => <Cell>{row.monthly ? 'Monthly' : 'One-off'}</Cell>,
        sort: (row) => (row.monthly ? 'Monthly' : 'One-off'),
      },
      {
        key: 'ledger',
        header: 'Instalment account',
        width: 180,
        render: (row) => <Cell>{row.ledger.name ?? 'Not set'}</Cell>,
        sort: (row) => row.ledger.name ?? '',
      },
      {
        key: 'fine_ledger',
        header: 'Fine account',
        width: 180,
        render: (row) => <Cell>{row.fine_ledger.name ?? 'Not set'}</Cell>,
        sort: (row) => row.fine_ledger.name ?? '',
      },
      {
        key: 'is_share',
        header: 'Buys shares',
        width: 110,
        render: (row) => <Cell>{row.is_share ? 'Yes' : 'No'}</Cell>,
        sort: (row) => (row.is_share ? 'Yes' : 'No'),
      },
      {
        key: 'is_active',
        header: 'Status',
        width: 120,
        render: (row) => (
          <Text tone={row.is_active ? 'default' : 'muted'} numberOfLines={1} style={type.body}>
            {row.is_active ? 'In use' : 'Deactivated'}
          </Text>
        ),
        sort: (row) => (row.is_active ? 'In use' : 'Deactivated'),
      },
    ],
    [],
  );

  return (
    <Screen onRefresh={() => void setups.refetch()} refreshing={setups.isRefetching}>
      <ScreenHeader
        title="Fees"
        subtitle={active > 0 ? `${active} in use` : undefined}
        action={
          can('fee-setups.create') ? (
            <Button onPress={() => router.push('/staff/fees/new')}>
              <Icon name="add" size={15} tone="inverse" />
              <Button.Label>Add</Button.Label>
            </Button>
          ) : undefined
        }
      />

      <Section title="Fee heads" first>
        {/*
          The toolbar sits OUTSIDE the StateView below it, and that is not a
          layout preference.

          StateView replaces its children with the empty state. With the
          filters inside it, narrowing a list to nothing took the controls
          away along with the rows - so a filter returning no matches could
          not be undone, and the only way out was to reload the page.
          Filtering into a dead end is precisely when those controls are
          needed most.
        */}
        <Toolbar
          filters={
            can('fee-assigns.create') && active > 0 ? (
              <Button variant="secondary" onPress={() => router.push('/staff/fees/assign')}>
                <Icon name="members" size={15} />
                <Button.Label>Assign to members</Button.Label>
              </Button>
            ) : null
          }
          actions={
            can('reports.export') ? (
              <ExportButtons
                path="/staff/fee-setups/export"
                name="fee-heads"
                scope="A setup sheet showing where each fee and each fine posts."
                disabled={setups.isLoading || rows.length === 0}
              />
            ) : undefined
          }
        />

        <StateView
          loading={setups.isLoading}
          error={setups.error}
          empty={rows.length === 0}
          emptyTitle="No fee heads yet"
          emptyMessage="Add what the association charges before assigning anything to members."
          onRetry={() => void setups.refetch()}
        >
          <DataTable
            columns={columns}
            rows={rows}
            keyExtractor={(row) => row.id}
            onRowPress={(row) => router.push(`/staff/fees/${row.id}`)}
            /*
              Client-side paging: unlike the members list and the approvals
              queue, this endpoint returns every fee head in one response - an
              association has a handful, not hundreds.
            */
            pageSize={25}
          />

          <Text tone="muted" style={{ ...type.rowMeta, marginTop: space.sm }}>
            Deactivated heads are kept because assignments reference them. They
            cannot be assigned again.
          </Text>
        </StateView>
      </Section>
    </Screen>
  );
}
