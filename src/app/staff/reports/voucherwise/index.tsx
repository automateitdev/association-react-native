import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { formatMoney } from '@/api/money';
import { ExportButtons } from '@/features/staff/ExportButtons';
import {
  RANGE_PRESETS,
  useVoucherwise,
  type DateRange,
  type DocumentKind,
  type VoucherwiseRow,
} from '@/features/staff/reports';
import {
  Button,
  Cell,
  DataTable,
  DateField,
  FilterSelect,
  Icon,
  Inline,
  NumberCell,
  Panel,
  Screen,
  ScreenHeader,
  SearchField,
  Section,
  Stack,
  StateView,
  Text,
  Toolbar,
  type,
  type Column,
} from '@/ui';

/**
 * Voucher-wise: the ledger read document by document.
 *
 * WHAT THIS ANSWERS THAT THE OTHER FOUR DO NOT. A trial balance says an account
 * holds 4,300 and a cash summary says 4,300 came in; neither can say WHICH
 * documents made it up, and "which" is the question somebody asks the moment a
 * figure looks wrong. So this is a listing, not a statement: one row per
 * payment and per approved voucher, and each row opens.
 *
 * A ROW IS A DOCUMENT, NOT AN ENTRY. A payment of three instalments is one row
 * with six entries behind it. The legacy report lists one row per ENTRY while
 * showing each of them the document's whole total - 15,720 rows standing for
 * 3,378 documents in COCSOL's data, the largest listed 84 times over - so
 * adding up its amounts counts the same money again and again.
 *
 * NOT SORTABLE, and that is deliberate. The order is the one a record of what
 * happened is read in: newest first. See the hook.
 */

/** The value standing for "whatever the calendar was set to". */
const CUSTOM = 'custom';

const KINDS = [
  { value: '', label: 'Every document' },
  { value: 'payment', label: 'Payments' },
  { value: 'voucher', label: 'Vouchers' },
];

