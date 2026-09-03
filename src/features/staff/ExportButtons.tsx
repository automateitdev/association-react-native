import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { download } from '@/api/client';
import { ApiError } from '@/api/errors';
import { useSession } from '@/features/auth/session';
import { Icon, Spinner, Text, space, type } from '@/ui';

/**
 * Download this listing (FR-REP-7).
 *
 * THREE FORMATS, NAMED BY WHAT YOU GET.
 * "Export" as a single button raises the question it should be answering -
 * staff who want a spreadsheet and staff who want something to print are
 * after different files, and making them open a menu to find that out is a
 * step for nothing. Three buttons is one tap either way.
 *
 * THE PERMISSION IS CHECKED HERE AS WELL AS ON THE SERVER, and the two do
 * different jobs. The server's check is the one that protects the data; this
 * one keeps a control off the screen that would only ever return 403. An
 * account allowed to read a report but not to take the file away is a real
 * configuration - see the route definitions, which require both permissions.
 */
export function ExportButtons({
  path,
  name,
  query,
  disabled,
  scope,
}: {
  /** The export endpoint, relative to the API root. */
  path: string;
  /** Used only for the fallback filename; the server names the real one. */
  name: string;
  /** The same filters the screen is showing, so the file matches it. */
  query?: Record<string, string | number | undefined>;
  /** While the listing itself is still loading there is nothing to download. */
  disabled?: boolean;
  /**
   * What the file will actually contain - "every member matching these
   * filters, not just this page".
   *
   * The sentence matters: every table here shows a PAGE, and a download does
   * not - an export takes the filters and ignores the paging. A reader looking
   * at 25 of 300 rows will otherwise assume the file is those 25.
   *
   * It was first carried only in the accessible name, on the theory that RN
   * Web would also surface it as a hover tooltip. It does not - `title` is not
   * among the props it forwards to the DOM node, measured - which left sighted
   * users with no way to learn any of this. So it is shown, quietly, beneath
   * the buttons rather than as another paragraph stacked above the table.
   */
  scope?: string;
}) {
  const { can } = useSession();

  /** Which format is in flight - also what disables the other two. */
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!can('reports.export')) return null;

  const start = async (format: 'csv' | 'xlsx' | 'pdf') => {
    setBusy(format);
    setError(null);

    try {
      await download(path, {
        query: { ...query, format },
        /*
         * Only used if Content-Disposition does not survive the trip. The
         * server's name is better - it carries the association and the date -
         * so this is deliberately plain rather than a second attempt at the
         * same naming rule.
         */
        fallbackName: `${name}.${format}`,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The file could not be downloaded.');
    } finally {
      setBusy(null);
    }
  };

  return (
    /*
      alignItems flex-end, so everything here hangs off the RIGHT edge.

      Without it the group is only as wide as its widest child - the scope
      sentence - and the buttons sit left-aligned inside that block, ending
      well short of the table's right edge while appearing to be "the right
      hand side". The note is the wide one, so the note is what has to define
      the edge everything else lines up against.
    */
    <View style={{ alignItems: 'flex-end' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {/*
          The buttons carry no words, so one label does the job for all three.
          Three icons alone are recognisable as file types but say nothing about
          what pressing one DOES.
        */}
        <Text tone="muted" style={{ ...type.rowMeta, marginRight: space.xs }}>
          Download
        </Text>

        {FORMATS.map((format) => (
          <Pressable
            key={format.key}
            // Every button goes down while one is working. Firing off a PDF
            // while a CSV is still generating gives two files and no way to
            // tell which finished.
            disabled={disabled || busy !== null}
            onPress={() => void start(format.key)}
            accessibilityRole="button"
            accessibilityState={{ disabled: disabled || busy !== null }}
            /*
              The accessible name carries what the icon cannot: the format in
              words, and what the file will actually contain. An icon-only
              control that announces itself as "button" is no control at all.
            */
            accessibilityLabel={
              scope ? `Download as ${format.label}. ${scope}` : `Download as ${format.label}`
            }
            className="border border-border rounded-md"
            style={{
              width: 34,
              height: 30,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: disabled || busy !== null ? 0.4 : 1,
            }}
          >
            {busy === format.key ? (
              <Spinner size="sm" />
            ) : (
              /*
                Coloured by FORMAT, not by status - green for the spreadsheet,
                red for the PDF, plain for CSV. These are the conventions the
                file types already carry everywhere else, which is what lets
                three icons replace three words.

                Worth being deliberate about the red: `danger` in this palette
                otherwise means destructive. It reads as PDF rather than as
                "delete" only because it sits in a row of three file-type
                glyphs under a Download label - which is why that label is not
                optional.
              */
              <Icon name={format.icon} size={16} tone={format.tone} />
            )}
          </Pressable>
        ))}
      </View>

      {scope ? (
        <Text tone="muted" style={{ ...type.rowMeta, marginTop: space.xs, textAlign: 'right' }}>
          {scope}
        </Text>
      ) : null}

      {error ? (
        <Text tone="danger" style={{ ...type.rowMeta, marginTop: space.sm, textAlign: 'right' }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const FORMATS = [
  // Excel first: it is what a treasurer actually opens. CSV is the one you
  // reach for to feed something else, and PDF is the one you print or send.
  { key: 'xlsx', label: 'Excel', icon: 'table', tone: 'success' },
  { key: 'csv', label: 'CSV', icon: 'document', tone: 'muted' },
  { key: 'pdf', label: 'PDF', icon: 'print', tone: 'danger' },
] as const;
