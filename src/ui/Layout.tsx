import type { ReactNode } from 'react';
import { View } from 'react-native';
import { space } from './tokens';

/**
 * Down the page, and across it. The two shapes every screen was drawing by hand.
 *
 * WHY THESE EXIST, COUNTED RATHER THAN ASSERTED
 * ---------------------------------------------
 * The 37 screens carried 151 bare `<View>`s and 197 inline `style={{ ... }}`
 * objects. Sorted by what those objects actually said:
 *
 *   83  marginTop          58 of them the ONLY thing in the object
 *   61  gap
 *   41  flexDirection      30 of those paired with gap, half also alignItems
 *   25  flex
 *
 * That is not styling. That is two layouts - a column with a gap and a row with
 * a gap - written out longhand a hundred and twenty times, plus a running
 * tally of hand-picked top margins standing in for the rhythm a container
 * should own. `ui/Screen` already dropped its blanket `gap` and said "Section
 * owns its spacing now"; between Sections, nothing did, so every screen invented
 * it again at the point of use.
 *
 * SPACING BELONGS TO THE PARENT, NOT THE CHILD. A `marginTop` on a child is a
 * claim about what happens to be above it, and it is wrong the moment anything
 * is inserted, reordered or conditionally hidden - which is how a screen ends
 * up with a double gap where an optional panel did not render. A gap on the
 * container cannot be wrong that way: it describes the space BETWEEN whatever
 * children there turn out to be.
 *
 * NAMED STEPS, NOT NUMBERS. `gap="md"` reads out of the same six-value scale as
 * the rest of the app (ui/tokens). Arbitrary numbers are how a screen ends up
 * 12pt apart where every other screen is 10.
 *
 * `Stack`, WITH ONE PLACE IT MUST NOT GO, WHICH IS THE OBVIOUS NAME. expo-router exports a
 * `Stack` navigator and `src/app/_layout.tsx` renders one; a second `Stack`
 * meaning something else entirely would collide in exactly the file where the
 * mistake is hardest to see. `Row` was taken too - ui/Row is a row of a LIST,
 * which is a different thing from a row of a layout - hence `Inline`.
 */
/*
 * `none` is here so that "these do not get a gap" can be SAID.
 *
 * Without it, every wrapper that exists for one reason - to take the free space,
 * to stop a button stretching - would have had to keep its own inline style, or
 * silently acquire the default spacing on the day a second child was added
 * beside the first.
 */
const gaps = { none: 0, ...space } as const;

type Gap = keyof typeof gaps;

const alignments = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
} as const;

const justifications = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
} as const;

/**
 * A column of things, evenly spaced.
 *
 * The default gap is `md`, which is the step between related things - a label
 * and what it labels, a panel and the panel after it. Reach for `lg` and above
 * when the two things are genuinely separate, and consider whether that is a
 * `Section` instead.
 */
export function Stack({
  children,
  gap = 'md',
  align,
  justify,
  grow = false,
}: {
  children: ReactNode;
  gap?: Gap;
  /** Cross-axis: how children sit ACROSS the column. Default: full width. */
  align?: 'start' | 'center' | 'end' | 'stretch';
  /**
   * Main axis: where the children sit DOWN the column.
   *
   * Only means anything with `grow`, or inside a parent that has already given
   * this one a height - a column as tall as its content has no spare room to
   * distribute. `grow` plus `justify="center"` is the empty-state layout: a
   * message in the middle of whatever space is left.
   */
  justify?: 'start' | 'center' | 'end' | 'between';
  /** Take the free space in the parent. Replaces a hand-written `flex: 1`. */
  grow?: boolean;
}) {
  return (
    <View
      style={{
        gap: gaps[gap],
        alignItems: align ? alignments[align] : undefined,
        justifyContent: justify ? justifications[justify] : undefined,
        flex: grow ? 1 : undefined,
      }}
    >
      {children}
    </View>
  );
}

/**
 * A row of things, evenly spaced, centred on each other by default.
 *
 * CENTRED BY DEFAULT because that is what 33 of the 41 hand-written rows asked
 * for - an icon beside a label, a badge beside a name, a button beside a
 * button. `align="baseline"` is for the case centring gets wrong: text of two
 * different sizes, where centring floats the smaller one off the line the
 * larger one sits on.
 *
 * WRAPPING IS OPT-IN. A row of buttons that wraps on a phone is right; a label
 * and its value wrapping onto two lines is a bug that looks like a design.
 */
export function Inline({
  children,
  gap = 'sm',
  align = 'center',
  justify,
  wrap = false,
  grow = false,
}: {
  children: ReactNode;
  gap?: Gap;
  align?: 'start' | 'center' | 'end' | 'baseline' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between';
  wrap?: boolean;
  grow?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: alignments[align],
        justifyContent: justify ? justifications[justify] : undefined,
        flexWrap: wrap ? 'wrap' : undefined,
        gap: gaps[gap],
        flex: grow ? 1 : undefined,
      }}
    >
      {children}
    </View>
  );
}

/**
 * Nothing, taking whatever room is going.
 *
 * For the case a gap cannot express: pushing the rest of a row to the far end,
 * or holding an empty first column so a heading lines up with the values under
 * it. `justify="between"` handles two groups; this handles the awkward ones.
 */
export function Spacer() {
  return <View style={{ flex: 1 }} />;
}
