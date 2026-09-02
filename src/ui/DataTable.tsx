import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from './Text';
import { Divider } from './Section';
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
 * Header and body share ONE horizontal ScrollView, so they cannot drift apart
 * when scrolled - a header that stays put while its columns move is worse than
 * no header.
 */

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
};

export function DataTable<T>({
  columns,
  rows,
  keyExtractor,
  totalsLabel = 'Total',
}: {
  columns: Column<T>[];
  rows: T[];
  keyExtractor: (row: T) => string | number;
  totalsLabel?: string;
}) {
  const width = columns.reduce((sum, c) => sum + c.width, 0);
  const hasTotals = columns.some((c) => c.total !== undefined);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginTop: space.sm }}>
      <View style={{ width }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', paddingBottom: space.sm }}>
          {columns.map((column) => (
            <Text
              key={column.key}
              tone="muted"
              style={{
                ...type.section,
                width: column.width,
                textTransform: 'uppercase',
                textAlign: column.align === 'right' ? 'right' : 'left',
                paddingRight: space.md,
              }}
            >
              {column.header}
            </Text>
          ))}
        </View>

        <Divider />

        {rows.map((row) => (
          <View key={keyExtractor(row)}>
            <View style={{ flexDirection: 'row', paddingVertical: space.md }}>
              {columns.map((column) => (
                <View
                  key={column.key}
                  style={{
                    width: column.width,
                    paddingRight: space.md,
                    alignItems: column.align === 'right' ? 'flex-end' : 'flex-start',
                  }}
                >
                  {column.render(row)}
                </View>
              ))}
            </View>
            <Divider />
          </View>
        ))}

        {/*
          The totals row is visually heavier because it is the line most people
          open a report to read.
        */}
        {hasTotals ? (
          <View style={{ flexDirection: 'row', paddingVertical: space.md }}>
            {columns.map((column, index) => (
              <View
                key={column.key}
                style={{
                  width: column.width,
                  paddingRight: space.md,
                  alignItems: column.align === 'right' ? 'flex-end' : 'flex-start',
                }}
              >
                {column.total !== undefined ? (
                  column.total
                ) : index === 0 ? (
                  <Text style={{ ...type.rowTitle }}>{totalsLabel}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

/** A plain cell. */
export function Cell({ children, bold = false }: { children: ReactNode; bold?: boolean }) {
  return <Text style={bold ? type.rowTitle : type.body}>{children}</Text>;
}

/** A numeric cell: tabular figures, so a column of them lines up. */
export function NumberCell({ children, bold = false }: { children: ReactNode; bold?: boolean }) {
  return (
    <Text
      style={{
        ...(bold ? type.rowTitle : type.body),
        fontVariant: ['tabular-nums'],
      }}
    >
      {children}
    </Text>
  );
}
