import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from './Icon';
import { Text } from './Text';
import { space, type } from './tokens';

/**
 * A month grid. Built by hand, for the same reason the table was: HeroUI Native
 * ships no date picker (risk R-1), and neither does React Native.
 *
 * WHY THE PRESET CHIPS WERE NOT ENOUGH
 * ------------------------------------
 * The reports first offered "This month / Last month / This year / All time"
 * and a row of recent month-ends, on the grounds that a report is nearly always
 * run to a period boundary. That is true and those presets stay - they are one
 * tap for the common case, and they cannot be mistyped.
 *
 * It is not the whole job. An association asked for the figures between two
 * particular dates - an audit window, a committee's term, the period since the
 * last general meeting - could not express that at all. "Nearly always" is not
 * a reason to make the remaining cases impossible.
 *
 * A TEXT FIELD WAS THE OTHER OPTION, AND IS WORSE. `2026-1-5` and `05/01/2026`
 * and `Jan 5` are all things a person reasonably types, the API accepts exactly
 * one of them, and the failure arrives as a validation error about a format
 * nobody was shown. A grid of days cannot produce an invalid date.
 *
 * ALWAYS A RANGE, never a single day.
 *
 * There was a single-date mode, used by the outstanding-dues report for its
 * "as at" snapshot. Two controls that look identical and behave differently -
 * one takes a press, the other takes two - is a worse thing to own than a
 * report that has to express its snapshot as a range with an open start. The
 * report was changed to take a range; this dropped the mode.
 *
 * DATES, NOT MONEY. The arithmetic here is calendar arithmetic - which day a
 * month starts on, how many days it has. The prohibition this codebase takes
 * seriously is on the app computing AMOUNTS.
 */

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** `2026-09-03`. The only date format that crosses the API boundary. */
export type IsoDate = string;

export type DateRange = { from?: IsoDate; to?: IsoDate };

export function Calendar({
  value,
  onChange,
  maximum,
}: {
  /** A range whose `to` may still be missing mid-selection. */
  value: DateRange;
  onChange: (value: DateRange) => void;
  /**
   * The latest selectable day, usually today.
   *
   * A report "as at" a future date is not wrong so much as meaningless - no
   * instalment has been assigned yet - and the empty result that comes back
   * reads as a bug rather than as an answer.
   */
  maximum?: IsoDate;
}) {
  const anchor = value.from ?? value.to ?? todayIso();

  const [cursor, setCursor] = useState(() => {
    const [year, month] = anchor.split('-').map(Number);
    return { year, month: month - 1 };
  });

  const days = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);

  const select = (day: IsoDate) => {
    /*
     * Second press completes the range - unless it lands before the first, in
     * which case it becomes the new start.
     *
     * The alternative is to silently swap the two, which produces a range the
     * user did not draw. Someone whose second click is earlier than their first
     * has almost always changed their mind about where the range begins.
     */
    if (!value.from || (value.from && value.to)) {
      onChange({ from: day, to: undefined });
      return;
    }

    onChange(day < value.from ? { from: day, to: undefined } : { from: value.from, to: day });
  };

  const step = (months: number) => {
    const date = new Date(cursor.year, cursor.month + months, 1);
    setCursor({ year: date.getFullYear(), month: date.getMonth() });
  };

  return (
    <View className="bg-surface border border-border rounded-lg" style={{ padding: space.md, gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Arrow icon="back" label="Previous month" onPress={() => step(-1)} />

        <Text style={type.rowTitle}>
          {MONTHS[cursor.month]} {cursor.year}
        </Text>

        <Arrow icon="forward" label="Next month" onPress={() => step(1)} />
      </View>

      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((label, index) => (
          <Text
            // The letters repeat (two Ts, two Ss), so the index carries the key.
            key={index}
            tone="muted"
            style={{ ...type.rowMeta, width: CELL, textAlign: 'center' }}
          >
            {label}
          </Text>
        ))}
      </View>

      {days.map((week, index) => (
        <View key={index} style={{ flexDirection: 'row' }}>
          {week.map((day, dayIndex) => {
            if (!day) return <View key={dayIndex} style={{ width: CELL, height: CELL }} />;

            const disabled = maximum !== undefined && day > maximum;
            const isStart = day === value.from;
            const isEnd = day === value.to;
            const inside =
              value.from !== undefined &&
              value.to !== undefined &&
              day > value.from &&
              day < value.to;

            return (
              <Pressable
                key={dayIndex}
                onPress={() => select(day)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={day}
                accessibilityState={{ selected: isStart || isEnd, disabled }}
                className={
                  isStart || isEnd
                    ? 'bg-accent rounded-md'
                    : inside
                      ? 'bg-surface-secondary'
                      : undefined
                }
                style={{
                  width: CELL,
                  height: CELL,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: disabled ? 0.3 : 1,
                }}
              >
                <Text
                  // Tabular figures so the columns of a month line up, the same
                  // reason the report's number cells use them.
                  style={{
                    ...type.rowMeta,
                    fontVariant: ['tabular-nums'],
                    ...(isStart || isEnd ? { color: undefined } : null),
                  }}
                  tone={isStart || isEnd ? 'inverse' : 'default'}
                >
                  {Number(day.slice(8))}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const CELL = 34;

function Arrow({
  icon,
  label,
  onPress,
}: {
  icon: 'back' | 'forward';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="border border-border rounded-md"
      style={{ paddingHorizontal: space.sm, paddingVertical: space.xs }}
    >
      <Icon name={icon} size={15} tone="muted" />
    </Pressable>
  );
}

/**
 * The weeks of a month, as ISO dates, padded with nulls to whole weeks.
 *
 * Built from local Date rather than UTC on purpose: a member in Dhaka choosing
 * "today" means today in Dhaka. Constructing these through Date.UTC would put
 * the association six hours behind its own calendar and hand the API yesterday.
 */
function monthGrid(year: number, month: number): (IsoDate | null)[][] {
  const first = new Date(year, month, 1);
  // Day 0 of the next month is the last day of this one.
  const length = new Date(year, month + 1, 0).getDate();

  const cells: (IsoDate | null)[] = Array.from({ length: first.getDay() }, () => null);

  for (let day = 1; day <= length; day++) {
    cells.push(toIso(new Date(year, month, day)));
  }

  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (IsoDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return weeks;
}

export function toIso(date: Date): IsoDate {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function todayIso(): IsoDate {
  return toIso(new Date());
}

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * `2026-09-03` as `3 Sep 2026`.
 *
 * ISO is what crosses the API boundary and what this file works in. It is not
 * what anyone reads a report header in, and having the picker say "5 Aug 2026"
 * while the heading above it said "2026-08-05" made one date look like two.
 */
export function humanDate(iso: IsoDate): string {
  const [year, month, day] = iso.split('-');
  return `${Number(day)} ${SHORT[Number(month) - 1]} ${year}`;
}
