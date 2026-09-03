import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/errors';
import { useSession } from '@/features/auth/session';
import {
  useCreateStaffUser,
  useDeleteStaffUser,
  useStaffRoles,
  useStaffUsers,
  useUpdateStaffUser,
  type StaffUser,
} from '@/features/staff/admin';
import {
  Button,
  Cell,
  DataTable,
  Divider,
  FilterSelect,
  Icon,
  Input,
  Panel,
  Screen,
  ScreenHeader,
  Section,
  StateView,
  Text,
  TextField,
  Toolbar,
  space,
  type,
  type Column,
} from '@/ui';

/**
 * Staff accounts.
 *
 * WHY THE DESTRUCTIVE CONTROLS ARE SOMETIMES ABSENT
 * -------------------------------------------------
 * The server refuses to delete the last superadmin, or the account you are
 * signed in with, because an association that loses its administration cannot
 * recover it without database access. Those rules live on the server; this
 * screen hides the buttons that would only ever be refused, which is a
 * courtesy rather than the check.
 *
 * The distinction matters if anybody is tempted to "simplify" by removing a
 * server guard because the UI already prevents it.
 */
export default function StaffUsersScreen() {
  const { can, session } = useSession();

  const users = useStaffUsers();
  const roles = useStaffRoles();
  const create = useCreateStaffUser();
  const update = useUpdateStaffUser();
  const remove = useDeleteStaffUser();

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = users.data?.data ?? [];
  const roleOptions = (roles.data ?? []).map((r) => ({ value: r.name, label: r.name }));

  const superadmins = rows.filter((u) => u.role === 'superadmin').length;

  /** Mirrors the server's guards, so a button that would 403 is not offered. */
  const deletable = (user: StaffUser) =>
    user.id !== session?.profile.id && ! (user.role === 'superadmin' && superadmins <= 1);

  const columns = useMemo<Column<StaffUser>[]>(
    () => [
      {
        key: 'name',
        header: 'Name',
        width: 200,
        frozen: true,
        render: (row) => <Cell bold>{row.name}</Cell>,
        sort: (row) => row.name,
      },
      {
        key: 'email',
        header: 'Email',
        width: 240,
        render: (row) => <Cell>{row.email}</Cell>,
        sort: (row) => row.email,
      },
      {
        key: 'role',
        header: 'Role',
        width: 150,
        render: (row) => <Cell>{row.role ?? '—'}</Cell>,
        sort: (row) => row.role ?? '',
      },
      {
        key: 'you',
        header: '',
        width: 90,
        render: (row) =>
          row.id === session?.profile.id ? (
            // Worth marking: it is the one account on this list you cannot
            // delete, and knowing which row is you prevents the attempt.
            <Text tone="accent" numberOfLines={1} style={type.rowMeta}>
              You
            </Text>
          ) : null,
      },
    ],
    [session],
  );

  const submit = async (values: {
    id?: number;
    name: string;
    email: string;
    password: string;
    role: string;
  }) => {
    setError(null);

    try {
      if (values.id) {
        await update.mutateAsync({
          id: values.id,
          name: values.name,
          email: values.email,
          role: values.role,
          // Blank means "leave it alone" - an edit form that does not show the
          // current password cannot mean anything else.
          ...(values.password ? { password: values.password } : {}),
        });
      } else {
        await create.mutateAsync(values);
      }

      setAdding(false);
      setEditing(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The account could not be saved.');
    }
  };

  const destroy = async (user: StaffUser) => {
    setError(null);

    try {
      await remove.mutateAsync(user.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The account could not be removed.');
    }
  };

  return (
    <Screen onRefresh={() => void users.refetch()} refreshing={users.isRefetching}>
      <ScreenHeader
        title="Staff accounts"
        subtitle={users.data ? `${users.data.meta.total} who can sign in` : undefined}
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

      {adding || editing ? (
        <Section title={editing ? 'Edit account' : 'New account'} first>
          <AccountForm
            user={editing}
            roles={roleOptions}
            pending={create.isPending || update.isPending}
            onCancel={() => {
              setAdding(false);
              setEditing(null);
              setError(null);
            }}
            onSubmit={submit}
          />
        </Section>
      ) : null}

      <Section title="Accounts" first={! adding && ! editing}>
        <Toolbar
          filters={null}
          actions={
            can('users.create') && ! adding && ! editing ? (
              <Button size="sm" onPress={() => setAdding(true)}>
                <Icon name="add" size={15} tone="inverse" />
                <Button.Label>Add account</Button.Label>
              </Button>
            ) : undefined
          }
        />

        <StateView
          loading={users.isLoading}
          error={users.error}
          empty={rows.length === 0}
          emptyTitle="No staff accounts"
          emptyMessage="Add an account so somebody can sign in."
          onRetry={() => void users.refetch()}
        >
          <DataTable
            columns={columns}
            rows={rows}
            keyExtractor={(row) => row.id}
            onRowPress={can('users.edit') ? (row) => setEditing(row) : undefined}
            pageSize={25}
          />

          {can('users.delete') ? (
            <View style={{ marginTop: space.lg, gap: space.sm }}>
              <Text tone="muted" style={type.section}>
                REMOVE AN ACCOUNT
              </Text>

              {rows.map((user) => (
                <View
                  key={user.id}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
                >
                  <Text style={{ ...type.body, flex: 1 }} numberOfLines={1}>
                    {user.name}
                  </Text>

                  {deletable(user) ? (
                    <Button
                      size="sm"
                      variant="danger"
                      isDisabled={remove.isPending}
                      onPress={() => void destroy(user)}
                    >
                      <Button.Label>Remove</Button.Label>
                    </Button>
                  ) : (
                    /*
                      Says WHY rather than showing a dead button. "You cannot
                      delete this" with no reason is the kind of thing that
                      sends somebody to look for a bug.
                    */
                    <Text tone="muted" style={type.rowMeta}>
                      {user.id === session?.profile.id
                        ? 'Signed in as this'
                        : 'Only superadmin'}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ) : null}
        </StateView>
      </Section>
    </Screen>
  );
}

function AccountForm({
  user,
  roles,
  pending,
  onCancel,
  onSubmit,
}: {
  user: StaffUser | null;
  roles: { value: string; label: string }[];
  pending: boolean;
  onCancel: () => void;
  onSubmit: (values: {
    id?: number;
    name: string;
    email: string;
    password: string;
    role: string;
  }) => void;
}) {
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(user?.role ?? roles[0]?.value ?? '');

  const complete = name.trim() && email.trim() && role && (user || password.length >= 8);

  return (
    <View style={{ gap: space.md, maxWidth: 460 }}>
      <View>
        <Text style={{ ...type.rowMeta, marginBottom: 4 }}>Name</Text>
        <TextField>
          <Input value={name} onChangeText={setName} placeholder="e.g. Rokeya Begum" />
        </TextField>
      </View>

      <View>
        <Text style={{ ...type.rowMeta, marginBottom: 4 }}>Email</Text>
        <TextField>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="name@association.test"
            autoCapitalize="none"
          />
        </TextField>
      </View>

      <View>
        <Text style={{ ...type.rowMeta, marginBottom: 4 }}>
          {user ? 'New password (leave blank to keep)' : 'Password'}
        </Text>
        <TextField>
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            secureTextEntry
            autoCapitalize="none"
          />
        </TextField>

        {/*
          Said plainly, because it is a real limitation rather than a design
          choice: there is no mail or SMS to send an invitation with, so
          whoever creates the account has to tell the person their password.
        */}
        <Text tone="muted" style={{ ...type.rowMeta, marginTop: 4 }}>
          {user
            ? 'Changing this signs the person out of nothing - their existing sessions continue.'
            : 'There is no email to send this in, so tell them at the desk and ask them to change it.'}
        </Text>
      </View>

      <View>
        <Text style={{ ...type.rowMeta, marginBottom: 4 }}>Role</Text>
        <FilterSelect options={roles} value={role} onChange={setRole} width={220} />
      </View>

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button variant="secondary" onPress={onCancel}>
          <Button.Label>Cancel</Button.Label>
        </Button>

        <Button
          isDisabled={! complete || pending}
          onPress={() =>
            onSubmit({
              id: user?.id,
              name: name.trim(),
              email: email.trim(),
              password,
              role,
            })
          }
        >
          <Button.Label>{pending ? 'Saving…' : user ? 'Save changes' : 'Create account'}</Button.Label>
        </Button>
      </View>

      <Divider />
    </View>
  );
}
