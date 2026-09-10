import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ImagePickerAsset } from 'expo-image-picker';
import { fetchDataUri, request } from '@/api/client';

/**
 * Member and nominee identity documents (parity P-10).
 *
 * ONE SLOT, ONE DOCUMENT. The server keeps a fixed list per owner - photograph,
 * NID front and back, signature, and for a member the two proofs - and
 * uploading to a slot replaces whatever was there. So this has no concept of
 * "adding" a document, only of filling or replacing a named one, and the screen
 * follows that rather than showing a list that grows.
 */

/** Which record's documents. Three shapes, because the paths differ. */
export type DocumentOwner =
  /** The signed-in member's own. Read only - see the note on useUploadDocument. */
  { kind: 'me' } | { kind: 'member'; id: number } | { kind: 'nominee'; id: number };

export type DocumentSlot = {
  /** `nid_front`, `signature` … the server's own name for it. */
  slot: string;
  /** What to call it on screen. Comes from the server so the two cannot drift. */
  label: string;
  uploaded: boolean;
  original_name: string | null;
  mime: string | null;
  size: number | null;
  uploaded_at: string | null;

  /**
   * A member's submission waiting on an officer (FR-MEM-8). The fields above
   * still describe what the association HOLDS - a pending upload changes
   * nothing until it is approved, and the screen has to say so.
   */
  pending: boolean;
  pending_id: number | null;
  pending_at: string | null;

  /** Why the last one came back, while nothing newer is waiting. */
  rejected_reason: string | null;
  rejected_at: string | null;
};

/** One member's submission, as the review queue sees it. */
export type DocumentReview = {
  id: number;
  slot: string;
  label: string;
  owner_type: 'member' | 'nominee';
  owner_id: number;
  owner_name: string | null;
  original_name: string;
  mime: string;
  size: number;
  submitted_at: string | null;
};

/**
 * EVERY SLOT COMES BACK, filled or not. A screen that lists only what exists
 * cannot answer "what is this member still missing", which is the question an
 * office actually asks.
 */
function basePath(owner: DocumentOwner): string {
  switch (owner.kind) {
    case 'me':
      return '/me/documents';
    case 'member':
      return `/staff/members/${owner.id}/documents`;
    case 'nominee':
      return `/staff/nominees/${owner.id}/documents`;
  }
}

function ownerKey(owner: DocumentOwner): (string | number)[] {
  return owner.kind === 'me' ? ['documents', 'me'] : ['documents', owner.kind, owner.id];
}

export function useDocuments(owner: DocumentOwner, enabled = true) {
  return useQuery({
    queryKey: ownerKey(owner),
    enabled,
    queryFn: async () => (await request<{ data: DocumentSlot[] }>(basePath(owner))).data,
  });
}

/**
 * The image itself, as something renderable.
 *
 * Fetched rather than linked because the endpoint wants a bearer token and an
 * `<img>` sends none. Cached for an hour: a member's NID does not change while
 * somebody is looking at the screen, and re-fetching it on every focus would
 * mean re-downloading a photograph to show the same photograph.
 *
 * `enabled` is how a screen avoids downloading six images to show six
 * thumbnails nobody has asked to see yet.
 */
export function useDocumentImage(owner: DocumentOwner, slot: string, enabled: boolean) {
  return useQuery({
    queryKey: [...ownerKey(owner), slot, 'image'],
    enabled,
    staleTime: 60 * 60 * 1000,
    retry: false,
    queryFn: () => fetchDataUri(`${basePath(owner)}/${slot}`),
  });
}

/**
 * A member submitting their own, for review.
 *
 * Separate from useUploadDocument because it is a different act with a
 * different outcome: staff filing a document replaces what the association
 * holds, a member submitting one asks them to.
 */
export function useSubmitDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { slot: string; asset: ImagePickerAsset }) => {
      const form = new FormData();

      form.append('slot', input.slot);
      form.append('file', {
        uri: input.asset.uri,
        name: input.asset.fileName ?? `${input.slot}.jpg`,
        type: input.asset.mimeType ?? 'image/jpeg',
      } as unknown as Blob);

      return (
        await request<{ data: DocumentSlot[] }>('/me/documents', {
          method: 'POST',
          formData: form,
        })
      ).data;
    },

    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['documents', 'me'] });
      void queryClient.removeQueries({ queryKey: ['documents', 'me', variables.slot, 'pending'] });
    },
  });
}

/** The member's own pending upload, so they can see what they sent. */
export function usePendingImage(slot: string, enabled: boolean) {
  return useQuery({
    queryKey: ['documents', 'me', slot, 'pending'],
    enabled,
    staleTime: 60 * 60 * 1000,
    retry: false,
    queryFn: () => fetchDataUri(`/me/documents/${slot}/pending`),
  });
}

// ------------------------------------------------------------- staff review

export const reviewKeys = { all: ['document-reviews'] as const };

export function useDocumentReviews(enabled = true) {
  return useQuery({
    queryKey: reviewKeys.all,
    enabled,
    queryFn: async () =>
      (await request<{ data: DocumentReview[] }>('/staff/document-reviews')).data,
  });
}

/** The submitted file, so an officer can look before deciding. */
export function useReviewImage(id: number, enabled: boolean) {
  return useQuery({
    queryKey: [...reviewKeys.all, id, 'image'],
    enabled,
    staleTime: 60 * 60 * 1000,
    retry: false,
    queryFn: () => fetchDataUri(`/staff/document-reviews/${id}`),
  });
}

export function useDecideDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: number; decision: 'approved' | 'rejected'; reason?: string }) =>
      (
        await request<{ data: { id: number; status: string } }>(
          `/staff/document-reviews/${input.id}/decide`,
          { method: 'POST', body: { decision: input.decision, reason: input.reason } },
        )
      ).data,

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewKeys.all });

      // An approved document is now the member's live one, so any open view of
      // that member's documents is stale.
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useUploadDocument(owner: DocumentOwner) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { slot: string; asset: ImagePickerAsset }) => {
      const form = new FormData();

      form.append('slot', input.slot);

      /*
       * The three keys React Native's FormData needs for a file. The cast is
       * unavoidable: RN accepts this shape, the DOM's typings do not describe
       * it, and the same trick is used for payment slips.
       */
      form.append('file', {
        uri: input.asset.uri,
        name: input.asset.fileName ?? `${input.slot}.jpg`,
        type: input.asset.mimeType ?? 'image/jpeg',
      } as unknown as Blob);

      return (
        await request<{ data: DocumentSlot[] }>(basePath(owner), {
          method: 'POST',
          formData: form,
        })
      ).data;
    },

    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ownerKey(owner) });

      /*
       * And the picture, specifically. The list query and the image query are
       * separate, so invalidating the list alone would leave the old photograph
       * on screen under the new filename - which reads as the upload having
       * silently failed.
       */
      void queryClient.removeQueries({ queryKey: [...ownerKey(owner), variables.slot, 'image'] });
    },
  });
}

export function useDeleteDocument(owner: DocumentOwner) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (slot: string) =>
      (
        await request<{ data: DocumentSlot[] }>(`${basePath(owner)}/${slot}`, {
          method: 'DELETE',
        })
      ).data,

    onSuccess: (_data, slot) => {
      void queryClient.invalidateQueries({ queryKey: ownerKey(owner) });
      void queryClient.removeQueries({ queryKey: [...ownerKey(owner), slot, 'image'] });
    },
  });
}

/** Bytes as something a person reads. Only ever shown next to a filename. */
export function fileSize(bytes: number | null): string | null {
  if (bytes === null) return null;

  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
