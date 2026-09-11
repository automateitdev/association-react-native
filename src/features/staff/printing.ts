import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { download, request } from '@/api/client';

/**
 * Share certificates, ID cards, and who signs them (legacy `certificate`,
 * `id-card`, `signatures`).
 *
 * A PORT OF SOMETHING THAT HAS NEVER WORKED. `signatures` holds 0 rows in the
 * legacy production data, and its certificate template looks signatories up by
 * matching a free-text title against the literals `secretary` and `chairman` -
 * so both `@if`s have always been false and no certificate that system produced
 * has ever been signed.
 *
 * The association's own name, registration number and address are SETTINGS
 * here. The legacy blades carry COCSOL's as literals, which on a multi-tenant
 * platform means a second association printing from them hands its members a
 * card belonging to somebody else.
 */

export type DocumentType = 'certificate' | 'id-card';

export type Signatory = {
  role: 'chairman' | 'secretary' | 'treasurer';
  label: string;
  /** Null when nobody holds the role. */
  name: string | null;
  /**
   * A different question from whether there is a person: an association can
   * record that its secretary is Md. Abdul Karim and still have nothing to
   * print above the line.
   */
  has_signature: boolean;
};

export const printingKeys = {
  signatories: () => ['staff', 'signatories'] as const,
};

export function useSignatories() {
  return useQuery({
    queryKey: printingKeys.signatories(),
    queryFn: async () => (await request<{ data: Signatory[] }>('/staff/signatories')).data,
  });
}

/** Clearing the name removes the person and their signature with them. */
export function useSaveSignatory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ role, name }: { role: string; name: string }) =>
      (
        await request<{ data: Signatory[] }>(`/staff/signatories/${role}`, {
          method: 'PUT',
          body: { name },
        })
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: printingKeys.signatories() }),
  });
}

/**
 * Print for the members chosen.
 *
 * A DOWNLOAD, not a query: the response is a PDF rather than JSON, so it goes
 * through the same helper every export uses - which is also why it is
 * browser-only, and says so rather than failing silently on a phone.
 */
export async function printMemberDocuments(type: DocumentType, memberIds: number[]) {
  await download('/staff/members/print', {
    method: 'POST',
    body: { type, member_ids: memberIds },
    fallbackName: type === 'certificate' ? 'share-certificates.pdf' : 'id-cards.pdf',
  });
}
