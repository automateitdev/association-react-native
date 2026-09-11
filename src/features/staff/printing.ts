import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ImagePickerAsset } from 'expo-image-picker';
import { download, fetchDataUri, request } from '@/api/client';

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
  signature: (role: string) => ['staff', 'signatories', role, 'image'] as const,
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
 * The signature image, for looking at.
 *
 * WITHOUT IT THE UPLOAD IS UNVERIFIABLE. An association files a scan and then
 * prints forty certificates with it; seeing what was filed, before rather than
 * after, is the difference between a mistake caught and a batch reprinted.
 * `has_signature` says one exists - it cannot say it is the right way up.
 *
 * Fetched only when somebody opens the row: a signature nobody is looking at is
 * a picture downloaded to render a line of text.
 */
export function useSignatureImage(role: string, enabled: boolean) {
  return useQuery({
    queryKey: printingKeys.signature(role),
    enabled,
    staleTime: 60 * 60 * 1000,
    retry: false,
    queryFn: () => fetchDataUri(`/staff/signatories/${role}/signature`),
  });
}

export function useUploadSignature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ role, asset }: { role: string; asset: ImagePickerAsset }) => {
      const form = new FormData();

      /*
       * The three keys React Native's FormData needs for a file. The cast is
       * unavoidable: RN accepts this shape and the DOM typings do not describe
       * it - the same trick the document uploads use.
       */
      form.append('file', {
        uri: asset.uri,
        name: asset.fileName ?? `${role}-signature.png`,
        type: asset.mimeType ?? 'image/png',
      } as unknown as Blob);

      return (
        await request<{ data: Signatory[] }>(`/staff/signatories/${role}/signature`, {
          method: 'POST',
          formData: form,
        })
      ).data;
    },

    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: printingKeys.signatories() });

      /*
       * And the picture itself. The list and the image are separate queries, so
       * invalidating the list alone would leave the OLD signature on screen
       * under a row that says a new one was filed - which reads as the upload
       * having silently failed.
       */
      void queryClient.removeQueries({ queryKey: printingKeys.signature(variables.role) });
    },
  });
}

export function useRemoveSignature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (role: string) =>
      (
        await request<{ data: Signatory[] }>(`/staff/signatories/${role}/signature`, {
          method: 'DELETE',
        })
      ).data,

    onSuccess: (_data, role) => {
      void queryClient.invalidateQueries({ queryKey: printingKeys.signatories() });
      void queryClient.removeQueries({ queryKey: printingKeys.signature(role) });
    },
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
