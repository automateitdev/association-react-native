import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Appear } from './Appear';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useIsDesktop } from './breakpoint';
import { space, type } from './tokens';

/**
 * A group of related things, expressed with space rather than a box.
 *
 * This replaces the `Card` that used to wrap every section. A card says "this
 * is a distinct object"; most of what these screens group is not an object, it
 * is a heading and the rows beneath it. Using a container for that produced the
 * slab-on-slab look - and nested containers wherever a card held cards.
 *
 * The heading is small, letterspaced and muted on purpose: findable when
 * scanning, invisible when reading.
 */
export function Section({
  title,
  icon,
  action,
  children,
  first = false,
  step,
}: {
  /**
   * The heading, and it is optional on purpose.
   *
   * A section takes a heading when it needs telling apart from something else
   * on the screen - another section above it, a form the list must not be
   * confused with. It does NOT take one just because it is a section. The
   * commonest mistake here was repeating the page title over the only list on
   * the page ("Members" under "Members"): a second label for the same thing,
   * which fills a line, marks nothing, and teaches people to read past
   * headings on the screens where one does carry meaning.
   *
   * Where a heading is worth having, prefer one that ADDS something -
   * "Awaiting a decision", "Who is paying" - over one that names the noun
   * again.
   */
  title?: string;
  /**
   * A glyph beside the heading.
   *
   * Optional and used sparingly. Section headings are small, letterspaced and
   * muted precisely so they are findable when scanning and invisible when
   * reading - an icon on every one of them would undo that. It earns its place
   * where a heading marks a change of KIND rather than just the next group:
   * the money on a dues screen, the download beside a table.
   */
  icon?: IconName;
  /** A single control belonging to this section - "Add", "Edit". */
  action?: ReactNode;
  children: ReactNode;
  /** Tighter top margin. For the first section under a page title. */
  first?: boolean;
  /**
   * This section's place in an ordered set - "1", then "2", then "3".
   *
   * WRITTEN OUT BY HAND IN TWO SCREENS BEFORE THIS EXISTED: `1 · Which fee`,
   * `2 · When it applies`, `3 · Which members` on the fee-assign screen and
   * `1 · Choose instalments`, `2 · How would you like to pay?` on the member's
   * payment screen - the separator, the spacing and the numbering all retyped,
   * with nothing keeping the two screens agreeing on any of them.
   *
   * It marks ORDER, not progress. Every step here is on screen at once and can
   * be answered in any order; nothing is locked until an earlier one is done.
   * A screen that genuinely gates its steps needs a different control, and
   * borrowing this one to imply it would be a lie about what the form allows.
   */
  step?: number;
}) {
  return (
    <View style={{ marginTop: first ? space.md : space.xl }}>
      {title ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: space.sm,
            gap: space.md,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.xs,
            }}
          >
            {icon ? <Icon name={icon} size={14} tone="muted" /> : null}
            <Text tone="muted" style={{ ...type.section, textTransform: 'uppercase' }}>
              {step === undefined ? title : `${step} · ${title}`}
            </Text>
          </View>
          {action}
        </View>
      ) : null}

      {children}
    </View>
  );
}

/**
 * A hairline.
 *
 * `border-border` rather than a hard-coded grey or an opacity: the theme
 * already defines what a divider is worth in light and dark, and picking a
 * value here would be right in one of them at best.
 */
export function Divider({ inset = 0 }: { inset?: number }) {
  return <View className="bg-border" style={{ height: 1, marginLeft: inset }} />;
}

/**
 * A surface for something that genuinely IS a distinct object - a confirmation
 * step, an error, a callout that must not be read as part of the flow.
 *
 * Deliberately rare, and the only place a filled surface is allowed. If this
 * appears three times on one screen, the screen has gone back to being blocky
 * and the answer is a Section.
 */
