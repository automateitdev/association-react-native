import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/api/client';

/**
 * The queue of changes members have asked the office to make (FR-MEM-8).
 *
 * WHY MEMBERS DO NOT EDIT THEMSELVES. These fields are how the office
 * identifies somebody at the counter and how the association reaches them.
 * A member who could change their own mobile number unilaterally could change
 * it to somebody else's, and nothing would record that the old one existed.
 *
 * EVERY REQUEST ARRIVES AS A BEFORE AND AFTER. An officer approving
 * "mobile: 017…" cannot judge it without seeing what the number is now — a
 * digit corrected and a number replaced entirely are different decisions, and
 * only one of them looks like somebody taking over an account.
 */

export type ProposedField = {
  field: string;
  current: string | null;
  proposed: string | null;
};

export type ProfileUpdate = {
  id: number;
  member_id: number;
  member_name: string | null;
  member_mobile: string | null;
  fields: ProposedField[];
  status: 'pending' | 'approved' | 'rejected';
  decision_reason: string | null;
  decided_at: string | null;
  requested_at: string | null;
};

export type ProfileUpdatePage = {
  data: ProfileUpdate[];
  meta: {
    current_page: number;
    total: number;
    last_page: number;
    per_page: number;
    /** How many are waiting, whatever this page is filtered to. */
    pending: number;
  };
};

export const profileUpdateKeys = {
  all: ['staff', 'profile-updates'] as const,
  list: (status: string, page: number) => ['staff', 'profile-updates', { status, page }] as const,
};

export function useProfileUpdates(status: string, page: number) {
  return useQuery({
    queryKey: profileUpdateKeys.list(status, page),
    queryFn: async () =>
      await request<ProfileUpdatePage>(
        `/staff/profile-updates?status=${encodeURIComponent(status)}&page=${page}`,
      ),
    placeholderData: (previous) => previous,
  });
}

export function useDecideProfileUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      decision,
      reason,
    }: {
      id: number;
      decision: 'approve' | 'reject';
      /** Required to reject: refusing without saying why leaves a member guessing. */
      reason?: string;
    }) =>
      (
        await request<{ data: ProfileUpdate }>(`/staff/profile-updates/${id}/decide`, {
          method: 'POST',
          body: { decision, reason },
        })
      ).data,

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileUpdateKeys.all });
      // An approval changed the member's record.
      void queryClient.invalidateQueries({ queryKey: ['staff', 'members'] });
    },
  });
}
