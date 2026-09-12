import { Pressable, View } from 'react-native';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { space, type } from './tokens';

/**
 * A figure on a surface, with an icon and a label.
 *
 * WHY CARDS CAME BACK
 * -------------------
 * The first version of these screens wrapped everything in HeroUI Cards and
 * read as slabs. Stripping them fixed that and created the opposite problem: a
 * dashboard of bare numbers stacked in a column, with nothing separating one
 * figure from the next and no way to tell at a glance which mattered.
 *
 * Neither extreme was the answer. A LIST wants rows and a hairline - that is
 * what Row is for. A DASHBOARD FIGURE is a distinct object, and an object wants
 * an edge. The difference is what is being shown, not a preference about boxes.
 *
 * These are deliberately compact - roughly 92pt - because the earlier cards were
 * enormous. An edge does not have to be a slab.
 */
export function Stat({
  label,
  value,
  icon,
  tone = 'neutral',
  emphasis = 'normal',
  meta,
  onPress,
}: {
  label: string;
  /** Pre-formatted. This component does no arithmetic and no formatting. */
  value: string;
  icon: IconName;
  /**
   * `attention` for a figure someone has to act on, `danger` for one that is
   * wrong. Colour here is meaning, not decoration - if every card were tinted,
   * none of them would say anything.
   *
   * NOT FOR MONEY OWED, which is what this used to say. Arrears are the normal
   * condition of a cooperative, not an emergency, and a permanently red
   * ৳1,24,000 spends the one signal the screen has on a number that is simply
   * large. Red is kept for a suspended membership - something a person has to
   * put right.
   */
  tone?: 'neutral' | 'attention' | 'danger';
  /**
   * How much of the screen this figure is entitled to.
   *
   * `lead` for the cards a screen exists to raise - what is waiting, what is
   * wrong. Everything else is `normal`, and the difference is the whole answer
   * to a dashboard where every card looked identical and therefore ranked
   * nothing. A screen with no `lead` cards is fine; a screen where they ALL
   * lead is a screen back where it started.
   */
  emphasis?: 'lead' | 'normal';
  meta?: string;
  onPress?: () => void;
}) {
  const iconTone = tone === 'danger' ? 'danger' : tone === 'attention' ? 'accent' : 'muted';
  const leads = emphasis === 'lead';

  /*
   * A tinted card is a card with something to say, and the tint follows the
   * TONE rather than the emphasis - a lead card whose figure is zero
   * ("nothing waiting") is good news and should look like the others, which is
   * why the screens pass `neutral` in that case.
   */
  const surface =
    tone === 'attention'
      ? 'bg-accent-soft border border-accent'
      : tone === 'danger'
        ? 'bg-danger-soft border border-danger'
        : 'bg-surface border border-border';

  const body = (
    <View
      className={surface}
      style={{
        flex: 1,
        minWidth: 190,
        padding: leads ? space.xl : space.lg,
        borderRadius: 12,
        gap: leads ? space.md : space.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Icon name={icon} size={16} tone={iconTone} />
        <Text tone="muted" style={{ ...type.section, textTransform: 'uppercase', flex: 1 }}>
          {label}
        </Text>
        {onPress ? <Icon name="chevron" size={16} tone="muted" /> : null}
      </View>

      <Text
        tone={tone === 'danger' ? 'danger' : 'default'}
        style={{ ...(leads ? type.statLead : type.stat), fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>

      {meta ? (
        <Text tone="muted" style={type.rowMeta}>
          {meta}
        </Text>
      ) : null}
    </View>
  );

  return onPress ? (
    <Pressable onPress={onPress} style={{ flex: 1, minWidth: 190 }}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

/**
 * A row of stats that wraps.
 *
 * `minWidth` on each card does the responsive work: three fit on a desktop, one
 * per line on a phone, without a breakpoint being consulted anywhere.
 */
export function StatGrid({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>{children}</View>;
}

/**
 * A card you go INTO, rather than a figure you read.
 *
 * Stat puts a small label over a large value, which is right for a number and
 * exactly wrong for navigation: used for a report it rendered the description
 * at 24pt and the report's own name in small caps above it. Same surface,
 * inverted hierarchy - the name leads and the sentence explains it.
 */
export function Tile({
  title,
  description,
  icon,
  onPress,
}: {
  title: string;
  description: string;
  icon: IconName;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, minWidth: 240 }}>
      <View
        className="bg-surface border border-border"
        style={{ padding: space.lg, borderRadius: 12, gap: space.xs }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Icon name={icon} size={16} tone="accent" />
          <Text style={{ ...type.rowTitle, flex: 1 }}>{title}</Text>
          <Icon name="chevron" size={16} tone="muted" />
        </View>

        <Text tone="muted" style={type.rowMeta}>
          {description}
        </Text>
      </View>
    </Pressable>
  );
}
