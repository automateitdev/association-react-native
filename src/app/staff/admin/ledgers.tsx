import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/errors';
import { useSession } from '@/features/auth/session';
import {
  useAccountGroups,
  useLedgers,
  useSaveLedger,
  type Ledger,
} from '@/features/staff/ledgers';
import {
  Button,
  Cell,
  Checkbox,
  DataTable,
  FilterSelect,
  Form,
  FormActions,
  Icon,
  InputField,
  Panel,
  PickerField,
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
 * The chart of accounts, and the form that maintains it.
 *
 * WHY THE TYPE FILTER IS CLIENT-SIDE
 * The API takes a `type` query parameter, but using it here would mean a
 * refetch per filter change and - worse - a filter whose options are drawn from
 * an already-filtered list, so selecting "Income" would hide the evidence of
 * every other type. The whole chart is a few dozen rows: fetch it once and
 * filter in place, with the options derived from what the association actually
 * has rather than from a hard-coded list of accounting types it may not use.
 *
 * RETIRED, NOT DELETED
 * A ledger with history cannot be removed, so deactivating is the only exit.
 * The retired ones are hidden until asked for, because the common reason to
 * open this screen is to find an account to post to, and a retired one is never
 * the answer to that.
 *
 * The server refuses two edits this screen does not try to pre-empt: regrouping
 * a ledger that already has postings, and retiring one a fee head still names.
 * Both come back as a sentence naming what is in the way, which is more use
 * than a disabled control that cannot explain itself.
 */
export default function LedgersScreen() {
  const { can } = useSession();

  const [includeInactive, setIncludeInactive] = useState(false);
  const ledgers = useLedgers(includeInactive);
  const groups = useAccountGroups();
  const save = useSaveLedger();

  const [type_, setType] = useState('all');
  const [editing, setEditing] = useState<Ledger | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        render: (row) => (
          <Cell bold>
            {row.name}
            {row.is_active ? '' : ' · retired'}
          </Cell>
        ),
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
        width: 190,
        render: (row) => <Cell>{row.group ?? '—'}</Cell>,
        sort: (row) => row.group ?? '',
      },
      {
        key: 'category',
        header: 'Category',
        width: 160,
        render: (row) => <Cell>{row.category ?? '—'}</Cell>,
        sort: (row) => row.category ?? '',
      },
      {
        key: 'type',
        header: 'Type',
        width: 120,
        render: (row) => <Cell>{row.type ? capitalise(row.type) : '—'}</Cell>,
        sort: (row) => row.type ?? '',
      },
    ],
    [],
  );

  const submit = async (values: {
    id?: number;
    account_group_id: number;
    name: string;
    code: string;
    is_active: boolean;
  }) => {
    setError(null);

    try {
      await save.mutateAsync({
        id: values.id,
        account_group_id: values.account_group_id,
        name: values.name,
        code: values.code.trim() === '' ? null : values.code.trim(),
        is_active: values.is_active,
      });

      setEditing(null);
      setCreating(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The ledger could not be saved.');
    }
  };

  return (
    <Screen onRefresh={() => void ledgers.refetch()} refreshing={ledgers.isRefetching}>
      <ScreenHeader
        title="Chart of accounts"
        subtitle={
          rows.length > 0 ? `${rows.length} ledger${rows.length === 1 ? '' : 's'}` : undefined
        }
        action={
          <Button size="sm" variant="tertiary" onPress={() => router.back()}>
            <Icon name="back" size={15} tone="muted" />
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      {error ? (
        <View style={{ marginTop: space.lg }}>
          <Panel tone="danger">
            <Text style={type.body}>{error}</Text>
          </Panel>
        </View>
      ) : null}

      {editing || creating ? (
        <Section title={editing ? `Edit ${editing.name}` : 'New ledger'} first>
          <LedgerForm
            ledger={editing}
            groups={groups.data ?? []}
            pending={save.isPending}
            onCancel={() => {
              setEditing(null);
              setCreating(false);
              setError(null);
            }}
            onSubmit={submit}
          />
        </Section>
      ) : null}

      <Section title="Ledgers" first={! editing && ! creating}>
        <Toolbar
          filters={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              {typeOptions.length > 1 ? (
                <FilterSelect
                  options={typeOptions}
                  value={type_}
                  onChange={setType}
                  icon="reports"
                  width={180}
                />
              ) : null}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                <Checkbox isSelected={includeInactive} onSelectedChange={setIncludeInactive} />
                <Text tone="muted" style={type.rowMeta}>
                  Show retired
                </Text>
              </View>
            </View>
          }
          actions={
            can('ledgers.create') && ! editing && ! creating ? (
              <Button size="sm" onPress={() => setCreating(true)}>
                <Icon name="add" size={15} tone="inverse" />
                <Button.Label>Add ledger</Button.Label>
              </Button>
            ) : undefined
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
            onRowPress={can('ledgers.edit') ? (row) => setEditing(row) : undefined}
            pageSize={25}
          />
        </StateView>
      </Section>
    </Screen>
  );
}

function LedgerForm({
  ledger,
  groups,
  pending,
  onCancel,
  onSubmit,
}: {
  ledger: Ledger | null;
  groups: { id: number; name: string; category: string | null; type: string | null }[];
  pending: boolean;
  onCancel: () => void;
  onSubmit: (values: {
    id?: number;
    account_group_id: number;
    name: string;
    code: string;
    is_active: boolean;
  }) => void;
}) {
  const [name, setName] = useState(ledger?.name ?? '');
  const [code, setCode] = useState(ledger?.code ?? '');
  const [groupId, setGroupId] = useState(String(ledger?.account_group_id ?? groups[0]?.id ?? ''));
  const [active, setActive] = useState(ledger?.is_active ?? true);

  /*
    "Cash and Bank · Assets" rather than "Cash and Bank". The group name alone
    does not tell somebody whether they are filing this under assets or
    expenses, and that is the decision they are actually making.
  */
  const groupOptions = groups.map((g) => ({
    value: String(g.id),
    label: g.category ? `${g.name} · ${g.category}` : g.name,
  }));

  return (
    <Form>
      <InputField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Welfare Fund"
        required
      />

      <InputField
        label="Code"
        value={code}
        onChangeText={setCode}
        placeholder="Optional"
        autoCapitalize="none"
        hint="Your own reference for this account. Must be unique if you use one."
      />

      <PickerField
        label="Group"
        options={groupOptions}
        value={groupId}
        onChange={setGroupId}
        hint={
          ledger
            ? 'A ledger that already has entries posted against it cannot be moved to another group.'
            : undefined
        }
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Checkbox isSelected={active} onSelectedChange={setActive} />
        <View style={{ flex: 1 }}>
          <Text style={type.body}>In use</Text>
          <Text tone="muted" style={type.rowMeta}>
            Turn off to retire it. Ledgers are never deleted - their history has to stay
            readable - and one a fee head still names cannot be retired.
          </Text>
        </View>
      </View>

      <FormActions>
        <Button variant="secondary" onPress={onCancel}>
          <Button.Label>Cancel</Button.Label>
        </Button>

        <Button
          isDisabled={pending || name.trim() === '' || groupId === ''}
          onPress={() =>
            onSubmit({
              id: ledger?.id,
              account_group_id: Number(groupId),
              name: name.trim(),
              code,
              is_active: active,
            })
          }
        >
          <Button.Label>
            {pending ? 'Saving…' : ledger ? 'Save ledger' : 'Create ledger'}
          </Button.Label>
        </Button>
      </FormActions>
    </Form>
  );
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
