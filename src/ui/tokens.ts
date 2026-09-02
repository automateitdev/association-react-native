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
 * The typeface.
 *
 * WEIGHT IS A FONT FAMILY HERE, NOT A NUMBER.
 * React Native does not synthesise weights: `fontWeight: '600'` against a family
 * with only Regular loaded silently renders Regular. Every "semibold" heading in
 * this app was plain text pretending to be bold, on top of the app running in
 * the platform's default system font throughout - which is most of why it read
 * as unfinished.
 *
 * Inter for the reason this app needs most: clear figures at small sizes and
 * real tabular numerals, so a column of amounts lines up.
 */
export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/**
 * A type scale with real steps in it.
 *
 * The old screens ran 12/13/14/16/18/22 with almost everything at 12 or 14,
 * which is why nothing stood out. Contrast between adjacent levels is what
 * creates hierarchy; a scale whose steps are 2pt apart has none.
 *
 * `fontWeight` is kept alongside `fontFamily` because web still renders from
 * the CSS weight; native takes the family. Both have to agree.
 */
export const type = {
  /** Page title. One per screen. */
  title: {
    fontFamily: font.bold,
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.6,
  },

  /** Section heading. Small and quiet - the space around it does the work. */
  section: {
    fontFamily: font.semibold,
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.9,
  },

  /** The primary line of a row: a member's name, a fee head. */
  rowTitle: { fontFamily: font.semibold, fontSize: 15, fontWeight: '600' as const },

  /** Supporting detail under it. */
  rowMeta: { fontFamily: font.regular, fontSize: 13, fontWeight: '400' as const },

  /** Body copy in a paragraph. */
  body: { fontFamily: font.regular, fontSize: 15, fontWeight: '400' as const },

  /** The figure a row is about. Large enough to anchor the eye. */
  amount: { fontFamily: font.semibold, fontSize: 19, fontWeight: '600' as const },

  /** A dashboard figure. */
  stat: {
    fontFamily: font.bold,
    fontSize: 30,
    fontWeight: '700' as const,
    letterSpacing: -0.8,
  },
} as const;

/**
 * Measure lives in `breakpoint.ts`, not here.
 *
 * There was a single `maxContentWidth = 720` constant, which is why a desktop
 * browser rendered a phone-width column. A measure is not one number: a form
 * wants a short line and a report wants every pixel going. See useContentWidth.
 */
