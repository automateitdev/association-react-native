import { useState } from 'react';
import { download } from '@/api/client';
import { ApiError } from '@/api/errors';
import { useSession } from '@/features/auth/session';
import { Button, Icon, Spinner, Stack, Text, type } from '@/ui';

/**
 * Download one member's whole record as a PDF (legacy `member-pdf/{id}`).
 *
 * NOT ExportButtons. That offers three formats because a person who wants a
 * spreadsheet and a person who wants something to print are after different
 * files. A profile has one form - it is a document to be filed or handed over,
 * and there is no version of it anybody would sum - so it is one button with
 * the word on it rather than three icons.
 *
 * BOTH PERMISSIONS ARE CHECKED HERE, matching the route. The server's check is
 * the one that protects the data; this one keeps a control off the screen that
 * could only ever return 403. An account that may read the register but not
 * take records away as files is a real configuration, not a hypothetical one.
 */
export function MemberProfileButton({ memberId }: { memberId: number }) {
  const { can } = useSession();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!can('members.view') || !can('reports.export')) return null;

  const start = async () => {
    setBusy(true);
    setError(null);

    try {
      await download(`/staff/members/${memberId}/profile`, {
        /*
         * Only used if Content-Disposition does not survive the trip. The
         * server's name carries the membership number, which is what the
         * office files under, so this is deliberately plain rather than a
         * second attempt at the same naming rule.
         */
        fallbackName: `member-profile-${memberId}.pdf`,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The profile could not be downloaded.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap="xs" align="end">
      <Button size="sm" variant="secondary" isDisabled={busy} onPress={() => void start()}>
        {busy ? <Spinner size="sm" /> : <Icon name="print" size={15} tone="muted" />}
        <Button.Label>{busy ? 'Preparing…' : 'Profile PDF'}</Button.Label>
      </Button>

      {/*
        Shown, not swallowed. On a phone this fails every time - `download`
        refuses outside a browser - and a button that does nothing at all is
        the worst version of that.
      */}
      {error ? (
        <Text tone="danger" style={type.rowMeta}>
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
