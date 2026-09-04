import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useLedgers, type Ledger } from '@/features/staff/ledgers';
import {
  Button,
  Cell,
  DataTable,
  FilterSelect,
  Icon,
  Panel,
  Screen,
  ScreenHeader,
  Section,
  StateView,
  Text,
  Toolbar,
  type,
  type Column,
} from '@/ui';

/**
 * The chart of accounts.
 *
 * READ-ONLY, AND IT SAYS SO. The API offers a listing and nothing more, so this
 * screen shows what exists rather than offering an edit that would 404. Saying
 * that plainly is better than a screen that looks editable until you press
 * something.
 *
 * WHY THE TYPE FILTER IS CLIENT-SIDE
 * The API takes a `type` query parameter, but using it here would mean a
 * refetch per filter change and - worse - a filter whose options are drawn from
 * an already-filtered list, so selecting "Income" would hide the evidence of
 * every other type. The whole chart is a few dozen rows: fetch it once and
 * filter in place, with the options derived from what the association actually
 * has rather than from a hard-coded list of accounting types it may not use.
 */
export default function LedgersScreen() {
  const ledgers = useLedgers();
  const [type_, setType] = useState('all');

  const rows = ledgers.data ?? [];

  /** Only the types this association actually uses, so no option is a dead end. */
  const typeOptions = useMemo(() => {
    const present = [...new Set(rows.map((l) => l.type).filter(Boolean))] as string[];

    return [
      { value: 'all', label: 'All accounts' },
      ...present.sort().map((t) => ({ value: t, label: capitalise(t) })),
    ];
  }, [rows]);

  const visible = useMemo(
    () => (type_ === 'all' ? rows : rows.filter((l) => l.type === type_)),
    [rows, type_],
  );

  const columns = useMemo<Column<Ledger>[]>(
    () => [
      {
        key: 'name',
        header: 'Ledger',
        width: 220,
        frozen: true,
        render: (row) => <Cell bold>{row.name}</Cell>,
        sort: (row) => row.name,
      },
      {
        key: 'code',
        header: 'Code',
        width: 110,
        render: (row) => <Cell>{row.code ?? '—'}</Cell>,
        sort: (row) => row.code ?? '',
      },
      {
        key: 'group',
        header: 'Group',
        width: 200,
        render: (row) => <Cell>{row.group ?? '—'}</Cell>,
        sort: (row) => row.group ?? '',
      },
      {
        key: 'category',
        header: 'Category',
        width: 180,
        render: (row) => <Cell>{row.category ?? '—'}</Cell>,
        sort: (row) => row.category ?? '',
      },
      {
        key: 'type',
        header: 'Type',
        width: 130,
        render: (row) => <Cell>{row.type ? capitalise(row.type) : '—'}</Cell>,
        sort: (row) => row.type ?? '',
      },
    ],
    [],
  );

  return (
    <Screen onRefresh={() => void ledgers.refetch()} refreshing={ledgers.isRefetching}>
      <ScreenHeader
        title="Chart of accounts"
        subtitle={
          rows.length > 0 ? `${rows.length} active ledger${rows.length === 1 ? '' : 's'}` : undefined
        }
        action={
          <Button size="sm" variant="tertiary" onPress={() => router.back()}>
            <Icon name="back" size={15} tone="muted" />
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      <Section title="Ledgers" first>
        <Toolbar
          filters={
            typeOptions.length > 1 ? (
              <FilterSelect
                options={typeOptions}
                value={type_}
                onChange={setType}
                icon="reports"
                width={190}
              />
            ) : null
          }
        />

        <StateView
          loading={ledgers.isLoading}
          error={ledgers.error}
          empty={visible.length === 0}
          emptyTitle="No ledgers"
          emptyMessage={
            rows.length === 0
              ? 'This association has no chart of accounts yet, so fee heads have nowhere to post.'
              : 'No ledger of that type.'
          }
          onRetry={() => void ledgers.refetch()}
        >
          <DataTable
            columns={columns}
            rows={visible}
            keyExtractor={(row) => row.id}
            pageSize={25}
          />
        </StateView>
      </Section>

      <Section title="Editing">
        {/*
          An absence explained. Somebody setting up an association will look for
          "add a ledger", and knowing it is not here yet beats concluding the
          button is hidden somewhere.
        */}
        <Panel>
          <Text tone="muted" style={type.body}>
            Ledgers cannot be created or changed here yet. Until then a fee head can only
            name an account that already exists in this list.
          </Text>
        </Panel>
      </Section>
    </Screen>
  );
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
