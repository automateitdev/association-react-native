import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/api/client';

/**
 * Who a member's savings go to if they die (FR-MEM-9).
 *
 * The legacy system captured nominees on the registration form and then had no
 * screen to change them, so a member who married, was widowed or divorced was
 * stuck with whatever was written on the day they joined. There is no old
 * screen to copy here, only the requirement.
 *
 * `share_percentage` is what makes several nominees a split rather than a list.
 * The server refuses a change taking a member past 100% in total, and returns
 * `allocated_percentage` so the screen can show what is left before anybody
 * tries.
 */

export type Nominee = {
  id: number;
  member_id: number;
  name: string;
  relation: string | null;
  /*
   * WHO THIS PERSON IS, not merely what they are called.
   *
   * A person is identified here by their parents' names as much as by their
   * own, and the association may have to make that identification in front of
   * a bank or a court - which is the whole point of recording a nominee. Every
   * one of the association's 315 nominees carries all three in the legacy
   * system, and this app had nowhere to put them.
   */
  father_name: string | null;
  mother_name: string | null;
  gender: 'male' | 'female' | 'other' | null;
  birth_date: string | null;
  nid: string | null;
  mobile: string | null;
  address: string | null;
  /** A job and a workplace together: "Lecturer, Noakhali S&T University". */
  profession: string | null;
  /** A string, like every figure the app displays - never arithmetic here. */
  share_percentage: string | null;
};

export type NomineeInput = {
  name: string;
  relation?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  nid?: string | null;
  mobile?: string | null;
  address?: string | null;
  profession?: string | null;
  share_percentage?: number | null;
};

export const nomineeKeys = {
  forMember: (memberId: number) => ['staff', 'nominees', memberId] as const,
};

export function useNominees(memberId: number) {
  return useQuery({
    queryKey: nomineeKeys.forMember(memberId),
    queryFn: async () =>
      await request<{
        data: Nominee[];
        meta: { member_id: number; member_name: string; allocated_percentage: string };
      }>(`/staff/members/${memberId}/nominees`),
  });
}

export function useCreateNominee(memberId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: NomineeInput) =>
      (
        await request<{ data: Nominee }>(`/staff/members/${memberId}/nominees`, {
          method: 'POST',
          body,
        })
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: nomineeKeys.forMember(memberId) }),
  });
}

export function useUpdateNominee(memberId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...body }: NomineeInput & { id: number }) =>
      (await request<{ data: Nominee }>(`/staff/nominees/${id}`, { method: 'PUT', body })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: nomineeKeys.forMember(memberId) }),
  });
}

export function useDeleteNominee(memberId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) =>
      await request<{ data: { deleted: boolean } }>(`/staff/nominees/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: nomineeKeys.forMember(memberId) }),
  });
}
