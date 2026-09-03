import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { Text } from './Text';
import { space, type } from './tokens';

/**
 * A table. Built by hand, because HeroUI Native does not ship one.
 *
 * This is the component risk R-1 was actually about. Cards work for members and
 * payments - a phone reads those as a list - but a report is a grid: the reader
 * is comparing the same column down many rows, and a card per row destroys the
 * one thing that makes it a report.
 *
 * IT CANNOT ADD UP.
 * There is deliberately no way to hand this component a list of rows and ask for
 * a totals row. Totals arrive as `total` on each column, already computed, and
 * they come from the server's `meta` - which is where FR-REP-8 says they come
 * from. A table that could sum its own column would be one refactor away from
 * summing an instalment column and a fine column into a single "paid" figure,
 * which is defect D-1 rebuilt in the presentation layer.
 *
 * IT CAN, HOWEVER, PAGE AND SORT - AND THOSE ARE NOT THE SAME RISK.
 * Paging and sorting rearrange rows the server already sent; they compute no new
 * money. The distinction is worth stating because an earlier version of this
 * file had no pagination at all, on the stated grounds that "a page-at-a-time
 * report cannot be totalled". That is an argument against the SERVER paginating,
 * and no argument whatever against paging a list already fully loaded. The
 * totals still describe every row in the report rather than the page on screen,
 * and the count line below says so out loud.
 *
 * ROWS ARE A FIXED HEIGHT, and that is load-bearing rather than cosmetic. The
 * first column is frozen while the rest scroll sideways, which makes the left
 * pane and the scrolling pane two separate stacks of Views that must line up
 * exactly. Let one cell wrap to a second line and every row below it in the
 * other pane is off by that much.
 */

const ROW_HEIGHT = 38;
const HEADER_HEIGHT = 30;
const DEFAULT_PAGE_SIZE = 25;

export type Column<T> = {
  key: string;
  header: string;
  /** Fixed, because columns must line up between header, body and totals. */
  width: number;
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
  /**
   * The column total, already computed by the server. Omit for columns that
   * have no meaningful total - a name, a status.
   */
  total?: ReactNode;
  /**
   * Makes the column sortable, by returning the value to order on.
   *
   * Returns the RAW value, not the rendered one: `formatMoney` produces
   * "৳1,000.00", which sorts as text into an order no reader expects.
   */
  sort?: (row: T) => string | number;
  /**
   * How to compare what `sort` returns.
   *
   * `decimal` compares money WITHOUT converting it to a number - see
   * compareDecimal.
   */
  sortType?: 'text' | 'decimal';
  /**
   * Keep this column in view while the others scroll sideways.
   *
   * Realistically that is the member's name and nothing else. Scrolling right
   * to reach the fines column used to take the name with it, leaving a row of
   * figures belonging to nobody in particular.
   */
  frozen?: boolean;
};

export type SortState = { key: string; direction: 'asc' | 'desc' } | null;

/**
 * Paging and sorting done by the SERVER, for a listing it only sends a page of.
 *
 * The reports load every row, so the table can page and sort them here and be
 * right. The members list and the approvals queue do not: they arrive one page
 * at a time, and sorting a page of a paginated listing is not sorting the
 * listing - it reorders 25 rows out of 300 and presents the result as though it
 * were the top of the list. So when the server owns the paging, it owns the
 * ordering too, and this component only reports what was pressed.
 */
export type ServerPaging = {
  /** 1-based, matching what the API returns. */
  page: number;
  pageCount: number;
  total: number;
  /**
   * Rows per page as REQUESTED, which is not the same as rows received.
   *
   * The count line first derived this from the length of the page in hand,
   * which is right on every page but the last: 45 members at 25 a page put 20
   * rows on page two and the line read "Showing 21-40 of 45" instead of
   * "26-45". The last page is exactly where someone checks whether they have
   * seen everything, so it was the one place the arithmetic had to hold.
   */
  pageSize: number;
  onPageChange: (page: number) => void;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
};

