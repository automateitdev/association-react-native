import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useThemeColor } from 'heroui-native';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useControlHeight } from './breakpoint';
import { useFormDensity } from './Form';
import { useReveal } from './reveal';
import { fieldPadding, space, type } from './tokens';

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
  search,
  onSearchChange,
  searchPlaceholder = 'Type to search…',
  values,
  onToggleValue,
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
  /**
   * Turns the menu into a searchable one, with the box at the top.
   *
   * Pass the current text AND a handler and the caller does the matching -
   * which is what a list too long to send in full needs: the picker asks the
   * server as somebody types. Pass `search` alone and it filters the options
   * it already holds.
   *
   * A menu of three does not need this. A menu of three hundred is unusable
   * without it - and one showing 25 of the three hundred with no way to reach
   * the rest is worse than either, because nothing on screen says the other
   * 275 exist.
   */
  search?: string;
  onSearchChange?: (text: string) => void;
  searchPlaceholder?: string;
  /**
   * Turns the menu into a MULTI-select, holding every chosen value.
   *
   * Passing this switches the control's whole character: the menu stays open
   * as things are ticked, because closing after each one makes choosing three
   * items three round trips through the same menu. `value`/`onChange` are
   * ignored while it is set.
   *
   * The tick column that single-select already draws does the work - a
   * multi-select that looked identical to a single one, differing only in
   * whether the menu closed, would be a worse lie than no multi-select at all.
   */
  values?: string[];
  onToggleValue?: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Opening near the foot of the page scrolls the menu into view. See
  // ui/reveal, which also says why this is not a flip-up.
  const reveal = useReveal(open);
  const placeholderColor = useThemeColor('field-placeholder');
  const dense = useFormDensity();
  const controlHeight = useControlHeight();
  const searchable = search !== undefined;
  const multiple = values !== undefined;

  /*
   * A SERVER-SEARCHED MENU MUST NOT FILTER AGAIN HERE.
   *
   * The caller already asked for the matches. Filtering its answer by the same
   * text a second time drops every row that matched on something the label
   * does not show - a member found by their membership number, say, whose
   * label is their name.
   */
  const shown =
    searchable && onSearchChange === undefined && search.trim() !== ''
      ? options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase()))
      : options;

  const selected = options.find((o) => o.value === value);
  const compact = variant === 'compact';

  /*
   * Toolbar controls match the search box beside them; form fields match the
   * text inputs above and below them - INCLUDING when those are dense.
   *
   * The field variant used to be a flat 48, which is right beside a full-height
   * input and a third too tall beside a dense one. Measured on the new-fee
   * form: two inputs at 40 and a picker at 48 in the same column, which reads
   * as one field having gone wrong rather than as a size anybody chose.
   */
  const height = compact ? controlHeight : dense ? 40 : 48;

  // Groups in first-seen order, so the caller controls precedence by sorting
  // rather than by an extra prop.
  const groups: string[] = [];
  for (const option of shown) {
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
        className="bg-field border border-field-border rounded-field"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          paddingHorizontal: fieldPadding,
          height,
          width: compact ? width : undefined,
          opacity: isDisabled ? 0.5 : 1,
        }}
      >
        {icon ? <Icon name={icon} size={15} tone="muted" /> : null}

        <Text
          numberOfLines={1}
          tone={
            multiple ? (values.length > 0 ? 'default' : 'muted') : selected ? 'default' : 'muted'
          }
          style={{ ...type.body, flex: 1 }}
        >
          {multiple ? summarise(values, options, placeholder) : (selected?.label ?? placeholder)}
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
            {...reveal}
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
            {searchable ? (
              <View style={{ paddingHorizontal: space.sm, paddingBottom: space.xs }}>
                <TextInput
                  value={search}
                  onChangeText={(text) => onSearchChange?.(text)}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={placeholderColor}
                  autoFocus
                  className="bg-field border border-field-border rounded-field text-field-foreground"
                  style={{ height: 38, paddingHorizontal: space.md, ...type.body }}
                />
              </View>
            ) : null}

            <ScrollView style={{ maxHeight: 260 }} keyboardShouldPersistTaps="handled">
              {/*
                Said, rather than left blank. An empty menu after typing looks
                exactly like one that is still loading.
              */}
              {shown.length === 0 ? (
                <Text
                  tone="muted"
                  style={{
                    ...type.rowMeta,
                    paddingHorizontal: space.md,
                    paddingVertical: space.sm,
                  }}
                >
                  Nothing matches.
                </Text>
              ) : null}

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

                  {shown
                    .filter((o) => (o.group ?? '') === group)
                    .map((option) => {
                      const active = multiple
                        ? values.includes(option.value)
                        : option.value === value;

                      return (
                        <Pressable
                          key={option.value}
                          onPress={() => {
                            if (multiple) {
                              onToggleValue?.(option.value);
                              // Stays open: choosing three things should not
                              // mean opening the same menu three times.
                              return;
                            }

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

                          {option.icon ? <Icon name={option.icon} size={14} tone="muted" /> : null}

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

/**
 * What a multi-select trigger says when it is closed.
 *
 * Names them while they fit and counts them when they do not. A trigger
 * reading "2026, 2027" is worth more than one reading "2 selected" - it
 * answers without being opened - but past three the names stop fitting and a
 * truncated list is the worst of both: it neither names them nor counts them.
 */
function summarise(values: string[], options: SelectOption[], placeholder: string): string {
  if (values.length === 0) return placeholder;

  if (values.length <= 3) {
    return values.map((v) => options.find((o) => o.value === v)?.label ?? v).join(', ');
  }

  return `${values.length} selected`;
}