export function Panel({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  /**
   * WHAT KIND OF ANSWER THIS IS.
   *
   * `success` was missing and its absence was already being worked around in
   * the code: the staff-accounts screen carries a comment reading "Neutral, not
   * danger. The account saved; nothing went wrong" - a note explaining that the
   * only two tones available were both wrong for what had just happened. With
   * nothing to say "this worked", every outcome that was not a failure had to
   * borrow the voice of a passing remark.
   *
   *   neutral  a remark. Context, a caveat, something worth knowing.
   *   success  it happened. The payment is recorded, the account exists.
   *   warning  it will happen, and here is what it costs. Before, not after.
   *   danger   it did not happen, or it cannot be undone.
   *
   * Green and red are not enough on their own - a colour blind reader gets
   * nothing from the border - so each tone also carries its own glyph, and the
   * text inside must still say what happened without either.
   */
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  /*
   * A PANEL ARRIVES rather than appearing.
   *
   * Most panels in this app are the result of something the person just did -
   * a payment recorded, a transfer refused, a warning about what a screen is
   * about to change. Those are answers, and an answer that is simply present
   * on the next frame is indistinguishable from one that was always there. The
   * eye misses it, and on a long form the miss is total: the refusal is above
   * the fold and nobody scrolls back up to look.
   *
   * No travel. A panel that slides has to slide from somewhere, and there is
   * no honest direction for "the server said no" to come from. It fades.
   */
  const skin = PANEL_TONES[tone];

  return (
    <Appear distance={0}>
      <View
        className={`${skin.className} rounded-field`}
        style={{
          padding: space.lg,
          gap: space.sm,
        }}
      >
        {skin.icon ? <Icon name={skin.icon} size={16} tone={skin.iconTone} /> : null}

        {children}
      </View>
    </Appear>
  );
}

/**
 * The four tones, and the glyph that says which one it is without colour.
 *
 * Neutral has no glyph on purpose: a remark that announces itself with an icon
 * is no longer a remark, and every panel wearing a badge is the same as none of
 * them wearing one.
 */
const PANEL_TONES = {
  neutral: {
    className: 'bg-background-secondary border border-border',
    icon: null,
    iconTone: 'muted',
  },
  success: {
    className: 'bg-success-soft border border-success',
    icon: 'check',
    iconTone: 'success',
  },
  warning: {
    className: 'bg-warning-soft border border-warning',
    icon: 'warning',
    iconTone: 'warning',
  },
  danger: {
    className: 'bg-danger-soft border border-danger',
    icon: 'warning',
    iconTone: 'danger',
  },
} as const satisfies Record<
  string,
  {
    className: string;
    icon: IconName | null;
    iconTone: 'muted' | 'success' | 'warning' | 'danger';
  }
>;

/**
 * Where a screen's primary action goes.
 *
 * Buttons were rendering full-bleed - "Pay now" as a 1000pt green capsule
 * across the whole content column. That is a phone pattern, where a thumb needs
 * the width; on a desktop it reads as a banner and makes the page look like an
 * enlarged app rather than a built one.
 *
 * On a phone it still stretches, because there the original reason holds.
 */
export function Actions({
  children,
  align = 'start',
}: {
  children: ReactNode;
  align?: 'start' | 'stretch';
}) {
  const isDesktop = useIsDesktop();
  const stretch = align === 'stretch' || !isDesktop;

  return (
    <View
      style={{
        marginTop: space.lg,
        flexDirection: 'row',
        gap: space.sm,
        alignSelf: stretch ? 'stretch' : 'flex-start',
      }}
    >
      {children}
    </View>
  );
}

/**
 * The style a button inside `Actions` should carry.
 *
 * Paired buttons were written as `style={{ flex: 1 }}` - right on a phone, where
 * Cancel and Confirm split the screen between them, and absurd on a desktop,
 * where they split 1240pt and each came out 620pt wide. A confirm button the
 * width of half a monitor does not read as a button.
 *
 * A hook rather than a constant because the answer depends on the viewport, and
 * a hook is the only thing a component can ask at render time.
 */
export function useActionButtonStyle() {
  const isDesktop = useIsDesktop();

  // Wide enough for "Confirm reinstate" without wrapping; nowhere near the
  // width of the page.
  return isDesktop ? { minWidth: 150 } : { flex: 1 };
}