export function DataTable<T>({
  columns,
  rows,
  keyExtractor,
  totalsLabel = 'Total',
  totalsLabelKey,
  pageSize = DEFAULT_PAGE_SIZE,
  server,
  onRowPress,
}: {
  columns: Column<T>[];
  rows: T[];
  keyExtractor: (row: T) => string | number;
  totalsLabel?: string;
  /**
   * Which column the totals label sits in.
   *
   * Defaults to the first column carrying no total of its own, which is right
   * whenever that column is the name. It is wrong when the first column is a
   * 46pt checkbox: the approvals queue rendered "Total" into it and the label
   * came out as "T...". Naming the column is the only reliable answer, because
   * only the caller knows which of its columns is wide enough to read.
   */
  totalsLabelKey?: string;
  /** Set 0 to show everything - a report of five rows needs no controls. */
  pageSize?: number;
  /** Present when the server pages and sorts. See ServerPaging. */
  server?: ServerPaging;
  /** Makes rows open something. A listing usually leads somewhere. */
  onRowPress?: (row: T) => void;
}) {
  const [localSort, setLocalSort] = useState<SortState>(null);
  const [page, setPage] = useState(0);

  const sort = server ? server.sort : localSort;

  const frozen = columns.filter((c) => c.frozen);
  const scrolling = columns.filter((c) => !c.frozen);

  /*
   * Whether the sideways hint is TRUE, measured rather than assumed - and now
   * also what the columns are sized against. See `widths` below.
   */
  const [available, setAvailable] = useState(0);

  const natural = columns.reduce((sum, c) => sum + c.width, 0);
  // Less the container's own 1px borders, or the last column overhangs them.
  const usable = available > 0 ? available - 2 : 0;

  /**
   * The declared widths, grown proportionally when there is room to spare.
   *
   * The widths on a Column are a RATIO as much as a measurement. Left at face
   * value the table drew itself at its natural width inside a bordered box
   * stretched to the full page, leaving several hundred points of empty ruled
   * space to the right of the last column - which reads as a column that
   * failed to load rather than as a table that happens to be narrow.
   *
   * Growing rather than centring, because the alternative - a narrow table
   * floating in the middle of a wide screen - wastes the same space and makes
   * the money columns harder to compare against the ones above and below.
   */
  const widths = useMemo(() => {
    const scale = usable > natural ? usable / natural : 1;
    const scaled = columns.map((c) => Math.floor(c.width * scale));

    // Floor loses a point or two per column; the last one absorbs the
    // remainder so the table ends exactly on its border rather than a pixel
    // short of it.
    if (scale > 1 && scaled.length > 0) {
      scaled[scaled.length - 1] += usable - scaled.reduce((sum, w) => sum + w, 0);
    }

    return new Map(columns.map((c, i) => [c.key, scaled[i]]));
  }, [columns, natural, usable]);

  const widthOf = (column: Column<T>) => widths.get(column.key) ?? column.width;

  const frozenWidth = frozen.reduce((sum, c) => sum + widthOf(c), 0);
  const scrollingWidth = scrolling.reduce((sum, c) => sum + widthOf(c), 0);

  const hasTotals = columns.some((c) => c.total !== undefined);

  // The named column, or the first one with nothing of its own to show.
  const labelKey = totalsLabelKey ?? columns.find((c) => c.total === undefined)?.key;

  const sorted = useMemo(() => {
    // Already ordered by the database. Re-sorting the page here would reorder
    // 25 rows and call it a sort.
    if (server || !sort) return rows;

    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sort) return rows;

    const read = column.sort;
    const compare = column.sortType === 'decimal' ? compareDecimal : compareText;
    const sign = sort.direction === 'asc' ? 1 : -1;

    // A copy: sorting the prop in place would mutate the array React Query
    // holds in its cache and hands to every other reader of this query.
    return [...rows].sort((a, b) => sign * compare(read(a), read(b)));
  }, [rows, sort, columns, server]);

  const paged = server ? true : pageSize > 0;
  const pageCount = server ? server.pageCount : paged ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;

  // Clamped rather than trusted: a filter that shortens the report while the
  // reader is on the last page would otherwise show an empty table.
  const current = server ? server.page - 1 : Math.min(page, pageCount - 1);
  const start = current * (server ? server.pageSize : pageSize);

  // The server already sent exactly one page; slicing it again would show 25
  // of the 25 rows it sent and hide the rest of nothing.
  const visible = server ? rows : paged ? sorted.slice(start, start + pageSize) : sorted;

  const totalRows = server ? server.total : sorted.length;
  const firstRow = totalRows === 0 ? 0 : start + 1;
  const lastRow = Math.min(start + (server ? server.pageSize : pageSize), totalRows);

  useEffect(() => {
    if (!server) setPage(0);
  }, [rows.length, sort, server]);

  const goTo = (next: number) => (server ? server.onPageChange(next + 1) : setPage(next));

  /*
   * "Scroll sideways for the remaining columns" is printed only when it is
   * TRUE. Both report screens once printed it unconditionally; on a desktop
   * the table fits and nothing scrolls, so the line was simply false - and a
   * false instruction is worse than none, because a reader who cannot make it
   * happen assumes something is broken.
   */
  const overflows = usable > 0 && natural > usable;

  const measure = (event: LayoutChangeEvent) => setAvailable(event.nativeEvent.layout.width);

  const toggleSort = (column: Column<T>) => {
    // `sort` on the column is what marks it sortable when this table does the
    // sorting; under server paging the server's whitelist decides, and the
    // column opts in the same way.
    if (!column.sort) return;

    const apply = (next: SortState) =>
      server ? server.onSortChange(next) : setLocalSort(next);

    apply(
      sort?.key === column.key
        ? sort.direction === 'asc'
          ? { key: column.key, direction: 'desc' }
          : /*
             * A third press clears it, back to the server's own order - which
             * for both reports is by member name. That is a meaningful default
             * to be able to return to, not an accident, and without this the
             * only way back is to reload the screen.
             */
            null
        : { key: column.key, direction: 'asc' },
    );
  };

  const header = (subset: Column<T>[]) => (
    <View
      className="border-b border-separator"
      style={{ flexDirection: 'row', height: HEADER_HEIGHT, alignItems: 'center' }}
    >
      {subset.map((column) => (
        <Pressable
          key={column.key}
          onPress={() => toggleSort(column)}
          disabled={!column.sort}
          accessibilityRole={column.sort ? 'button' : undefined}
          accessibilityLabel={column.sort ? `Sort by ${column.header}` : undefined}
          style={{
            width: widthOf(column),
            paddingHorizontal: space.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.xs,
            justifyContent: column.align === 'right' ? 'flex-end' : 'flex-start',
          }}
        >
          <Text
            tone={sort?.key === column.key ? 'default' : 'muted'}
            numberOfLines={1}
            style={{ ...type.section, textTransform: 'uppercase' }}
          >
            {column.header}
          </Text>

          {/* Only on the sorted column. An arrow on every sortable header is
              five arrows saying nothing. */}
          {sort?.key === column.key ? (
            <Icon name={sort.direction === 'asc' ? 'sortUp' : 'sortDown'} size={13} />
          ) : null}
        </Pressable>
      ))}
    </View>
  );

  const body = (subset: Column<T>[]) => (
    <View>
      {visible.map((row, index) => (
        /*
          Pressable only when there is somewhere to go.

          A Pressable that does nothing still takes focus and still announces
          itself as a button, so a report table would give a screen reader 25
          buttons leading nowhere.

          Both panes wrap their own half of the row: they are separate view
          stacks, so a press must be handled on whichever side the finger
          landed.
        */
        <TableRow
          key={keyExtractor(row)}
          onPress={onRowPress ? () => onRowPress(row) : undefined}
          /*
            Zebra striping instead of a rule under every row. Thirty hairlines
            down a page reads as a grid of boxes; a faint tint on alternate rows
            does the same job - holding the eye on one row across many columns -
            without drawing anything.
          */
          className={index % 2 === 1 ? 'bg-surface' : undefined}
          style={{ flexDirection: 'row', height: ROW_HEIGHT, alignItems: 'center' }}
        >
          {subset.map((column) => (
            <View
              key={column.key}
              style={{
                width: widthOf(column),
                paddingHorizontal: space.md,
                alignItems: column.align === 'right' ? 'flex-end' : 'flex-start',
              }}
            >
              {column.render(row)}
            </View>
          ))}
        </TableRow>
      ))}
    </View>
  );

  const totals = (subset: Column<T>[]) =>
    hasTotals ? (
      <View
        className="border-t border-separator"
        style={{ flexDirection: 'row', height: ROW_HEIGHT + 6, alignItems: 'center' }}
      >
        {subset.map((column) => (
          <View
            key={column.key}
            style={{
              width: widthOf(column),
              paddingHorizontal: space.md,
              alignItems: column.align === 'right' ? 'flex-end' : 'flex-start',
            }}
          >
            {column.total !== undefined ? (
              column.total
            ) : column.key === labelKey ? (
              <Text style={type.rowTitle} numberOfLines={1}>
                {totalsLabel}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    ) : null;

  return (
    <View onLayout={measure}>
      <View className="border border-border rounded-lg overflow-hidden">
        <View style={{ flexDirection: 'row' }}>
          {/* The frozen pane, outside the ScrollView so it cannot move. */}
          {frozen.length > 0 ? (
            <View
              className={overflows ? 'border-r border-border' : undefined}
              /*
                NO paddingLeft on the pane, and that is the fix for a visible
                seam. The zebra background belongs to the ROW, which sits
                inside this View - so any padding here is a vertical strip the
                stripe cannot reach, and it showed as a pale nick in every
                other row exactly where the frozen pane meets the scrolling
                one. The cells carry the padding instead.
              */
              style={{ width: frozenWidth }}
            >
              {header(frozen)}
              {body(frozen)}
              {totals(frozen)}
            </View>
          ) : null}

          {/*
            Header, body and totals share ONE horizontal ScrollView, so they
            cannot drift apart when scrolled - a header that stays put while its
            columns move is worse than no header.
          */}
          <ScrollView horizontal showsHorizontalScrollIndicator={overflows} style={{ flex: 1 }}>
            <View style={{ width: scrollingWidth }}>
              {header(scrolling)}
              {body(scrolling)}
              {totals(scrolling)}
            </View>
          </ScrollView>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: space.sm,
          gap: space.md,
          flexWrap: 'wrap',
        }}
      >
        <Text tone="muted" style={type.rowMeta}>
          {pageCount > 1
            ? `Showing ${firstRow}–${lastRow} of ${totalRows}`
            : `${totalRows} row${totalRows === 1 ? '' : 's'}`}
          {/*
            Said explicitly, because the totals row sits directly above a table
            showing 25 of 315 rows and would otherwise look like it described
            what is on screen.
          */}
          {hasTotals && pageCount > 1 ? ' · totals cover every row' : ''}
        </Text>

        {overflows ? (
          <Text tone="muted" style={type.rowMeta}>
            Scroll sideways for the remaining columns.
          </Text>
        ) : null}

        {paged && pageCount > 1 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <PageButton
              icon="back"
              label="Previous page"
              disabled={current === 0}
              onPress={() => goTo(current - 1)}
            />
            <Text tone="muted" style={type.rowMeta}>
              {current + 1} / {pageCount}
            </Text>
            <PageButton
              icon="forward"
              label="Next page"
              disabled={current >= pageCount - 1}
              onPress={() => goTo(current + 1)}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * One row: a Pressable when it leads somewhere, a plain View when it does not.
 *
 * The distinction is not cosmetic. A Pressable takes focus and announces itself
 * as a button, so wrapping every row unconditionally would hand a screen reader
 * twenty-five buttons that do nothing on a report which is only ever read.
 */
function TableRow({
  onPress,
  className,
  style,
  children,
}: {
  onPress?: () => void;
  className?: string;
  style: ViewStyle;
  children: ReactNode;
}) {
  if (!onPress) {
    return (
      <View className={className} style={style}>
        {children}
      </View>
    );
  }

  return (
    <Pressable onPress={onPress} accessibilityRole="button" className={className} style={style}>
      {children}
    </Pressable>
  );
}

function PageButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'back' | 'forward';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className="border border-border rounded-md"
      style={{
        paddingHorizontal: space.sm,
        paddingVertical: space.xs,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Icon name={icon} size={15} tone={disabled ? 'muted' : 'default'} />
    </Pressable>
  );
}

/** A plain cell. */
export function Cell({ children, bold = false }: { children: ReactNode; bold?: boolean }) {
  return (
    <Text numberOfLines={1} style={bold ? type.rowTitle : type.body}>
      {children}
    </Text>
  );
}

/** A numeric cell: tabular figures, so a column of them lines up. */
export function NumberCell({ children, bold = false }: { children: ReactNode; bold?: boolean }) {
  return (
    <Text
      numberOfLines={1}
      style={{
        ...(bold ? type.rowTitle : type.body),
        fontVariant: ['tabular-nums'],
      }}
    >
      {children}
    </Text>
  );
}

function compareText(a: string | number, b: string | number): number {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Order two decimal strings without turning either into a number.
 *
 * `Number(a) - Number(b)` would order these perfectly well, and ordering is not
 * arithmetic - no new amount is produced. It is avoided anyway. This codebase's
 * one hard rule about money is that a float never touches it, and a rule with a
 * documented exception is a rule people stop checking. Comparing digit by digit
 * costs a dozen lines and leaves nothing to argue about later.
 */
function compareDecimal(a: string | number, b: string | number): number {
  const left = split(String(a));
  const right = split(String(b));

  if (left.negative !== right.negative) return left.negative ? -1 : 1;

  const sign = left.negative ? -1 : 1;

  // A longer integer part is a larger number - no need to compare digits at all
  // until the magnitudes match.
  if (left.whole.length !== right.whole.length) {
    return sign * (left.whole.length - right.whole.length);
  }

  if (left.whole !== right.whole) return sign * (left.whole < right.whole ? -1 : 1);

  // Padded to equal length so ".5" and ".45" compare as .50 against .45 rather
  // than as "5" against "4".
  const width = Math.max(left.fraction.length, right.fraction.length);
  const leftFraction = left.fraction.padEnd(width, '0');
  const rightFraction = right.fraction.padEnd(width, '0');

  if (leftFraction === rightFraction) return 0;

  return sign * (leftFraction < rightFraction ? -1 : 1);
}

function split(value: string): { negative: boolean; whole: string; fraction: string } {
  const negative = value.startsWith('-');
  const [whole = '0', fraction = ''] = value.replace(/^[-+]/, '').split('.');

  // Leading zeros would defeat the length comparison above: "007" is not longer
  // than "7".
  return { negative, whole: whole.replace(/^0+(?=\d)/, ''), fraction };
}
