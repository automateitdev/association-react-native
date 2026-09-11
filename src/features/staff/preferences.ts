import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/api/client';

/**
 * What a member wants from the association's housing (legacy `member_choices`).
 *
 * COCSOL is a housing cooperative, so this is the answer to the question it
 * exists to ask - and in the legacy data **18 of 315 members ever answered it**.
 * That figure is the whole reason this is a small screen: it is worth carrying
 * and it is not worth a wizard.
 *
 * The first count of that table reported 273 members as having answered, which
 * is what put it at the top of the sweep. `member_choices` writes three rows per
 * member at registration carrying nothing but a project type, and counting rows
 * "where any column is non-null" counted the scaffolding. Hence `answered`,
 * which the SERVER computes from whether a member actually put something in the
 * row - never from the row existing.
 */

export type PreferenceProject = 'dhaka_city' | 'near_dhaka' | 'other_district';

export type Preference = {
  project: PreferenceProject;
  /** From the server, so the screen holds no copy of what a key means. */
  project_label: string;
  /** Whether the member said anything - not whether a row exists. */
  answered: boolean;
  /**
   * Areas of Dhaka for the first two projects, DISTRICTS for the third.
   *
   * One field, two vocabularies, which is what the legacy does too - the
   * difference being that here the rule is enforced: a district outside the 64
   * is refused, and an area of Dhaka is whatever the member says, because the
   * association's next site will be somewhere nobody has typed yet.
   */
  areas: string[];
  /** A NUMBER. The legacy held seven strings for five sizes: "1,500 sft", "1500 Sft". */
  flat_size_sft: number | null;
  budget: string | null;
  budget_label: string | null;
  /** A percentage, where "No" is 0 - never an amount. */
  loan_percentage: number | null;
  flats_wanted: number | null;
  introduced_by_member_id: number | null;
  /** Resolved from the introducer's own record when they are a member. */
  introduced_by_name: string | null;
};

export type PreferenceInput = {
  areas?: string[];
  flat_size_sft?: number | null;
  budget?: string | null;
  loan_percentage?: number | null;
  flats_wanted?: number | null;
  introduced_by_member_id?: number | null;
  introduced_by_name?: string | null;
};

export type PreferenceOptions = {
  projects: Record<string, string>;
  budgets: Record<string, string>;
  loan_percentages: number[];
  /** Grouped by division, which is how somebody scans for their own district. */
  districts: Record<string, string[]>;
  /** Suggestions, not a closed list - the API accepts any area of Dhaka. */
  dhaka_areas: string[];
};

export const preferenceKeys = {
  forMember: (memberId: number) => ['staff', 'preferences', memberId] as const,
  options: () => ['staff', 'preferences', 'options'] as const,
};

export function usePreferences(memberId: number) {
  return useQuery({
    queryKey: preferenceKeys.forMember(memberId),
    queryFn: async () =>
      await request<{
        data: Preference[];
        meta: { member_id: number; member_name: string; answered: number };
      }>(`/staff/members/${memberId}/preferences`),
  });
}

/**
 * The districts and ranges a client offers.
 *
 * Its own query because it is the same for every member and changes with a
 * release rather than with the data - so it is fetched once and held.
 */
export function usePreferenceOptions() {
  return useQuery({
    queryKey: preferenceKeys.options(),
    queryFn: async () =>
      (await request<{ data: PreferenceOptions }>('/staff/member-preferences/options')).data,
    staleTime: Infinity,
  });
}

/**
 * Record one project's answer.
 *
 * A PUT PER PROJECT: a member has exactly one answer per project and the
 * question is always there to be answered, so there is nothing to create.
 * Sending an empty answer clears it, and the server removes the row rather than
 * leaving the all-null scaffolding the legacy table is full of.
 */
export function useSavePreference(memberId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ project, ...body }: PreferenceInput & { project: PreferenceProject }) =>
      (
        await request<{ data: Preference }>(`/staff/members/${memberId}/preferences/${project}`, {
          method: 'PUT',
          body,
        })
      ).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: preferenceKeys.forMember(memberId) }),
  });
}
