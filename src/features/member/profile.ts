import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/api/client';

/**
 * A member asking the office to change their details (FR-MEM-8).
 *
 * NOT AN EDIT, AND THE SCREEN MUST NOT LOOK LIKE ONE. Nothing here changes the
 * member's record: it files a request the office decides on. These fields are
 * how the association identifies somebody at the counter and how it reaches
 * them, so a member who could change their own mobile number unilaterally could
 * change it to somebody else's, and nothing would record that the old one
 * existed.
 *
 * ONE PENDING REQUEST AT A TIME, enforced by the server. Two open requests can
 * be approved in either order and give different results - a race decided by
 * whoever clicks first - so the app shows the pending one rather than offering
 * a second form.
 */

export type ProfileUpdateStatus = 'pending' | 'approved' | 'rejected';

export type ProfileUpdate = {
  id: number;
  /** Only the fields that actually differ, as the server recorded them. */
  changes: Record<string, string | null>;
  status: ProfileUpdateStatus;
  decision_reason: string | null;
  requested_at: string | null;
  decided_at: string | null;
};

export type ProfileUpdatePage = {
  data: ProfileUpdate[];
  meta: {
    /**
     * Which fields may be asked about, from the server.
     *
     * Fetched rather than hard-coded so widening the list does not need an app
     * release (FR-APP-1) - and so the form can never offer a field the request
     * endpoint would reject.
     */
    editable_fields: string[];
  };
};

export const profileUpdateKeys = {
  all: ['me', 'profile-updates'] as const,
};

export function useProfileUpdates() {
  return useQuery({
    queryKey: profileUpdateKeys.all,
    queryFn: () => request<ProfileUpdatePage>('/me/profile-updates'),
  });
}

export function useRequestProfileUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (changes: Record<string, string>) =>
      (
        await request<{ data: ProfileUpdate }>('/me/profile-updates', {
          method: 'POST',
          body: changes,
        })
      ).data,

    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileUpdateKeys.all }),
  });
}

/**
 * `father_name` -> `Father's name`.
 *
 * The server sends field NAMES, because it is the authority on which fields
 * exist and has no business holding English copy. Turning them into something
 * a member reads is the app's job, and an unknown key falls back to a
 * de-underscored version rather than being hidden - a change the office is
 * about to make to your record should never be invisible because the app was
 * one release behind.
 */
export function fieldLabel(field: string): string {
  const known: Record<string, string> = {
    name: 'Name',
    father_name: "Father's name",
    mother_name: "Mother's name",
    spouse_name: "Spouse's name",
    birth_date: 'Date of birth',
    gender: 'Gender',
    mobile: 'Mobile',
    email: 'Email',
    nid: 'NID number',
    present_address: 'Present address',
    permanent_address: 'Permanent address',
    office_address: 'Office address',
    emergency_contact: 'Emergency contact',
  };

  return known[field] ?? field.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}
