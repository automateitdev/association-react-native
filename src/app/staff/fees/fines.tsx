import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/errors';
import { useAdjustFine, useFinedAssigns, type FinedAssign } from '@/features/staff/fines';
import {
  Amount,
  Button,
  Cell,
  DataTable,
  FilterSelect,
  Form,
  FormActions,
  Icon,
  InputField,
  Panel,
  Screen,
  ScreenHeader,
  Section,
  StateView,
  Text,
  Toolbar,
  space,
  type,
  type Column,
  type SortState,
} from '@/ui';

/**
 * Waiving or correcting a fine.
 *
 * WHY ONLY UNPAID INSTALMENTS APPEAR
 * A fine on a settled instalment cannot be edited. The legacy screen allowed
 * it, rewriting the fine on the instalment and on the payment behind it, which
 * refunds nobody - it just makes the receipt the member is holding disagree
 * with the books. That is a refund, and there is no refund flow yet.
 *
 * The filter defaults to unpaid for that reason: a list where most rows refuse
 * to change is a worse screen than one showing what can actually be acted on.
 * "Paid" is still selectable, because seeing the fine on a settled instalment
 * is reasonable even when changing it is not - those rows simply do not open.
 */
export default function FineAdjustmentScreen() {
  const [status, setStatus] = useState('Unpaid');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>(null);
  const [editing, setEditing] = useState<FinedAssign | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assigns = useFinedAssigns(status, page);
  const adjust = useAdjustFine();

  // The API filters to fined instalments, so the count line and the rows agree.
  const rows = assigns.data?.data ?? [];
  const meta = assigns.data?.meta;

  const columns = useMemo<Column<FinedAssign>[]>(
    () => [
      {
        key: 'member_name',
        header: 'Member',
        width: 200,
        frozen: true,
        render: (row) => <Cell bold>{row.member_name}</Cell>,
      },
      {
        key: 'fee_head',
        header: 'Fee head',
        width: 180,
        render: (row) => <Cell>{row.fee_head}</Cell>,
      },
      { key: 'period', header: 'Period', width: 110, render: (row) => <Cell>{row.period}</Cell> },
      {
        key: 'instalment_amount',
        header: 'Instalment',
        width: 130,
        align: 'right',
        type: 'money',
        render: (row) => <Amount value={row.instalment_amount} />,
      },
      {
        // Its own column, never folded into the instalment. ADR-0005.
        key: 'fine_amount',
        header: 'Fine',
        width: 120,
        align: 'right',
        type: 'money',
        render: (row) => <Amount value={row.fine_amount} />,
      },
      {
        key: 'status',
        header: 'Status',
        width: 110,
        render: (row) => <Cell>{row.status}</Cell>,
      },
    ],
    [],
  );

  const submit = async (fineAmount: string, reason: string) => {
    if (! editing) {
      return;
    }

    setError(null);

    try {
      await adjust.mutateAsync({ feeAssignId: editing.fee_assign_id, fineAmount, reason });
      setEditing(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The fine could not be adjusted.');
    }
  };

  return (
    <Screen onRefresh={() => void assigns.refetch()} refreshing={assigns.isRefetching}>
      <ScreenHeader
        title="Fine adjustment"
        subtitle="Waive or correct a fine before it is paid"
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

      {editing ? (
        <Section title={`${editing.member_name} · ${editing.fee_head} ${editing.period}`} first>
          <AdjustForm
            assign={editing}
            pending={adjust.isPending}
            onCancel={() => {
              setEditing(null);
              setError(null);
            }}
            onSubmit={submit}
          />
        </Section>
      ) : null}

      <Section title="Instalments carrying a fine" first={! editing}>
        <Toolbar
          filters={
            <FilterSelect
              options={[
                { value: 'Unpaid', label: 'Unpaid' },
                { value: 'Requested', label: 'Requested' },
                { value: 'Paid', label: 'Paid' },
                { value: 'all', label: 'All' },
              ]}
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
                setEditing(null);
              }}
              icon="fees"
              width={170}
            />
          }
        />

        <StateView
          loading={assigns.isLoading}
          error={assigns.error}
          empty={rows.length === 0}
          emptyTitle="No fines"
          emptyMessage={
            status === 'Unpaid'
              ? 'No unpaid instalment currently carries a fine.'
              : 'No instalment with that status carries a fine.'
          }
          onRetry={() => void assigns.refetch()}
        >
          <DataTable
            columns={columns}
            rows={rows}
            keyExtractor={(row) => row.fee_assign_id}
            /*
              Paid rows do not open. The server would refuse the change anyway;
              not offering it is kinder than a form that always fails.
            */
            onRowPress={(row) => (row.status === 'Paid' ? undefined : setEditing(row))}
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

function AdjustForm({
  assign,
  pending,
  onCancel,
  onSubmit,
}: {
  assign: FinedAssign;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (fineAmount: string, reason: string) => void;
}) {
  const [amount, setAmount] = useState(assign.fine_amount);
  const [reason, setReason] = useState('');

  const changed = amount.trim() !== '' && amount !== assign.fine_amount;

  return (
    <Form>
      <Panel>
        <Text style={type.body}>
          Currently {assign.fine_amount} on top of an instalment of {assign.instalment_amount}.
        </Text>
        <Text tone="muted" style={{ ...type.rowMeta, marginTop: 4 }}>
          Changing this changes what the member owes. It is recorded against your account
          with the reason you give.
        </Text>
      </Panel>

      <InputField
        label="New fine"
        value={amount}
        onChangeText={setAmount}
        keyboardType="phone-pad"
        required
        hint="Enter 0 to waive it entirely."
      />

      <InputField
        label="Reason"
        value={reason}
        onChangeText={setReason}
        required
        hint="Why it is being changed - the member may ask, possibly years from now."
      />

      <FormActions>
        <Button variant="secondary" onPress={onCancel}>
          <Button.Label>Cancel</Button.Label>
        </Button>

        <Button
          isDisabled={pending || ! changed || reason.trim().length < 3}
          onPress={() => onSubmit(amount.trim(), reason.trim())}
        >
          <Button.Label>{pending ? 'Saving…' : 'Adjust fine'}</Button.Label>
        </Button>
      </FormActions>
    </Form>
  );
}
