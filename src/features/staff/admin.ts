import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/api/client';

/**
 * Staff accounts and roles (FR-RBAC-1, FR-RBAC-2).
 *
 * THE SERVER OWNS EVERY GUARD, and the screens only mirror them.
 *
 * The last superadmin cannot be deleted or demoted, an account cannot delete
 * itself, seeded roles cannot be removed or renamed, superadmin cannot be
 * narrowed, and a role somebody holds cannot be deleted. All of that is
 * enforced by the API - the app disables controls to save a pointless round
 * trip, never as the check itself. An association locked out of its own
 * administration cannot be recovered without database access, so the rule that
 * matters is the one on the server.
 */

export type StaffUser = {
  id: number;
  name: string;
  email: string;
  /** One role per account. */
  role: string | null;
  created_at: string | null;
};

export type StaffRole = {
  id: number;
  name: string;
  permissions: string[];
  /** How many accounts hold it - what makes a role undeletable. */
  users: number;
  /** One of the three FR-RBAC-2 requires, so it cannot be deleted or renamed. */
  is_seeded: boolean;
  /** False for superadmin, which holds everything by definition. */
  is_editable: boolean;
};

export type PermissionOption = { name: string; group: string };

export const adminKeys = {
  users: ['staff', 'admin', 'users'] as const,
  roles: ['staff', 'admin', 'roles'] as const,
  permissions: ['staff', 'admin', 'permissions'] as const,
};

export function useStaffUsers() {
  return useQuery({
    queryKey: adminKeys.users,
    queryFn: async () =>
      await request<{ data: StaffUser[]; meta: { total: number } }>('/staff/users'),
  });
}

export function useStaffRoles() {
  return useQuery({
    queryKey: adminKeys.roles,
    queryFn: async () => (await request<{ data: StaffRole[] }>('/staff/roles')).data,
  });
}

/**
 * Every permission this build knows about, for the role editor.
 *
 * Fetched rather than hard-coded, and that is the point of FR-APP-1: a release
 * that adds a permission must show up in the editor without the app being
 * rebuilt.
 */
export function usePermissionCatalogue() {
  return useQuery({
    queryKey: adminKeys.permissions,
    queryFn: async () => (await request<{ data: PermissionOption[] }>('/staff/permissions')).data,
    staleTime: 5 * 60_000,
  });
}

export function useCreateStaffUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; email: string; password: string; role: string }) =>
      (await request<{ data: StaffUser }>('/staff/users', { method: 'POST', body: input })).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.users });
      // A role's holder count changed, which is what makes it deletable or not.
      void queryClient.invalidateQueries({ queryKey: adminKeys.roles });
    },
  });
}

export function useUpdateStaffUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: number;
      name?: string;
      email?: string;
      password?: string;
      role?: string;
    }) => (await request<{ data: StaffUser }>(`/staff/users/${id}`, { method: 'PUT', body })).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.users });
      void queryClient.invalidateQueries({ queryKey: adminKeys.roles });
    },
  });
}

export function useDeleteStaffUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) =>
      await request<{ data: { deleted: boolean } }>(`/staff/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.users });
      void queryClient.invalidateQueries({ queryKey: adminKeys.roles });
    },
  });
}

export function useSaveRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id?: number; name: string; permissions: string[] }) =>
      (
        await request<{ data: StaffRole }>(
          input.id ? `/staff/roles/${input.id}` : '/staff/roles',
          {
            method: input.id ? 'PUT' : 'POST',
            body: input.id
              ? // A seeded role cannot be renamed, so an edit sends only what
                // it is allowed to change. Sending the unchanged name would be
                // refused with ROLE_NOT_RENAMEABLE.
                { permissions: input.permissions }
              : { name: input.name, permissions: input.permissions },
          },
        )
      ).data,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: adminKeys.roles }),
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) =>
      await request<{ data: { deleted: boolean } }>(`/staff/roles/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: adminKeys.roles }),
  });
}
