import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/errors';
import { useSession } from '@/features/auth/session';
import {
  useDeleteRole,
  usePermissionCatalogue,
  useSaveRole,
  useStaffRoles,
  type StaffRole,
} from '@/features/staff/admin';
import {
  Button,
  Checkbox,
  Divider,
  Icon,
  Input,
  Panel,
  Row,
  Screen,
  ScreenHeader,
  Section,
  StateView,
  Text,
  TextField,
  space,
  type,
} from '@/ui';

/**
 * Roles: what each kind of account may do.
 *
 * NOT A TABLE, unlike every other listing here. A role is a name and a set of
 * permissions, and the set is the whole content - forty of them, grouped. There
 * is no column to sort and nothing to compare across rows, so a table would be
 * a grid with one meaningful cell per row and that cell too big for it.
 *
 * THREE THINGS AN ASSOCIATION CANNOT DO, all enforced by the server and only
 * mirrored here: delete or rename a seeded role, narrow superadmin, or delete a
 * role somebody still holds. See features/staff/admin.ts.
 */
export default function RolesScreen() {
  const { can } = useSession();

  const roles = useStaffRoles();
  const catalogue = usePermissionCatalogue();
  const save = useSaveRole();
  const remove = useDeleteRole();

  const [editing, setEditing] = useState<StaffRole | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = roles.data ?? [];

  const destroy = async (role: StaffRole) => {
    setError(null);

    try {
      await remove.mutateAsync(role.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The role could not be removed.');
    }
  };

  return (
    <Screen onRefresh={() => void roles.refetch()} refreshing={roles.isRefetching}>
      <ScreenHeader
        title="Roles"
        subtitle={list.length > 0 ? `${list.length} in this association` : undefined}
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
        <Section title={editing ? `Edit ${editing.name}` : 'New role'} first>
          <RoleEditor
            role={editing}
            groups={catalogue.data ?? []}
            pending={save.isPending}
            onCancel={() => {
              setEditing(null);
              setCreating(false);
              setError(null);
            }}
            onSubmit={async (values) => {
              setError(null);

              try {
                await save.mutateAsync({ id: editing?.id, ...values });
                setEditing(null);
                setCreating(false);
              } catch (e) {
                setError(e instanceof ApiError ? e.message : 'The role could not be saved.');
              }
            }}
          />
        </Section>
      ) : (
        <Section title="Roles" first>
          {can('roles.create') ? (
            <View style={{ marginBottom: space.md, alignItems: 'flex-start' }}>
              <Button size="sm" onPress={() => setCreating(true)}>
                <Icon name="add" size={15} tone="inverse" />
                <Button.Label>Add role</Button.Label>
              </Button>
            </View>
          ) : null}

          <StateView
            loading={roles.isLoading}
            error={roles.error}
            empty={list.length === 0}
            emptyTitle="No roles"
            emptyMessage="Roles decide what each staff account may do."
            onRetry={() => void roles.refetch()}
          >
            {list.map((role, index) => (
              <Row
                key={role.id}
                title={role.name}
                meta={[
                  `${role.permissions.length} permission${role.permissions.length === 1 ? '' : 's'}`,
                  `${role.users} account${role.users === 1 ? '' : 's'}`,
                  role.is_seeded ? 'built in' : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                footer={
                  ! role.is_editable ? (
                    /*
                      Superadmin. Saying why it cannot be edited is the whole
                      value of the line - otherwise a greyed-out row reads as a
                      bug rather than as a rule.
                    */
                    <Text tone="muted" style={type.rowMeta}>
                      Holds every permission, including ones added by a later
                      release. It cannot be narrowed.
                    </Text>
                  ) : undefined
                }
                trailing={
                  can('roles.delete') && ! role.is_seeded && role.users === 0 ? (
                    <Button
                      size="sm"
                      variant="danger"
                      isDisabled={remove.isPending}
                      onPress={() => void destroy(role)}
                    >
                      <Button.Label>Remove</Button.Label>
                    </Button>
                  ) : undefined
                }
                onPress={
                  can('roles.edit') && role.is_editable ? () => setEditing(role) : undefined
                }
                divider={index < list.length - 1}
              />
            ))}
          </StateView>
        </Section>
      )}
    </Screen>
  );
}

function RoleEditor({
  role,
  groups,
  pending,
  onCancel,
  onSubmit,
}: {
  role: StaffRole | null;
  groups: { name: string; group: string }[];
  pending: boolean;
  onCancel: () => void;
  onSubmit: (values: { name: string; permissions: string[] }) => void;
}) {
  const [name, setName] = useState(role?.name ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions ?? []));

  // Grouped as the server groups them, so the editor reads as "Fees",
  // "Accounting" rather than forty checkboxes in one column.
  const grouped = useMemo(() => {
    const byGroup = new Map<string, string[]>();

    for (const permission of groups) {
      byGroup.set(permission.group, [...(byGroup.get(permission.group) ?? []), permission.name]);
    }

    return [...byGroup.entries()];
  }, [groups]);

  const toggle = (permission: string) =>
    setSelected((current) => {
      const next = new Set(current);
      next.has(permission) ? next.delete(permission) : next.add(permission);
      return next;
    });

  return (
    <View style={{ gap: space.lg }}>
      {role ? null : (
        <View style={{ maxWidth: 380 }}>
          <Text style={{ ...type.rowMeta, marginBottom: 4 }}>Name</Text>
          <TextField>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="e.g. cashier"
              autoCapitalize="none"
            />
          </TextField>
        </View>
      )}

      {grouped.map(([group, permissions]) => (
        <View key={group} style={{ gap: space.sm }}>
          <Text tone="muted" style={{ ...type.section, textTransform: 'uppercase' }}>
            {group}
          </Text>

          {permissions.map((permission) => (
            <View
              key={permission}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
            >
              <Checkbox
                isSelected={selected.has(permission)}
                onSelectedChange={() => toggle(permission)}
              />
              {/*
                The raw permission name, deliberately. "members.suspend" is
                what the API refuses on and what an error message will name, so
                a prettified label would leave the reader translating between
                two vocabularies for the same thing.
              */}
              <Text style={type.body}>{permission}</Text>
            </View>
          ))}

          <Divider />
        </View>
      ))}

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button variant="secondary" onPress={onCancel}>
          <Button.Label>Cancel</Button.Label>
        </Button>

        <Button
          isDisabled={pending || selected.size === 0 || (! role && name.trim() === '')}
          onPress={() => onSubmit({ name: name.trim(), permissions: [...selected] })}
        >
          <Button.Label>
            {pending ? 'Saving…' : role ? 'Save permissions' : 'Create role'}
          </Button.Label>
        </Button>
      </View>
    </View>
  );
}
