import { useState } from 'react';
import { download } from '@/api/client';
import { ApiError } from '@/api/errors';
import { Button, Icon, Spinner, Text, space, type } from '@/ui';

/**
 * Open the receipt for a completed payment (FR-PAY-14).
 *
 * ONLY FOR COMPLETED PAYMENTS, and the caller decides that rather than this
 * component hiding itself. A receipt asserts the association has the money; the
 * server refuses to produce one for anything still in the approvals queue, and
 * a button that appeared and then explained itself with an error would be worse
 * than one that was never there.
 *
 * It goes through the same `download` path as the report exports, for the same
 * reason: the endpoint authenticates with a bearer token in a header, and a
 * plain link carries no headers - the request would arrive unauthenticated and
 * be refused.
 *
 * It lives under payments rather than staff because BOTH surfaces use it - the
 * counter reprints a receipt, and a member opens their own. Only the path
 * differs, which is why the path is a prop.
 */
export function ReceiptButton({
  path,
  invoiceNo,
  compact = false,
}: {
  /** The invoice endpoint - staff and members have their own. */
  path: string;
  invoiceNo: string;
  /** Icon only, for a table row where a labelled button would crowd. */
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setBusy(true);
    setError(null);

    try {
      await download(path, { fallbackName: `${invoiceNo}.pdf` });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The receipt could not be opened.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        isDisabled={busy}
        onPress={() => void open()}
        accessibilityLabel={`Receipt for ${invoiceNo}`}
      >
        {busy ? <Spinner size="sm" /> : <Icon name="print" size={15} tone="muted" />}
        {compact ? null : <Button.Label>Receipt</Button.Label>}
      </Button>

      {error ? (
        <Text tone="danger" style={{ ...type.rowMeta, marginTop: space.xs }}>
          {error}
        </Text>
      ) : null}
    </>
  );
}
