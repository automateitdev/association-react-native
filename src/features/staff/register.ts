import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/client';

/**
 * The membership register: the office record for every member.
 *
 * A different question from the member list, which is why it is a different
 * screen. "Who is member 114, when did they join, which batch were they in"
 * is record-keeping; the member list is about who owes what.
 *
 * `shares` is reported and never editable. It is derived from completed
 * payments and share transfers, and hand-editing it is precisely how the legacy
 * system ended up with six members holding shares nobody had bought (D-19).
 */

export type RegisterEntry = {
  id: number;
  member_id: number;
  membership_no: string;
  name: string;
  join_date: string | null;
  share_no: string;
  shares: number;
  bcs_batch: string;
  company: string;
  designation: string;
  /** Mirrors members.status, which StatusBadge renders. */
  status: 'active' | 'inactive' | 'suspended';
};

export type RegisterPage = {
  data: RegisterEntry[];
  meta: { current_page: number; total: number; last_page: number; per_page: number };
};

export const registerKeys = {
  list: (q: string, page: number) => ['staff', 'register', { q, page }] as const,
};

export function useRegister(q: string, page: number) {
  return useQuery({
    queryKey: registerKeys.list(q, page),
    queryFn: async () => {
      const query = new URLSearchParams({ page: String(page) });

      if (q.trim() !== '') {
        query.set('q', q.trim());
      }

      return await request<RegisterPage>(`/staff/associator-infos?${query.toString()}`);
    },
    placeholderData: (previous) => previous,
  });
}
