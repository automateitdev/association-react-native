import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { request } from '@/api/client';
import type { SortState } from '@/ui';

/**
 * Staff member management (FR-MEM-1 … FR-MEM-7).
 *
 * Two asymmetries in the API shape everything downstream, and both are easy to
 * get wrong in a way that fails silently:
 *
 * 1. CREATE ACCEPTS MORE FIELDS THAN UPDATE.
 *    `store` takes gender, NID, birth date, batch, joining date and both
 *    addresses. `update` takes only name, mobile, email, father's name and the
 *    addresses. A form that offers the full set on edit would appear to save
 *    changes that the server never applied - the request succeeds, the fields
 *    are simply not in the validated set. `UpdatableMemberFields` below is the
 *    honest list, and the edit screen is built from it rather than from the
 *    detail shape.
 *
 * 2. A STATUS CHANGE IS NOT AN EDIT.
 *    Status moves through its own endpoints, each recording actor, reason and
 *    IP in `audit_logs`, because suspension and rejection are decisions a member
 *    will ask about months later. Everything except approval REQUIRES a reason.
 */

export type MemberStatus = 'active' | 'inactive' | 'suspended';

/** What the list returns. Deliberately small - it is a list. */
export type MemberSummary = {
  id: number;
  name: string;
  mobile: string;
  email: string | null;
  status: MemberStatus;

  /**
   * Null until the office assigns it.
   *
   * Not an error state and not missing data: a member legitimately exists
   * before anyone knows their number. The association assigns it afterwards,
   * on its own screen, exactly as the legacy system did.
   */
  membership_no: string | null;

  /** Derived from share payments, never typed. */
  shares: number;
};

/** What `show` adds. Most of it is NOT editable - see the asymmetry above. */
export type MemberDetail = MemberSummary & {
  /** The society record the office maintains. */
  join_date: string | null;
  share_no: string | null;
  company: string | null;
  designation: string | null;

  father_name: string | null;
  mother_name: string | null;
  bcs_batch: string | null;
  joining_date: string | null;
  birth_date: string | null;
  gender: 'male' | 'female' | 'other' | null;
  nid: string | null;
  present_address: string | null;
  permanent_address: string | null;
};

/**
 * Exactly the fields `PUT /staff/members/{id}` will act on.
 *
 * Kept as its own type rather than a Partial<MemberDetail> so that adding a
 * field to the detail shape cannot quietly imply it is editable.
 */
export type UpdatableMemberFields = {
  name?: string;
  mobile?: string;
  email?: string | null;
  father_name?: string | null;
  present_address?: string | null;
  permanent_address?: string | null;
};

export type NewMemberFields = {
  name: string;
  mobile: string;
  email?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  bcs_batch?: string | null;
  joining_date?: string | null;
  birth_date?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  nid?: string | null;
  present_address?: string | null;
  permanent_address?: string | null;
};

export type MemberFilters = {
  q?: string;
  status?: MemberStatus | null;
  /** When the office added the member. See the note in useMembers. */
  from?: string;
  to?: string;
};

export type MemberPage = {
  data: MemberSummary[];
  meta: { current_page: number; per_page: number; total: number; last_page: number };
};

export const memberKeys = {
  all: ['staff', 'members'] as const,
  list: (filters: MemberFilters, page: number, sort: SortState) =>
    ['staff', 'members', 'list', filters, page, sort] as const,
  detail: (id: number) => ['staff', 'members', id] as const,
};

/**
 * The member list, one page at a time.
 *
 * PAGED RATHER THAN INFINITE, and this changed.
 *
 * It was an infinite "load more" list, chosen because HeroUI Native ships no
 * pagination control (R-1) and endless scrolling is the better phone pattern.
 * That reasoning held while this was a list of cards. It stopped holding once
 * the listing became a table with numbered pages, because the two cannot both
 * be true: a table that says "Showing 26-43 of 43" has to be able to go
 * BACKWARDS, and an infinite query only ever grows.
 *
 * SEARCH, FILTER, SORT AND PAGE ALL GO TO THE SERVER. Doing any of them here
 * would silently apply to whichever page happened to be loaded, so a member on
 * page three would appear not to exist - a bug that looks like missing data
 * rather than a broken filter.
 *
 * `keepPreviousData` holds the previous page on screen while the next one
 * loads. Without it the table empties and the page height collapses on every
 * press, which reads as the list breaking rather than as it fetching.
 */
export function useMembers(filters: MemberFilters, page: number, sort: SortState) {
  return useQuery({
    queryKey: memberKeys.list(filters, page, sort),
    placeholderData: keepPreviousData,
    queryFn: async () =>
      await request<MemberPage>('/staff/members', {
        query: {
          page,
          per_page: 25,
          ...(filters.q ? { q: filters.q } : {}),
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.from ? { from: filters.from } : {}),
          ...(filters.to ? { to: filters.to } : {}),
          ...(sort ? { sort: sort.key, direction: sort.direction } : {}),
        },
      }),
  });
}

