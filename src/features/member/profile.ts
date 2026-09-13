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

/**
 * What one project's answer looks like, as the member holds it.
 *
 * Mirrors the server's PREFERENCE_ALLOWED. `areas` is always a list - /me
 * sends `[]` rather than null for an unanswered project, so a form can bind to
 * it without every screen guarding the same thing.
 */
export type PreferenceAnswer = {
  areas: string[];
  flat_size_sft: number | null;
  budget: string | null;
  loan_percentage: number | null;
  flats_wanted: number | null;
  introduced_by_member_id: number | null;
  introduced_by_name: string | null;
};

/**
 * The lists the housing-preference section renders from.
 *
 * FETCHED FROM THE MEMBER'S OWN ROUTE, not the staff one - a member holds no
 * staff permission and would get a 403 from
 * `/staff/member-preferences/options`. Both routes serve the same payload from
 * the same place on the server, so the two screens cannot come to offer
 * different budgets.
 */
export type PreferenceOptions = {
  projects: Record<string, string>;
  budgets: Record<string, string>;
  loan_percentages: number[];
  /** Grouped by division, which is how somebody scans for their own district. */
  districts: Record<string, string[]>;
  /** Suggestions, not a closed list - the API accepts any area of Dhaka. */
  dhaka_areas: string[];
};

export const profileUpdateKeys = {
  all: ['me', 'profile-updates'] as const,
  preferenceOptions: ['me', 'preference-options'] as const,
};

export function usePreferenceOptions() {
  return useQuery({
    queryKey: profileUpdateKeys.preferenceOptions,
    queryFn: async () =>
      (await request<{ data: PreferenceOptions }>('/me/preference-options')).data,

    // Districts and budget bands do not change while somebody fills in a form.
    staleTime: 60 * 60 * 1000,
  });
}

export function useProfileUpdates() {
  return useQuery({
    queryKey: profileUpdateKeys.all,
    queryFn: () => request<ProfileUpdatePage>('/me/profile-updates'),
  });
}

export function useRequestProfileUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    /*
     * `nominee` travels NESTED and everything else flat, which is the shape
     * the endpoint takes: it flattens the nominee to `nominee_*` before
     * storing, so one pending row carries both halves and the office decides
     * them together.
     */
    mutationFn: async (changes: Record<string, unknown>) =>
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
/**
 * The three projects, by their key.
 *
 * MIRRORS THE SERVER'S `MemberPreference::PROJECTS`, and is a duplicate on
 * purpose. `fieldLabel` is synchronous and called from lists that hold no
 * query - a decided request in the history, a pending one on the profile - so
 * it cannot wait on `/me/preference-options` to find out what
 * `preference_dhaka_city:budget` is called. Three fixed strings that have not
 * changed since the legacy is a better trade than a label that renders as the
 * key while a fetch is in flight.
 *
 * The keys are what matter and they are checked by the server; if a project
 * were added, the fallback below renders its key rather than hiding the field.
 */
const PROJECT_LABELS: Record<string, string> = {
  dhaka_city: 'Inside Dhaka city',
  near_dhaka: 'Close to Dhaka city',
  other_district: 'Another district',
};

/** `preference_dhaka_city:budget` -> `Inside Dhaka city · Budget`. */
function preferenceLabel(field: string): string | null {
  if (!field.startsWith('preference_')) return null;

  const rest = field.slice('preference_'.length);
  const at = rest.indexOf(':');

  if (at === -1) return null;

  const project = rest.slice(0, at);
  const name = rest.slice(at + 1);

  const names: Record<string, string> = {
    areas: 'Areas',
    flat_size_sft: 'Flat size (sft)',
    budget: 'Budget',
    loan_percentage: 'Bank loan wanted',
    flats_wanted: 'Flats wanted',
    introduced_by_name: 'Told about it by',
    introduced_by_member_id: 'Told about it by (member number)',
  };

  return `${PROJECT_LABELS[project] ?? project} · ${names[name] ?? name.replace(/_/g, ' ')}`;
}

/**
 * A change's value, as a line of text.
 *
 * `areas` IS A LIST, and React renders an array of strings by concatenating
 * them - so "Uttara, Mirpur" came out as "UttaraMirpur" on the pending panel.
 * Anything that shows a proposed value has to go through here.
 */
export function fieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';

  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—';

  return String(value);
}

export function fieldLabel(field: string): string {
  const preference = preferenceLabel(field);

  if (preference) return preference;

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
    country_code: 'Country',

    // The cadre service record - the legacy form's first tab.
    bcs_batch: 'BCS batch',
    cadre_id: 'Cadre ID',
    joining_date: 'Joined the service',

    // The reference who vouched for the applicant. Legacy `ref_name`,
    // `ref_mobile`, `ref_memeber_id_no`.
    introduced_by_name: 'Introduced by',
    introduced_by_mobile: "Introducer's mobile",
    introduced_by_member_id: "Introducer's member number",

    /*
     * The nominee, which the server sends back PREFIXED - one pending row
     * carries `name` and `nominee_name` side by side, as the legacy does.
     * Labelled so a decided request reads "Nominee's name" rather than
     * "Nominee name", which is what the de-underscoring fallback would give.
     */
    nominee_name: "Nominee's name",
    nominee_relation: 'Relationship to you',
    nominee_father_name: "Nominee's father's name",
    nominee_mother_name: "Nominee's mother's name",
    nominee_gender: "Nominee's gender",
    nominee_birth_date: "Nominee's date of birth",
    nominee_nid: "Nominee's NID number",
    nominee_mobile: "Nominee's mobile",
    nominee_country_code: "Nominee's country",
    nominee_address: "Nominee's address",
    nominee_profession: "Nominee's profession",
  };

  return known[field] ?? field.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}
