import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useIsDesktop } from './breakpoint';
import { space, type } from './tokens';

export type SelectOption = {
  value: string;
  label: string;
  icon?: IconName;
  /** Options are grouped in first-seen order of this key. */
  group?: string;
};

/**
 * A single choice, in a menu anchored to its own trigger.
 *
 * WHY THIS EXISTS RATHER THAN HeroUI's Select
 * -------------------------------------------
 * Its popover does not anchor under React Native Web. Measured on an untouched
 * fee form: the trigger sat at x=234, y=143 and the menu rendered at x=27, y=5
 * - the corner of the window. On a toolbar it was worse, landing at y=-209,
 * entirely above the top of the page, so the control appeared to do nothing.
 *
 * That is the library's portal positioning under RN Web, not the way it was
 * called, and it is not something this side can configure away. This opens
 * against its own trigger instead - see the note on the two variants below for
 * exactly how, which differs between them for a reason worth reading.
 *
 * ONE COMPONENT FOR THE TOOLBAR AND THE FORM, because a filter and a form field
 * are the same decision - only the setting differs. `variant` is the whole of
 * the difference: a filter sits at control height beside a search box, a form
 * field is full width in a stack of labelled inputs. Having two
 * implementations of a dropdown is how one of them quietly stops matching the
 * other.
 *
 * THE TWO VARIANTS OPEN DIFFERENTLY, AND THAT IS NOT A STYLE CHOICE
 * ----------------------------------------------------------------
 * `compact` overlays; `field` pushes the content below it down.
 *
 * An overlay depends on z-index, and z-index cannot be owned by a component.
 * Measured on the fee form: with the menu open, the submit button below it
 * painted ON TOP of the options. Raising this component's own wrapper to
 * z-index 9999 changed nothing - the menu is sealed inside an ancestor's
 * stacking context - and it only came to the front once all TWENTY-ONE
 * ancestors were raised too. A control that needs every ancestor to cooperate
 * does not work; it happens to work where someone remembered.
 *
 * So the form variant does not try. A form is a vertical stack of fields, so
 * pushing the rest down costs nothing and cannot be defeated by a parent.
 *
 * The toolbar variant does overlay, because a filter bar is a horizontal row
 * where pushing content down would reflow the bar itself - and there the
 * container (ui/Toolbar) raises the stacking context deliberately, which is
 * noted on it.
 */
export function AnchoredSelect({
  options,
  value,
  onChange,
  placeholder = 'Choose…',
  isDisabled = false,
  icon,
  width,
  variant = 'field',
}: {
  options: SelectOption[];
  /** Null shows the placeholder. A filter always has a value; a form may not. */
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
  icon?: IconName;
  width?: number;
  variant?: 'compact' | 'field';
}) {
  const [open, setOpen] = useState(false);
  const isDesktop = useIsDesktop();

  const selected = options.find((o) => o.value === value);
  const compact = variant === 'compact';

  // Toolbar controls match the search box beside them; form fields match the
  // text inputs above and below them.
  const height = compact ? (isDesktop ? 34 : 40) : 48;

  // Groups in first-seen order, so the caller controls precedence by sorting
  // rather than by an extra prop.
  const groups: string[] = [];
  for (const option of options) {
    const key = option.group ?? '';
    if (!groups.includes(key)) groups.push(key);
  }

  return (
    <View style={{ zIndex: 20, width: compact ? undefined : '100%' }}>
      <Pressable
        onPress={() => !isDisabled && setOpen((o) => !o)}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled: isDisabled }}
        // RN Web maps neither spelling from the other - the same gap as the
        // date field and ui/Icon. Both, or a screen reader is told nothing.
        aria-expanded={open}
        accessibilityLabel={`${selected?.label ?? placeholder}. Choose an option.`}
        className="bg-field-background border border-field-border rounded-lg"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          paddingHorizontal: space.md,
          height,
          width: compact ? width : undefined,
          opacity: isDisabled ? 0.5 : 1,
        }}
      >
        {icon ? <Icon name={icon} size={15} tone="muted" /> : null}

        <Text
          numberOfLines={1}
          tone={selected ? 'default' : 'muted'}
          style={{ ...type.body, flex: 1 }}
        >
          {selected?.label ?? placeholder}
        </Text>

        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={15} tone="muted" />
      </Pressable>

      {open ? (
        <>
          {/*
            A press anywhere else closes it, for the OVERLAID variant only.

            An overlay hides what is under it, so without this the only way out
            is to choose something - which makes "I opened this by accident" an
            unrecoverable state. The in-flow variant pushes content down rather
            than covering it, nothing is hidden, and a full-window backdrop
            there would swallow the first press aimed at the field below.
          */}
          {compact ? (
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
          ) : null}

          <View
            accessibilityRole="menu"
            className="bg-surface border border-border rounded-lg"
            style={{
              // Overlaid for a filter, in the flow for a form field - see the
              // note at the top of this file for why they cannot both overlay.
              ...(compact
                ? { position: 'absolute' as const, top: height + space.xs, left: 0 }
                : { marginTop: space.xs }),
              minWidth: compact ? (width ?? 180) : undefined,
              paddingVertical: space.xs,
            }}
          >
            {/*
              Capped and scrollable: a chart of accounts can run to dozens of
              ledgers, and a menu taller than the window cannot be reached at
              its far end.
            */}
            <ScrollView style={{ maxHeight: 260 }}>
              {groups.map((group) => (
                <View key={group || 'ungrouped'}>
                  {group ? (
                    <Text
                      tone="muted"
                      style={{
                        ...type.section,
                        textTransform: 'uppercase',
                        paddingHorizontal: space.md,
                        paddingTop: space.sm,
                        paddingBottom: space.xs,
                      }}
                    >
                      {group}
                    </Text>
                  ) : null}

                  {options
                    .filter((o) => (o.group ?? '') === group)
                    .map((option) => {
                      const active = option.value === value;

                      return (
                        <Pressable
                          key={option.value}
                          onPress={() => {
                            onChange(option.value);
                            setOpen(false);
                          }}
                          accessibilityRole="menuitem"
                          accessibilityState={{ selected: active }}
                          className={active ? 'bg-surface-secondary' : undefined}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: space.sm,
                            paddingHorizontal: space.md,
                            paddingVertical: space.sm,
                          }}
                        >
                          {/*
                            The tick column is always present, even when empty,
                            so labels line up rather than shifting by the width
                            of a glyph depending on which one is chosen.
                          */}
                          <View style={{ width: 16 }}>
                            {active ? <Icon name="check" size={14} tone="accent" /> : null}
                          </View>

                          {option.icon ? (
                            <Icon name={option.icon} size={14} tone="muted" />
                          ) : null}

                          <Text numberOfLines={1} style={{ ...type.body, flex: 1 }}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                </View>
              ))}
            </ScrollView>
          </View>
        </>
      ) : null}
    </View>
  );
}
