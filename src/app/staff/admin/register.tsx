import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ExportButtons } from '@/features/staff/ExportButtons';
import { useRegister, type RegisterEntry } from '@/features/staff/register';
import {
  Button,
  Cell,
  DataTable,
  Icon,
  NumberCell,
  Screen,
  ScreenHeader,
  SearchField,
  Section,
  StateView,
  StatusBadge,
  Toolbar,
  humanDate,
  type Column,
  type SortState,
} from '@/ui';

/**
 * The membership register.
 *
 * WHY THIS IS NOT THE MEMBER LIST
 * They answer different questions. The member list is about money - who owes
 * what, who is suspended. This is the office record: who is member 114, when
 * did they join, which batch, where do they work. The legacy system kept them
 * apart for the same reason and this restores that.
 *
 * SHARES ARE SHOWN AND NOT EDITABLE, anywhere. The number is derived from
 * completed payments and share transfers. Hand-editing it is exactly how the
 * legacy system ended up with six members holding shares nobody had bought
 * (D-19), so no screen offers it - not this one, and not the edit form.
 */
export default function RegisterScreen() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>(null);

  const register = useRegister(q, page);

  const rows = register.data?.data ?? [];
  const meta = register.data?.meta;

  const columns = useMemo<Column<RegisterEntry>[]>(
    () => [
      {
        key: 'membership_no',
        header: 'Member no.',
        width: 120,
        frozen: true,
        render: (row) => <Cell bold>{row.membership_no}</Cell>,
      },
      {
        key: 'name',
        header: 'Name',
        width: 200,
        render: (row) => <Cell>{row.name}</Cell>,
      },
      {
        key: 'join_date',
        header: 'Joined',
        width: 120,
        render: (row) => <Cell>{row.join_date ? humanDate(row.join_date) : '—'}</Cell>,
      },
      {
        key: 'shares',
        header: 'Shares',
        width: 90,
        align: 'right',
        render: (row) => <NumberCell>{String(row.shares)}</NumberCell>,
      },
      {
        key: 'share_no',
        header: 'Share no.',
        width: 110,
        render: (row) => <Cell>{row.share_no || '—'}</Cell>,
      },
      {
        key: 'bcs_batch',
        header: 'Batch',
        width: 110,
        render: (row) => <Cell>{row.bcs_batch || '—'}</Cell>,
      },
      {
        key: 'company',
        header: 'Company',
        width: 200,
        render: (row) => <Cell>{row.company || '—'}</Cell>,
      },
      {
        key: 'designation',
        header: 'Designation',
        width: 170,
        render: (row) => <Cell>{row.designation || '—'}</Cell>,
      },
      {
        key: 'status',
        header: 'Status',
        width: 120,
        render: (row) => <StatusBadge status={row.status} />,
      },
    ],
    [],
  );

  return (
    <Screen onRefresh={() => void register.refetch()} refreshing={register.isRefetching}>
      <ScreenHeader
        title="Membership register"
        subtitle={meta ? `${meta.total} on the register` : undefined}
        action={
          <Button size="sm" variant="tertiary" onPress={() => router.back()}>
            <Icon name="back" size={15} tone="muted" />
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      <Section title="Register" first>
        <Toolbar
          filters={
            <SearchField
              value={q}
              onChangeText={(value) => {
                setQ(value);
                // A filtered result set has a different page 2.
                setPage(1);
              }}
              placeholder="Name or membership number"
            />
          }
          actions={
            <ExportButtons
              path="/staff/associator-infos/export"
              name="membership-register"
              query={{ q: q.trim() === '' ? undefined : q.trim() }}
              disabled={register.isLoading || rows.length === 0}
              scope={
                q.trim() === ''
                  ? 'Everyone on the register'
                  : `Everyone matching “${q.trim()}”`
              }
            />
          }
        />

        <StateView
          loading={register.isLoading}
          error={register.error}
          empty={rows.length === 0}
          emptyTitle="Nobody on the register"
          emptyMessage={
            q.trim() === ''
              ? 'Members appear here once they have been given a membership number.'
              : 'No member matches that name or number.'
          }
          onRetry={() => void register.refetch()}
        >
          <DataTable
            columns={columns}
            rows={rows}
            keyExtractor={(row) => row.id}
            onRowPress={(row) => router.push(`/staff/members/${row.member_id}`)}
            server={
              meta
                ? {
                    page: meta.current_page,
                    pageCount: meta.last_page,
                    total: meta.total,
                    pageSize: meta.per_page,
                    onPageChange: setPage,
                    sort,
                    onSortChange: setSort,
                  }
                : undefined
            }
          />
        </StateView>
      </Section>
    </Screen>
  );
}
