import { router } from 'expo-router';
import { View } from 'react-native';
import { formatMoney } from '@/api/money';
import { useSession } from '@/features/auth/session';
import { useFeeSetups, type FeeSetup } from '@/features/staff/fees';
import {
  Amount,
  Button,
  Row,
  Screen,
  ScreenHeader,
  Section,
  StateView,
  Text,
  space,
  type,
} from '@/ui';

/**
 * Fee heads: what the association charges, and where the money posts.
 *
 * Each row shows BOTH ledgers, not just the amount. A fee head whose fines land
 * in the wrong account is invisible until someone reads the income statement
 * months later, and by then the postings are history. Showing the pair here
 * makes a mistake visible at a glance - and makes the separation the platform
 * exists to keep look like a normal part of setting up a fee, rather than a
 * detail buried in a form.
 */
export default function FeeSetupsScreen() {
  const { can } = useSession();
  const setups = useFeeSetups();

  const active = setups.data?.filter((s) => s.is_active) ?? [];
  const inactive = setups.data?.filter((s) => !s.is_active) ?? [];

  return (
    <Screen onRefresh={() => void setups.refetch()} refreshing={setups.isRefetching}>
      <ScreenHeader
        title="Fees"
        subtitle={active.length > 0 ? `${active.length} in use` : undefined}
        action={
          can('fee-setups.create') ? (
            <Button onPress={() => router.push('/staff/fees/new')}>
              <Button.Label>Add</Button.Label>
            </Button>
          ) : undefined
        }
      />

      <StateView
        loading={setups.isLoading}
        error={setups.error}
        empty={(setups.data?.length ?? 0) === 0}
        emptyTitle="No fee heads yet"
        emptyMessage="Add what the association charges before assigning anything to members."
        onRetry={() => void setups.refetch()}
      >
        {can('fee-assigns.create') && active.length > 0 ? (
          <View style={{ marginTop: space.lg }}>
            <Button variant="secondary" onPress={() => router.push('/staff/fees/assign')}>
              <Button.Label>Assign to members</Button.Label>
            </Button>
          </View>
        ) : null}

        <Section title="In use" first>
          {active.map((setup, index) => (
            <FeeRow key={setup.id} setup={setup} divider={index < active.length - 1} />
          ))}
        </Section>

        {inactive.length > 0 ? (
          <Section title="Deactivated">
            <Text tone="muted" style={{ ...type.rowMeta, marginBottom: space.sm }}>
              Kept because assignments reference them. They cannot be assigned again.
            </Text>

            {inactive.map((setup, index) => (
              <FeeRow key={setup.id} setup={setup} divider={index < inactive.length - 1} />
            ))}
          </Section>
        ) : null}
      </StateView>
    </Screen>
  );
}

function FeeRow({ setup, divider }: { setup: FeeSetup; divider: boolean }) {
  const kind = [
    setup.monthly ? 'Monthly' : 'One-off',
    setup.is_share ? 'buys shares' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Row
      title={setup.fee_head}
      meta={kind}
      trailing={<Amount value={setup.amount} />}
      footer={
        /*
          Both accounts, always together. Reading them as a pair is the only way
          to notice that a fee head's fines are pointed at the wrong one.
        */
        <Text tone="muted" style={type.rowMeta}>
          {setup.ledger.name ?? 'No account'} → instalment · {setup.fine_ledger.name ?? 'No account'}{' '}
          → fine
        </Text>
      }
      onPress={() => router.push(`/staff/fees/${setup.id}`)}
      divider={divider}
    />
  );
}
