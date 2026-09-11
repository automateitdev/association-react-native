import { router, useLocalSearchParams } from 'expo-router';
import { formatMoney } from '@/api/money';
import { useVoucherwiseDocument, type VoucherwiseLine } from '@/features/staff/reports';
import {
  Button,
  Cell,
  DataTable,
  Field,
  Inline,
  NumberCell,
  Panel,
  Screen,
  ScreenHeader,
  Section,
  Stack,
  StateView,
  Text,
  type,
  type Column,
} from '@/ui';

/**
 * One document, line by line.
 *
 * THE HEADING IS THE POINT. The legacy's single-voucher page lists ledger,
 * debit and credit and says nothing whatever about the document they belong to
 * - not its date, its number, its kind, nor whether it was later reversed. A
 * page of figures with no heading cannot be filed, checked or disputed
 * afterwards, which is most of what somebody opens one for.
 *
 * A SEPARATE SCREEN rather than a panel on the listing, for the same reason:
 * this is a document, and a document has a title. It also keeps the listing
 * mounted behind it, so Back returns to the same page of the same filters.
 *
 * TWO THINGS ARE SAID BEFORE THE LINES, when they are true - that this document
 * was later reversed, and that its two sides do not agree. Both change what the
 * figures below mean, and a reader who meets them afterwards has already read
 * the page wrong.
 */
export default function VoucherwiseDocumentScreen() {
  const params = useLocalSearchParams<{ trace: string }>();
  const trace = Number(params.trace);

  const query = useVoucherwiseDocument(Number.isFinite(trace) ? trace : null);
  const document = query.data?.data;

  /*
   * A key, because two lines of one document can be identical.
   *
   * A payment of the same fee twice in one document posts two rows with the
   * same ledger, the same amount and the same note; keyed on their contents,
   * React would treat them as one and render a document short of a line.
   */
  const numbered = (document?.lines ?? []).map((line, at) => ({ ...line, at }));

  const columns: Column<Line>[] = [
    {
      key: 'ledger',
      header: 'Account',
      width: 230,
      frozen: true,
      render: (row) => <Cell>{row.ledger}</Cell>,
    },
    {
      key: 'account_group',
      header: 'Group',
      width: 180,
      render: (row) => <Cell>{row.account_group}</Cell>,
    },
    {
      key: 'narration',
      header: 'Note',
      width: 260,
      render: (row) => <Cell>{row.narration}</Cell>,
    },
    {
      key: 'debit',
      header: 'Debit',
      width: 140,
      align: 'right',
      // A dash on the side an account is not on, as the trial balance does: a
      // column of zeroes beside every figure hides which side each line sits.
      render: (row) => <NumberCell>{side(row.debit)}</NumberCell>,
      total: document ? <NumberCell>{formatMoney(document.total_debit)}</NumberCell> : undefined,
    },
    {
      key: 'credit',
      header: 'Credit',
      width: 140,
      align: 'right',
      render: (row) => <NumberCell>{side(row.credit)}</NumberCell>,
      total: document ? <NumberCell>{formatMoney(document.total_credit)}</NumberCell> : undefined,
    },
  ];

  return (
    <Screen>
      <ScreenHeader
        title={document ? document.number || document.kind_label : 'Document'}
        subtitle={document ? `${document.kind_label} · ${document.posted_on}` : undefined}
        action={
          <Button size="sm" variant="tertiary" onPress={() => router.back()}>
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      <Section first>
        <StateView
          loading={query.isLoading}
          error={query.error}
          empty={document === undefined}
          emptyTitle="No such document"
          emptyMessage="This entry is not in the ledger any more."
          onRetry={() => void query.refetch()}
        >
          {document ? (
            <Stack gap="lg">
              {document.reversed ? (
                /*
                 * Before the figures, not after. A document presented without
                 * this reads as current, and a reader who acts on a reversed
                 * receipt has been misled by a page that was accurate about
                 * every single number printed on it.
                 */
                <Panel tone="danger">
                  <Text style={type.rowTitle}>This document was reversed.</Text>
                  <Text tone="muted" style={type.rowMeta}>
                    A later entry undid it. The amounts below are still in the ledger, cancelled by
                    an equal and opposite pair - nothing here was deleted.
                  </Text>
                </Panel>
              ) : null}

              {document.balanced ? null : (
                <Panel tone="danger">
                  <Text style={type.rowTitle}>
                    The two sides of this document do not agree by{' '}
                    {formatMoney(document.difference)}
                  </Text>
                  <Text tone="muted" style={type.rowMeta}>
                    Nothing this system posts can be unbalanced, so this was almost certainly
                    imported. Check it against the trial balance.
                  </Text>
                </Panel>
              )}

              {/*
                The heading, which is the whole of what the legacy page lacks.
                Five facts about the document, above the figures rather than
                beside them, so the lines below are read as belonging to
                something dated and numbered.
              */}
              <Panel>
                <Field label="Kind" value={document.kind_label} />
                <Field label="Number" value={document.number} />
                <Field label="Date" value={document.posted_on} />
                <Field label="Entries" value={String(document.entries)} />
                <Field
                  label={document.kind === 'payment' ? 'Member' : 'Description'}
                  value={document.description}
                />
              </Panel>

              <DataTable
                columns={columns}
                rows={numbered}
                keyExtractor={(row) => row.at}
                totalsLabel="Total"
                // 0: every line, always. A document is read whole - paginating
                // one would hide half an entry from the pair it balances.
                pageSize={0}
              />

              {document.is_reversal ? (
                <Text tone="muted" style={type.rowMeta}>
                  This document is itself a reversal: it undoes an earlier one, which is why its
                  debits and credits sit opposite to the entry they cancel.
                </Text>
              ) : null}

              {document.member_id !== null ? (
                <Inline gap="sm">
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => router.push(`/staff/members/${document.member_id}`)}
                  >
                    <Button.Label>Open the member</Button.Label>
                  </Button>
                </Inline>
              ) : null}
            </Stack>
          ) : null}
        </StateView>
      </Section>
    </Screen>
  );
}

/** One line, with its position - see `numbered` above. */
type Line = VoucherwiseLine & { at: number };

/** A dash on the side this line is not on, rather than a column of zeroes. */
function side(value: string): string {
  return Number(value) === 0 ? '—' : formatMoney(value);
}
