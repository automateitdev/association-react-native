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

/**
 * A 2pt grid, tuned for a desktop.
 *
 * The first version ran 4/8/12/16/24/40 and produced 66pt list rows: five
 * members filled an entire 743pt viewport when a desktop list should show
 * fifteen. That is a phone's spacing stretched across a monitor, and it reads
 * as one - loose, unserious, nothing within reach of anything else.
 *
 * Tightened roughly a third throughout. These are still comfortable on a phone;
 * touch targets come from a control's own padding, not from the gaps between
 * things.
 */
export const space = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 32,
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
 * A type scale, sized for a desktop.
 *
 * The previous scale ran 13/15/16/19/28 - phone sizes, and they looked it on a
 * monitor: a 28pt page title over 15pt rows reads as an app blown up to fill a
 * window rather than one built for it. Desktop software runs around 13-14pt for
 * body text, and the hierarchy comes from weight and colour rather than size.
 *
 * Still readable on a phone. 13.5pt body is what a great many production apps
 * ship, and the figures stay legible because Inter was chosen for that.
 *
 * `fontWeight` is kept alongside `fontFamily` because web renders from the CSS
 * weight while native takes the family. Both have to agree.
 *
 * EVERY LEVEL SETS ITS OWN lineHeight, AND THAT IS NOT OPTIONAL.
 * HeroUI's Typography takes line-height from a CSS variable on its component
 * class, so setting only `fontSize` leaves the leading of whatever size the
 * component thought it was. Rows measured 71pt when their content was 48pt -
 * two lines of text carrying ~24pt of leading each - and no amount of tightening
 * the padding would have found it.
 */
export const type = {
  /** Page title. One per screen. */
  title: {
    fontFamily: font.bold,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },

  /** Section heading. Small and quiet - the space around it does the work. */
  section: {
    fontFamily: font.semibold,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '600' as const,
    letterSpacing: 0.7,
  },

  /**
   * A form field's label.
   *
   * ITS OWN TOKEN because HeroUI's Label is 16pt and its Description 14pt -
   * the library's scale, which was never reconciled with this one. On a
   * settings screen that made every field label LARGER than the body text
   * (13.5), larger than a row title, and only four points below the page
   * title itself. Thirteen labels shouting over the values they describe.
   *
   * Semibold and below body: a label is signposting, and the value is the
   * thing being read.
   */
  label: { fontFamily: font.semibold, fontSize: 12.5, lineHeight: 16, fontWeight: '600' as const },

  /** The primary line of a row: a member's name, a fee head. */
  rowTitle: { fontFamily: font.semibold, fontSize: 13.5, lineHeight: 18, fontWeight: '600' as const },

  /** Supporting detail under it. */
  rowMeta: { fontFamily: font.regular, fontSize: 12, lineHeight: 16, fontWeight: '400' as const },

  /** Body copy in a paragraph. */
  body: { fontFamily: font.regular, fontSize: 13.5, lineHeight: 20, fontWeight: '400' as const },

  /** The figure a row is about. Large enough to anchor the eye. */
  amount: { fontFamily: font.semibold, fontSize: 15, lineHeight: 20, fontWeight: '600' as const },

  /** A dashboard figure. */
  stat: {
    fontFamily: font.bold,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
} as const;

/**
 * Measure lives in `breakpoint.ts`, not here.
 *
 * There was a single `maxContentWidth = 720` constant, which is why a desktop
 * browser rendered a phone-width column. A measure is not one number: a form
 * wants a short line and a report wants every pixel going. See useContentWidth.
 */
