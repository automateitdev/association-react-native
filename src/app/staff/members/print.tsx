import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ApiError } from '@/api/errors';
import { useMembers } from '@/features/staff/members';
import { printMemberDocuments, useSignatories, type DocumentType } from '@/features/staff/printing';
import {
  Button,
  Cell,
  Checkbox,
  DataTable,
  Icon,
  Inline,
  Panel,
  Screen,
  ScreenHeader,
  SearchField,
  Section,
  Stack,
  StateView,
  Text,
  Toolbar,
  type,
  type Column,
  type SortState,
} from '@/ui';

/**
 * Print share certificates and ID cards (legacy `certificate`, `id-card`).
 *
 * A BATCH, which is how an office prints them and the one thing about the
 * legacy screen worth keeping: it lists members, you tick some, you get one
 * file. Printing forty cards one at a time is not a workflow.
 *
 * TWO WARNINGS BEFORE THE LIST, WHEN THEY APPLY, because both produce a
 * document that looks finished and is not:
 *
 *   - no signatories recorded, so every certificate prints unsigned. In the
 *     legacy production data this is always true - `signatures` holds 0 rows -
 *     and that system says nothing at all about it;
 *   - a member with no shares, whose certificate would state that they hold
 *     none. The server refuses that outright; this says so before somebody
 *     ticks forty boxes and finds out.
 */
export default function PrintScreen() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<DocumentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Active members only: a suspended membership is not something to issue a
  // fresh card for, and an inactive one has not been approved yet.
  const members = useMembers({ status: 'active', q: q || undefined }, page, sort);
  const signatories = useSignatories();

  const rows = members.data?.data ?? [];
  const meta = members.data?.meta;

  const signed = (signatories.data ?? []).filter((s) => s.has_signature).length;

  const toggle = useCallback((id: number) => {
    setSelected((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);

      return next;
    });
  }, []);

  /** The ticked members who hold no shares - a certificate for them is refused. */
  const shareless = useMemo(
    () => rows.filter((row) => selected.has(row.id) && row.shares === 0),
    [rows, selected],
  );

  const print = async (typeToPrint: DocumentType) => {
    setBusy(typeToPrint);
    setError(null);

    try {
      await printMemberDocuments(typeToPrint, [...selected]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That could not be printed.');
    } finally {
      setBusy(null);
    }
  };

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'pick',
      header: 'Pick',
      headerRender: () => (
        <Checkbox
          isSelected={rows.length > 0 && rows.every((row) => selected.has(row.id))}
          onSelectedChange={() =>
            setSelected((current) => {
              const next = new Set(current);
              const all = rows.every((row) => next.has(row.id));

              // This PAGE, not the whole register. Ticking a box that quietly
              // selected three hundred people would be a surprise, and the
              // server caps a batch at 200 anyway.
              rows.forEach((row) => (all ? next.delete(row.id) : next.add(row.id)));

              return next;
            })
          }
        />
      ),
      width: 46,
      frozen: true,
      render: (row) => (
        <Checkbox isSelected={selected.has(row.id)} onSelectedChange={() => toggle(row.id)} />
      ),
    },
    {
      key: 'name',
      header: 'Name',
      width: 230,
      render: (row) => <Cell>{row.name}</Cell>,
    },
    {
      key: 'membership_no',
      header: 'Member no.',
      width: 150,
      render: (row) => <Cell>{row.membership_no ?? '—'}</Cell>,
    },
    {
      key: 'shares',
      header: 'Shares',
      width: 90,
      align: 'right',
      render: (row) => <Cell>{String(row.shares)}</Cell>,
    },
  ];

  return (
    <Screen>
      <ScreenHeader
        title="Print certificates and cards"
        subtitle={selected.size > 0 ? `${selected.size} chosen` : undefined}
        action={
          <Button size="sm" variant="tertiary" onPress={() => router.back()}>
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      <Section first>
        {/*
          Said BEFORE the list. An association with no signatures on file prints
          certificates nobody has authorised, and the legacy system - where this
          is always the case - says nothing at all about it.
        */}
        {signatories.data && signed === 0 ? (
          <Panel tone="warning">
            <Text style={type.rowTitle}>Certificates will print unsigned.</Text>
            <Text tone="muted" style={type.rowMeta}>
              No signature is on file for anyone. Add one under Admin → The association, or print
              now and sign by hand.
            </Text>
          </Panel>
        ) : null}

        {shareless.length > 0 ? (
          <Panel tone="danger">
            <Text style={type.rowTitle}>
              {shareless.length === 1
                ? '1 chosen member holds no shares'
                : `${shareless.length} chosen members hold no shares`}
            </Text>
            <Text tone="muted" style={type.rowMeta}>
              A share certificate states how many shares somebody holds, so these will be refused:{' '}
              {shareless.map((row) => row.name).join(', ')}. An ID card is fine — it says who
              somebody is, not what they own.
            </Text>
          </Panel>
        ) : null}

        {error ? (
          <Panel tone="danger">
            <Text tone="danger" style={type.rowMeta}>
              {error}
            </Text>
          </Panel>
        ) : null}

        <Toolbar
          filters={
            <SearchField
              value={q}
              onChangeText={(value) => {
                setQ(value);
                setPage(1);
              }}
              placeholder="Name or member number"
            />
          }
          actions={
            <Inline gap="sm">
              <Button
                size="sm"
                variant="secondary"
                isDisabled={selected.size === 0 || busy !== null}
                onPress={() => void print('certificate')}
              >
                <Icon name="document" size={15} tone="muted" />
                <Button.Label>
                  {busy === 'certificate' ? 'Preparing…' : 'Share certificates'}
                </Button.Label>
              </Button>

              <Button
                size="sm"
                variant="secondary"
                isDisabled={selected.size === 0 || busy !== null}
                onPress={() => void print('id-card')}
              >
                <Icon name="profile" size={15} tone="muted" />
                <Button.Label>{busy === 'id-card' ? 'Preparing…' : 'ID cards'}</Button.Label>
              </Button>
            </Inline>
          }
        />

        <StateView
          loading={members.isLoading}
          error={members.error}
          empty={rows.length === 0}
          emptyTitle="No active members"
          emptyMessage="Nobody matches that search."
          onRetry={() => void members.refetch()}
        >
          <DataTable
            columns={columns}
            rows={rows}
            keyExtractor={(row) => row.id}
            totalsLabelKey="name"
            onRowPress={(row) => toggle(row.id)}
            server={
              meta
                ? {
                    page: meta.current_page,
                    pageCount: meta.last_page,
                    total: meta.total,
                    pageSize: 25,
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
