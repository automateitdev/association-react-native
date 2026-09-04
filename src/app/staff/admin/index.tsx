import { router } from 'expo-router';
import { useSession } from '@/features/auth/session';
import { useStaffRoles, useStaffUsers } from '@/features/staff/admin';
import { useLedgers } from '@/features/staff/ledgers';
import { useSettings } from '@/features/staff/settings';
import { Screen, ScreenHeader, Section, StatGrid, Text, Tile, type } from '@/ui';

/**
 * Administration: who works here, and what they may do.
 *
 * Two tiles rather than one screen with two tables, because they are different
 * jobs done at different times. Roles are set up once when an association is
 * onboarded and rarely touched again; accounts change whenever somebody joins
 * or leaves. Putting them on one screen makes the rare, riskier task sit
 * permanently in the way of the routine one.
 */
export default function AdminScreen() {
  const { can } = useSession();

  // Counts on the tiles, so the screen says something rather than being a menu.
  const users = useStaffUsers();
  const roles = useStaffRoles();
  const settings = useSettings();
  const ledgers = useLedgers();

  return (
    <Screen>
      <ScreenHeader title="Admin" subtitle="Staff accounts and what they can do" />

      <Section first>
        <StatGrid>
          {can('users.view') ? (
            <Tile
              title="Staff accounts"
              description={
                users.data
                  ? `${users.data.meta.total} account${users.data.meta.total === 1 ? '' : 's'} · who can sign in`
                  : 'Who can sign in to this association'
              }
              icon="members"
              onPress={() => router.push('/staff/admin/users')}
            />
          ) : null}

          {can('roles.view') ? (
            <Tile
              title="Roles"
              description={
                roles.data
                  ? `${roles.data.length} role${roles.data.length === 1 ? '' : 's'} · what each one may do`
                  : 'What each kind of account may do'
              }
              icon="settings"
              onPress={() => router.push('/staff/admin/roles')}
            />
          ) : null}

          {can('settings.view') ? (
            <Tile
              title="Settings"
              description={
                settings.data
                  ? /*
                      The gateway is the one setting whose absence stops members
                      paying, so it is what the tile reports rather than a count
                      of settings nobody thinks of as countable.
                    */
                    settings.data.gateway.configured
                    ? `Fine ${settings.data.fine.rate} · gateway configured`
                    : 'Fine rules set · no payment gateway yet'
                  : 'Fines, payments, bank details and the gateway'
              }
              icon="settings"
              onPress={() => router.push('/staff/admin/settings')}
            />
          ) : null}

          {can('ledgers.view') ? (
            <Tile
              title="Chart of accounts"
              description={
                ledgers.data
                  ? `${ledgers.data.length} ledger${ledgers.data.length === 1 ? '' : 's'} · where money posts`
                  : 'The accounts fee heads post into'
              }
              icon="reports"
              onPress={() => router.push('/staff/admin/ledgers')}
            />
          ) : null}
        </StatGrid>
      </Section>

      <Section title="Not built yet">
        {/*
          Said rather than left as an absence. An association setting itself up
          will look for these, and knowing they are coming is better than
          concluding the app has hidden them.
        */}
        <Text tone="muted" style={type.body}>
          Association details and the signature used on generated documents are not
          editable here yet, and ledgers can be read but not created or changed.
        </Text>
      </Section>
    </Screen>
  );
}