export default function VoucherwiseScreen() {
  const [presetKey, setPresetKey] = useState<string | null>('this-month');
  const [draft, setDraft] = useState<DateRange>({});
  const [custom, setCustom] = useState<DateRange | null>(null);
  const [kind, setKind] = useState<DocumentKind | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const range = useMemo(() => {
    if (custom?.from && custom.to) return { from: custom.from, to: custom.to };

    const preset = RANGE_PRESETS.find((p) => p.key === presetKey);
    const resolved = preset ? preset.range(new Date()) : {};
    const today = new Date();

    // A period, always: this report requires both bounds, for the same reason
    // the statements do.
    return {
      from: resolved.from ?? `${today.getFullYear()}-01-01`,
      to: resolved.to ?? today.toISOString().slice(0, 10),
    };
  }, [presetKey, custom]);

  const report = useVoucherwise(range.from, range.to, kind, q, page);
  const meta = report.data?.meta;
  const rows = report.data?.data ?? [];

  /** Any filter change starts again at page one, or page three of the old list shows. */
  const refilter = (change: () => void) => {
    change();
    setPage(1);
  };

  const columns: Column<VoucherwiseRow>[] = [
    {
      key: 'posted_on',
      header: 'Date',
      width: 116,
      frozen: true,
      render: (row) => <Cell>{row.posted_on}</Cell>,
    },
    {
      key: 'kind',
      header: 'Kind',
      width: 96,
      render: (row) => <Cell>{row.kind_label}</Cell>,
    },
    {
      key: 'number',
      header: 'Number',
      width: 150,
      render: (row) => <Cell>{row.number}</Cell>,
    },
    {
      key: 'description',
      header: 'Description',
      width: 230,
      render: (row) => <Cell>{row.description}</Cell>,
    },
    {
      /*
       * The entry count, in its own column. It is what tells a reader that one
       * row stands for six lines - and it is the number that makes the legacy's
       * defect visible the moment the two reports are put side by side.
       */
      key: 'entries',
      header: 'Entries',
      width: 80,
      align: 'right',
      render: (row) => <NumberCell>{String(row.entries)}</NumberCell>,
    },
    {
      key: 'amount',
      header: 'Amount',
      width: 140,
      align: 'right',
      render: (row) => <NumberCell bold>{formatMoney(row.amount)}</NumberCell>,
      total: meta ? <NumberCell bold>{formatMoney(meta.total_amount)}</NumberCell> : undefined,
    },
    {
      /*
       * Only ever a remark, which is why it has no total and is last. The
       * phrase itself comes from the server, so this column and the downloaded
       * file cannot come to disagree about which documents were worth noting.
       */
      key: 'note',
      header: 'Note',
      width: 130,
      render: (row) =>
        row.note === '' ? null : (
          <Inline gap="xs" align="center">
            <Icon name={row.balanced ? 'history' : 'warning'} size={15} tone="danger" />
            <Text tone="danger" style={type.rowMeta}>
              {row.note}
            </Text>
          </Inline>
        ),
    },
  ];

  return (
    <Screen>
      <ScreenHeader
        title="Voucher-wise report"
        subtitle={meta ? `${meta.from} to ${meta.to}` : undefined}
        action={
          <Button size="sm" variant="tertiary" onPress={() => router.back()}>
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      <Section first>
        <Toolbar
          filters={
            <>
              <FilterSelect
                icon="calendar"
                value={custom ? CUSTOM : (presetKey ?? CUSTOM)}
                options={[
                  ...RANGE_PRESETS.filter((p) => p.key !== 'all').map((p) => ({
                    value: p.key,
                    label: p.label,
                  })),
                  { value: CUSTOM, label: 'Chosen dates' },
                ]}
                onChange={(value) => {
                  if (value === CUSTOM) return;

                  refilter(() => {
                    setPresetKey(value);
                    setCustom(null);
                    setDraft({});
                  });
                }}
              />

              <DateField
                value={custom ?? draft}
                onChange={(next) => {
                  setDraft(next);

                  if (next.from && next.to) {
                    refilter(() => {
                      setCustom(next);
                      setPresetKey(null);
                    });
                  }
                }}
                placeholder="Choose a period"
                onClear={() =>
                  refilter(() => {
                    setCustom(null);
                    setDraft({});
                    setPresetKey('this-month');
                  })
                }
              />

              <FilterSelect
                icon="document"
                value={kind ?? ''}
                options={KINDS}
                onChange={(value) =>
                  refilter(() => setKind(value === '' ? null : (value as DocumentKind)))
                }
              />

              <SearchField
                value={q}
                onChangeText={(value) => refilter(() => setQ(value))}
                placeholder="Invoice or voucher number"
              />
            </>
          }
          actions={
            <ExportButtons
              path="/staff/reports/voucherwise/export"
              name="voucherwise"
              scope="Every document matching these filters, not just this page."
              query={{
                from: range.from,
                to: range.to,
                ...(kind ? { kind } : {}),
                ...(q ? { q } : {}),
              }}
              disabled={report.isLoading || rows.length === 0}
            />
          }
        />

        <Stack gap="md">
          <StateView
            loading={report.isLoading}
            error={report.error}
            empty={rows.length === 0}
            emptyTitle="Nothing posted"
            emptyMessage="No payment or voucher reached the ledger in this period."
            onRetry={() => void report.refetch()}
          >
            <Stack gap="md">
              <DataTable
                columns={columns}
                rows={rows}
                keyExtractor={(row) => row.trace_id}
                totalsLabel={meta ? documents(meta.total) : undefined}
                totalsLabelKey="posted_on"
                onRowPress={(row) => router.push(`/staff/reports/voucherwise/${row.trace_id}`)}
                server={
                  meta
                    ? {
                        page: meta.current_page,
                        pageCount: meta.last_page,
                        total: meta.total,
                        pageSize: meta.per_page,
                        onPageChange: setPage,

                        // The server orders this report and offers no choice
                        // about it; the headers are therefore not controls.
                        sort: null,
                        onSortChange: () => {},
                      }
                    : undefined
                }
              />

              {/*
                Said in words under a paginated table, because the total in the
                footer is the RANGE's and the rows above it are one page. A
                reader who assumes the figure belongs to what they can see has
                been misled by a footer that looks exactly like every other one.
              */}
              {meta && meta.last_page > 1 ? (
                <Panel>
                  <Inline gap="md" justify="between">
                    <Text style={type.rowTitle}>{documents(meta.total)} in this period</Text>
                    <Text style={type.rowTitle}>{formatMoney(meta.total_amount)}</Text>
                  </Inline>

                  <Text tone="muted" style={type.rowMeta}>
                    The total covers the whole period, not the page shown above.
                  </Text>
                </Panel>
              ) : null}
            </Stack>
          </StateView>
        </Stack>
      </Section>
    </Screen>
  );
}

/** "1 document", "84 documents". */
function documents(count: number): string {
  return `${count} document${count === 1 ? '' : 's'}`;
}
