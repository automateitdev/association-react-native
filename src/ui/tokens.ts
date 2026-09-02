/**
 * The measurements the screens share.
 *
 * WHY THIS EXISTS
 * ---------------
 * The first staff screens used HeroUI's `Card` as the universal container, so
 * every section became a filled slab and every list item a box inside a box.
 * The result read as blocks rather than content: on a wide viewport a card
 * stretched the full width with 12pt text inside it, and nothing on a payment
 * row was visually more important than anything else - the member's name, the
 * invoice number and the amount all carried the same weight.
 *
 * The fix is not softer cards. It is to stop using a container to express
 * grouping, and use space, a type scale and a hairline instead. These tokens
 * are what make that consistent rather than improvised per screen.
 *
 * COLOUR IS DELIBERATELY ABSENT.
 * HeroUI's theme owns colour and exposes it as `--color-*` variables that
 * Uniwind compiles into utilities - `text-muted`, `border-border`,
 * `bg-background-secondary`. Screens reach for those classNames. Putting hex
 * values here would create a second palette that drifts from the first and
 * breaks in whichever theme it was not written in.
 */

/** A 4pt grid. Anything not on it is a mistake, not a refinement. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 40,
} as const;

/**
 * A type scale with real steps in it.
 *
 * The old screens ran 12/13/14/16/18/22 with almost everything at 12 or 14,
 * which is why nothing stood out. Contrast between adjacent levels is what
 * creates hierarchy; a scale whose steps are 2pt apart has none.
 */
export const type = {
  /** Page title. One per screen. */
  title: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },

  /** Section heading. Small and quiet - the space around it does the work. */
  section: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.8 },

  /** The primary line of a row: a member's name, a fee head. */
  rowTitle: { fontSize: 16, fontWeight: '600' as const },

  /** Supporting detail under it. */
  rowMeta: { fontSize: 13, fontWeight: '400' as const },

  /** Body copy in a paragraph. */
  body: { fontSize: 15, fontWeight: '400' as const },

  /** The figure a row is about. Large enough to anchor the eye. */
  amount: { fontSize: 20, fontWeight: '700' as const },

  /** A dashboard figure. */
  stat: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -1 },
} as const;

/**
 * Reading measure.
 *
 * React Native Web stretches to the viewport, so on a desktop browser a list
 * row ran the full 1280pt with small text at either end - the single biggest
 * reason the staff screens looked wrong. Phones are narrower than this and are
 * unaffected by it.
 */
export const maxContentWidth = 720;
