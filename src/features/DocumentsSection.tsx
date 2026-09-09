import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert as RNAlert, Image, Pressable, View } from 'react-native';
import { ApiError } from '@/api/errors';
import {
  fileSize,
  useDeleteDocument,
  useDocumentImage,
  useDocuments,
  usePendingImage,
  useSubmitDocument,
  useUploadDocument,
  type DocumentOwner,
  type DocumentSlot,
} from '@/features/documents';
import { Button, Icon, Panel, Row, Section, StateView, Text, space, type } from '@/ui';

/**
 * The identity documents a member or nominee holds (parity P-10).
 *
 * ONE ROW PER SLOT, FILLED OR NOT, because the useful question is not "what has
 * been uploaded" but "what is still missing". A list that grows as files arrive
 * cannot answer the second, and an officer chasing a member for their NID is
 * doing exactly that.
 *
 * THE PICTURE IS NOT LOADED UNTIL ASKED FOR. Six slots would otherwise mean six
 * photographs downloaded to render a screen that mostly says "not uploaded" -
 * on a connection where staff are often working from a phone.
 *
 * TWO KINDS OF WRITE, AND THEY ARE NOT THE SAME ACT (FR-MEM-8). Staff filing a
 * document REPLACES what the association holds. A member submitting one ASKS
 * them to - it waits, the live document is untouched, and the copy on screen
 * says so. `mode` is which of the two this instance offers.
 */
export function DocumentsSection({
  owner,
  editable,
  mode = 'file',
  title = 'Documents',
  first = false,
}: {
  owner: DocumentOwner;
  /** False for read-only staff, and for a member whose association is suspended. */
  editable: boolean;
  /**
   * `file` replaces what the association holds - staff only.
   * `submit` puts it in front of an officer and changes nothing until approved.
   */
  mode?: 'file' | 'submit';
  title?: string;
  first?: boolean;
}) {
  const documents = useDocuments(owner);
  const [error, setError] = useState<string | null>(null);

  const held = (documents.data ?? []).filter((slot) => slot.uploaded).length;

  return (
    <Section title={title} first={first}>
      {documents.data ? (
        <Text tone="muted" style={{ ...type.rowMeta, marginBottom: space.sm }}>
          {held} of {documents.data.length} on file
        </Text>
      ) : null}

      {error ? (
        <View style={{ marginBottom: space.md }}>
          <Panel tone="danger">
            <Text style={type.body}>{error}</Text>
          </Panel>
        </View>
      ) : null}

      <StateView
        loading={documents.isLoading}
        error={documents.error}
        onRetry={() => void documents.refetch()}
      >
        {/*
          No gap wrapper: Row owns its own padding and hairline, and every other
          list in the app renders straight into the StateView like this. An
          extra gap here made the same rows sit further apart than the dues list
          on the next tab.
        */}
        {(documents.data ?? []).map((slot, index) => (
          <DocumentRow
            key={slot.slot}
            owner={owner}
            slot={slot}
            editable={editable}
            mode={mode}
            // No hairline under the last row - the section ends there.
            divider={index < (documents.data ?? []).length - 1}
            onError={setError}
          />
        ))}
      </StateView>

      {!editable && held === 0 ? (
        <Text tone="muted" style={{ ...type.rowMeta, marginTop: space.sm }}>
          Nothing has been filed yet. Documents are added by the association office.
        </Text>
      ) : null}

      {editable && mode === 'submit' ? (
        <Text tone="muted" style={{ ...type.rowMeta, marginTop: space.md }}>
          Anything you send is reviewed by the office before it replaces what they hold. You will
          see the decision here.
        </Text>
      ) : null}
    </Section>
  );
}

