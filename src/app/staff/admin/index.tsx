import { router } from 'expo-router';
import { useSession } from '@/features/auth/session';
import { useStaffRoles, useStaffUsers } from '@/features/staff/admin';
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
        </StatGrid>
      </Section>

      <Section title="Not built yet">
        {/*
          Said rather than left as an absence. An association setting itself up
          will look for these, and knowing they are coming is better than
          concluding the app has hidden them.
        */}
        <Text tone="muted" style={type.body}>
          Association details and the signature used on generated documents are
          not editable here yet. Gateway credentials are under Settings.
        </Text>
      </Section>
    </Screen>
  );
}