/**
 * Members for a PICKER, loaded a page at a time on demand.
 *
 * Deliberately still an infinite query while the list screen is paged, because
 * the two are answering different questions.
 *
 * A listing is read: you want to know how many there are, jump to the end, sort
 * by shares. Numbered pages serve that. A picker is searched: you type a name,
 * take the one you meant, and never care which page it was on - and on the fee
 * assignment screen you are ticking several before submitting, so a control
 * that reshuffles the list under your selection is actively hostile.
 *
 * Sharing one hook between them was what forced this apart: making the listing
 * pageable broke the picker, which is the honest signal that they were never
 * the same thing.
 */
export function useMemberOptions(filters: MemberFilters) {
  return useInfiniteQuery({
    queryKey: ['staff', 'members', 'options', filters] as const,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      await request<MemberPage>('/staff/members', {
        query: {
          page: pageParam,
          per_page: 25,
          ...(filters.q ? { q: filters.q } : {}),
          ...(filters.status ? { status: filters.status } : {}),
        },
      }),
    getNextPageParam: (last) =>
      last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined,
  });
}

export function useMember(id: number) {
  return useQuery({
    queryKey: memberKeys.detail(id),
    queryFn: async () => (await request<{ data: MemberDetail }>(`/staff/members/${id}`)).data,
  });
}

export function useCreateMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fields: NewMemberFields) =>
      (
        await request<{ data: MemberSummary }>('/staff/members', {
          method: 'POST',
          body: fields,
        })
      ).data,

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: memberKeys.all });
    },
  });
}

export function useUpdateMember(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fields: UpdatableMemberFields) =>
      (
        await request<{ data: MemberDetail }>(`/staff/members/${id}`, {
          method: 'PUT',
          body: fields,
        })
      ).data,

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: memberKeys.all });
    },
  });
}

/**
 * The society record the office assigns, after the member exists.
 *
 * Deliberately excludes `num_or_shares`: that total is maintained by
 * ShareService from share payments and is recomputable from share history. The
 * legacy system let staff type it AND credited it from payments, which is why
 * its two sources disagree.
 */
export type AssociatorInfoFields = {
  membership_no: string;
  join_date?: string | null;
  share_no?: string | null;
  bcs_batch?: string | null;
  company?: string | null;
  designation?: string | null;
};

/**
 * Assign or correct the society record.
 *
 * Numbers are typed, not generated - matching the association's register, where
 * 315 live numbers run 01 to 317 with gaps at 221 and 245. A generator would
 * either refuse to reproduce those gaps or quietly reissue a retired number.
 */
export function useAssignAssociatorInfo(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fields: AssociatorInfoFields) =>
      (
        await request<{ data: MemberDetail }>(`/staff/members/${id}/associator-info`, {
          method: 'PUT',
          body: fields,
        })
      ).data,

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: memberKeys.all });
    },
  });
}

export type MemberTransition = 'approve' | 'reject' | 'suspend' | 'reinstate';

/**
 * Which transitions make sense from a given status, and what each needs.
 *
 * Derived from the endpoints rather than invented: `reject` and `reinstate` are
 * separate from `approve` and `suspend` even though pairs of them land on the
 * same status, because what gets written to the audit log differs - and that
 * record is the whole point.
 *
 * `permission` mirrors the route middleware exactly. Note that one permission
 * covers two endpoints in both cases: members.approve gates approve AND reject,
 * members.suspend gates suspend AND reinstate.
 */
export const TRANSITIONS: Record<
  MemberTransition,
  {
    label: string;
    from: MemberStatus[];
    reasonRequired: boolean;
    permission: string;
    /** Takes something away from the member, so the UI weights it differently. */
    destructive: boolean;
  }
> = {
  approve: {
    label: 'Approve',
    from: ['inactive'],
    // The only one that does not demand a reason: approving is the expected
    // outcome, and requiring justification for it would be noise.
    reasonRequired: false,
    permission: 'members.approve',
    destructive: false,
  },
  reject: {
    label: 'Reject',
    from: ['inactive'],
    reasonRequired: true,
    permission: 'members.approve',
    destructive: true,
  },
  suspend: {
    label: 'Suspend',
    from: ['active'],
    reasonRequired: true,
    permission: 'members.suspend',
    destructive: true,
  },
  reinstate: {
    label: 'Reinstate',
    from: ['suspended'],
    reasonRequired: true,
    permission: 'members.suspend',
    destructive: false,
  },
};

export function useTransitionMember(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { transition: MemberTransition; reason?: string }) =>
      (
        await request<{ data: MemberSummary }>(`/staff/members/${id}/${input.transition}`, {
          method: 'POST',
          body: input.reason ? { reason: input.reason } : {},
        })
      ).data,

    onSuccess: () => {
      // Both the detail and every list cached under any filter: a status change
      // moves the member between filtered views.
      void queryClient.invalidateQueries({ queryKey: memberKeys.all });
    },
  });
}