function DocumentRow({
  owner,
  slot,
  editable,
  mode,
  divider,
  onError,
}: {
  owner: DocumentOwner;
  slot: DocumentSlot;
  editable: boolean;
  mode: 'file' | 'submit';
  divider: boolean;
  onError: (message: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showingPending, setShowingPending] = useState(false);

  const upload = useUploadDocument(owner);
  const submit = useSubmitDocument();
  const remove = useDeleteDocument(owner);

  const image = useDocumentImage(owner, slot.slot, open && slot.uploaded);
  const pendingImage = usePendingImage(slot.slot, showingPending && slot.pending);

  const busy = upload.isPending || submit.isPending || remove.isPending;

  const pick = async () => {
    onError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      RNAlert.alert(
        'Photo access needed',
        'The app needs access to your photos so you can attach this document.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      /*
       * Compressed, and cropped to nothing in particular. An NID photographed
       * at full resolution is several megabytes over mobile data to show a card
       * the size of a credit card; the server caps it at 5 MB and would refuse
       * the original.
       */
      quality: 0.7,
      allowsMultipleSelection: false,
    });

    if (result.canceled) return;

    try {
      if (mode === 'submit') {
        await submit.mutateAsync({ slot: slot.slot, asset: result.assets[0] });

        // Opened on the PENDING copy: what the member just sent, not what the
        // association still holds. Showing the old one here would read as the
        // submission having done nothing.
        setShowingPending(true);
      } else {
        await upload.mutateAsync({ slot: slot.slot, asset: result.assets[0] });

        // Opened after a successful upload so the person sees what they filed
        // rather than a row that merely says it worked.
        setOpen(true);
      }
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'That document could not be uploaded.');
    }
  };

  const confirmRemove = () => {
    onError(null);

    /*
     * Asked, because this is not undoable. The file is deleted with the record,
     * and a member who provided their NID at the counter would have to come
     * back with it.
     */
    RNAlert.alert(
      `Remove ${slot.label.toLowerCase()}?`,
      'The file is deleted. It cannot be recovered from here.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove.mutateAsync(slot.slot);
              setOpen(false);
            } catch (e) {
              onError(e instanceof ApiError ? e.message : 'That document could not be removed.');
            }
          },
        },
      ],
    );
  };

  return (
    <Row
      title={slot.label}
      /*
        THE SAME Row AS EVERY OTHER LIST IN THE APP.

        These were hand-built out of Views first, which put a second row style
        on a screen that already had one - different height, different divider,
        different spacing from the dues and history lists a member sees on the
        other tabs. A list that looks like a list everywhere else is worth more
        than any arrangement invented for one screen.
      */
      meta={
        slot.uploaded
          ? [slot.original_name, fileSize(slot.size)].filter(Boolean).join(' · ')
          : 'Not sent yet'
      }
      trailing={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          {slot.uploaded ? (
            <Button size="sm" variant="tertiary" onPress={() => setOpen((was) => !was)}>
              <Button.Label>{open ? 'Hide' : 'View'}</Button.Label>
            </Button>
          ) : null}

          {editable ? (
            <Button size="sm" variant="secondary" isDisabled={busy} onPress={() => void pick()}>
              <Button.Label>
                {busy
                  ? 'Sending…'
                  : mode === 'submit'
                    ? slot.uploaded || slot.pending
                      ? 'Send a new one'
                      : 'Send'
                    : slot.uploaded
                      ? 'Replace'
                      : 'Upload'}
              </Button.Label>
            </Button>
          ) : null}

          {/* Removing is staff work: a member cannot delete what the office holds. */}
          {editable && mode === 'file' && slot.uploaded ? (
            <Pressable
              onPress={confirmRemove}
              disabled={busy}
              accessibilityLabel={`Remove ${slot.label}`}
            >
              <Icon name="close" size={16} tone="danger" />
            </Pressable>
          ) : null}
        </View>
      }
      footer={
        <>
          {/*
            WAITING, and said in the member's own terms. A member who believes
            their new NID is already on file stops carrying the old one.
          */}
          {slot.pending ? (
            <View style={{ marginTop: space.xs }}>
              <Text tone="accent" style={type.rowMeta}>
                Waiting to be reviewed
                {slot.uploaded ? ' · the office is still using the one it has' : ''}
              </Text>

              <Pressable onPress={() => setShowingPending((was) => !was)}>
                <Text tone="muted" style={type.rowMeta}>
                  {showingPending ? 'Hide what you sent' : 'See what you sent'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/*
            Only while nothing newer is waiting - the server stops sending it
            once the member submits again, so a stale complaint cannot linger.
          */}
          {slot.rejected_reason ? (
            <Text tone="danger" style={{ ...type.rowMeta, marginTop: space.xs }}>
              Not accepted: {slot.rejected_reason}
            </Text>
          ) : null}

          {showingPending && slot.pending ? (
            <Preview
              query={pendingImage}
              label={`${slot.label}, waiting to be reviewed`}
            />
          ) : null}

          {open && slot.uploaded ? <Preview query={image} label={slot.label} /> : null}
        </>
      }
      divider={divider}
    />
  );
}

/**
 * An opened document.
 *
 * `contain`, not `cover`: a cropped NID is a document with the number cut off,
 * which is the one thing it is being looked at for.
 */
function Preview({
  query,
  label,
}: {
  query: { data?: string; isLoading: boolean; error: unknown; refetch: () => unknown };
  label: string;
}) {
  return (
    <View style={{ marginTop: space.sm }}>
      <StateView loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}>
        {query.data ? (
          <Image
            source={{ uri: query.data }}
            resizeMode="contain"
            style={{ width: '100%', height: 220, borderRadius: 10 }}
            accessibilityLabel={label}
          />
        ) : null}
      </StateView>
    </View>
  );
}
