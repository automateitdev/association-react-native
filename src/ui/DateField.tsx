import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Calendar, humanDate, todayIso, type DateRange, type IsoDate } from './Calendar';
import { Icon } from './Icon';
import { Text } from './Text';
import { space, type } from './tokens';

/**
 * A date, or a range of dates, chosen from a calendar.
 *
 * THE CALENDAR OVERLAYS rather than pushing the layout apart, and that changed.
 *
 * It first expanded in place, on the reasoning that shifting the content below
 * it down by 300pt costs nothing while avoiding a portal, focus management and
 * a phone-versus-desktop decision. That held while the field sat in a section
 * of its own. It stopped holding when the filters moved into a toolbar: a
 * 300pt-tall item in a wrapping flex row reflows the whole bar, so opening the
 * calendar shunted the status dropdown and the download buttons to new
 * positions - controls moving because you looked at a different one.
 *
 * So it is absolutely positioned against its own trigger now, the same as
 * ui/FilterSelect, and for the same reason: HeroUI's own portal does not anchor
 * under React Native Web, and this does.
 *
 * IT CLOSES ITSELF once a range is complete, because the second press is the
 * end of the task. Leaving it open makes the reader hunt for a Done button that
 * would exist only to be pressed.
 *
 * ALWAYS A RANGE. See ui/Calendar - the single-date mode is gone, and with it
 * the possibility of two identical-looking controls that need a different
 * number of presses.
 */
export function DateField({
  value,
  onChange,
  placeholder = 'Any date',
  maximum = todayIso(),
  onClear,
}: {
  value: DateRange;
  onChange: (value: DateRange) => void;
  placeholder?: string;
  /** Defaults to today: a report "as at" a future date answers nothing. */
  maximum?: IsoDate;
  /** Offered only when clearing means something - "all time", "today". */
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);

  const handle = (next: DateRange) => {
    onChange(next);

    // Both ends chosen: the task is done and the calendar gets out of the way.
    if (next.from && next.to) setOpen(false);
  };

  return (
    // zIndex so the calendar overlays what is beneath it rather than being
    // painted over by the table - see ui/Toolbar, which raises the whole bar.
    <View style={{ zIndex: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Pressable
          onPress={() => setOpen((o) => !o)}
          accessibilityRole="button"
          /*
           * BOTH spellings, because React Native Web maps neither
           * accessibilityState.expanded nor aria-expanded from the other.
           * Measured: with only accessibilityState the rendered element had no
           * aria-expanded at all, so a screen reader could not tell whether the
           * calendar was open. Same fix as ui/Icon.tsx and for the same reason.
           */
          accessibilityState={{ expanded: open }}
          aria-expanded={open}
          accessibilityLabel={`${describe(value, placeholder)}. Choose a date range.`}
          className="border border-field-border bg-field-background rounded-lg"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
          }}
        >
          <Icon name="calendar" size={15} tone="muted" />
          <Text style={type.body}>{describe(value, placeholder)}</Text>
        </Pressable>

        {onClear && (value.from || value.to) ? (
          <Pressable
            onPress={() => {
              onClear();
              setOpen(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear the selected dates"
            style={{ padding: space.sm }}
          >
            <Icon name="close" size={15} tone="muted" />
          </Pressable>
        ) : null}
      </View>

      {open ? (
        <>
          {/*
            A press anywhere else closes it. Without this the only way out is to
            complete a range, which makes "I opened this by accident" an
            unrecoverable state. Same backdrop as ui/FilterSelect.
          */}
          <Pressable
            onPress={() => setOpen(false)}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              position: 'absolute',
              top: -2000,
              left: -2000,
              right: -2000,
              bottom: -2000,
              zIndex: -1,
            }}
          />

          <View style={{ position: 'absolute', top: 42, left: 0 }}>
            <Calendar value={value} onChange={handle} maximum={maximum} />

            {value.from && !value.to ? (
              <Text
                tone="muted"
                className="bg-surface"
                style={{ ...type.rowMeta, marginTop: space.xs, padding: space.xs }}
              >
                Now choose the end of the range.
              </Text>
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );
}

/** What the trigger says. */
function describe(value: DateRange, placeholder: string): string {
  if (value.from && value.to) return `${humanDate(value.from)} – ${humanDate(value.to)}`;

  // Mid-selection: the start is chosen and the end is not yet.
  if (value.from) return `${humanDate(value.from)} – …`;

  return placeholder;
}
