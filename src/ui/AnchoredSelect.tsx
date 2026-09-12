import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { useThemeColor } from 'heroui-native';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useControlHeight } from './breakpoint';
import { useFormDensity } from './Form';
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
 * ONE COMPONENT FOR THE TOOLBAR AND THE FORM, because a filter and a form field
 * are the same decision - only the setting differs. `variant` changes the
 * trigger's size and nothing else. Having two implementations of a dropdown is
 * how one of them quietly stops matching the other.
 *
 * EVERY MENU OVERLAYS, AND THAT TOOK A PORTAL
 * -------------------------------------------
 * The form variant used to open IN THE FLOW - pushing everything below it down
 * the page, which is an accordion rather than a dropdown, and was immediately
 * recognisable as wrong by anyone using it.
 *
 * It did that because an overlay inside the page cannot win: z-index is not
 * something a component owns. Measured on the fee form, with the menu open the
 * submit button below it painted ON TOP of the options; raising this
 * component's own wrapper to 9999 changed nothing, because the menu was sealed
 * inside an ancestor's stacking context, and it only came to the front once all
 * TWENTY-ONE ancestors were raised too.
 *
 * The answer is not to fight that but to leave it. `Modal` renders at the root
 * of the app - a portal on React Native Web, a window above the activity on
 * iOS and Android - so the menu has no ancestors to be trapped by and no
 * parent's overflow to be clipped against. It is the mechanism a native picker
 * already uses, and the reason this works on all three platforms rather than on
 * whichever one it was last looked at.
 *
 * The cost is that a portalled menu no longer moves with its trigger, so the
 * trigger is MEASURED IN WINDOW COORDINATES each time it opens, and the
 * backdrop covers the page while it is open - which stops the page scrolling
 * out from under it and gives "I opened this by accident" a way out.
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
  const trigger = useRef<View>(null);

  /**
   * Where the trigger sits in the WINDOW, not in its parent.
   *
   * Null means closed. The two are deliberately one piece of state: a menu
   * open without a measurement would paint at the top-left corner for a frame,
   * which is the exact bug this component was written to escape.
   */
  const [anchor, setAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const open = anchor !== null;
  const window = useWindowDimensions();
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

  /*
   * MEASURED ON EVERY OPEN, not once and remembered.
   *
   * A toolbar wraps, a form scrolls, a window resizes - the trigger is rarely
   * where it was last time. measureInWindow is asynchronous, so the menu opens
   * in its callback rather than beside it: opening first and measuring after is
   * a frame of menu in the corner of the screen.
   */
  const openMenu = () => {
    if (isDisabled) return;

    trigger.current?.measureInWindow((x, y, w, h) => {
      setAnchor({ x, y, width: w, height: h });
    });
  };

  const close = () => setAnchor(null);

  const placement = anchor ? place(anchor, window, compact ? width : anchor.width) : null;

  return (
    <View style={{ width: compact ? undefined : '100%' }}>
      <Pressable
        ref={trigger}
        onPress={() => (open ? close() : openMenu())}
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

      {placement ? (
        <Modal
          visible
          transparent
          // No slide, no fade. A menu that animates in is a menu that is not
          // yet under the finger that asked for it.
          animationType="none"
          // Android's hardware back, and Escape on web.
          onRequestClose={close}
        >
          {/*
            A press anywhere else closes it.

            Full-window, which is what a portalled menu needs and what the
            in-flow version could never have: there is no longer a field
            directly below whose first press this would swallow, because the
            menu is no longer in that column.
          */}
          <Pressable
            onPress={close}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          <View
            accessibilityRole="menu"
            className="bg-surface border border-border rounded-field"
            style={{
              position: 'absolute',
              left: placement.left,
              width: placement.width,
              ...(placement.flip ? { bottom: placement.bottom } : { top: placement.top }),
              paddingVertical: space.xs,

              /*
                A portalled menu has nothing of the page behind it, so it
                carries its own lift - without this it reads as options printed
                onto whatever it covers. The shadow is what says "above", which
                is the one thing the accordion could never say.
              */
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }}
          >
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

            {/*
              Capped to what the window can actually show - measured, not a
              constant. A chart of accounts runs to dozens of ledgers, and a
              menu taller than the space it opened into cannot be reached at
              its far end.
            */}
            <ScrollView
              style={{ maxHeight: placement.maxHeight - (searchable ? 52 : 0) }}
              keyboardShouldPersistTaps="handled"
            >
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
                            close();
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
        </Modal>
      ) : null}
    </View>
  );
}

/** The gap between a trigger and its menu, and the menu's margin from the edge. */
const GAP = 4;
const MARGIN = 8;
const TALLEST = 320;

/**
 * Where the menu goes, given where the trigger is.
 *
 * FLIPPING UP IS ONLY POSSIBLE NOW THAT THE MENU IS PORTALLED, and its
 * impossibility before is why the old one scrolled the page instead. An
 * IN-FLOW panel rendered above its trigger pushes the trigger down by its own
 * height, so "flipping up" a 270pt menu moved the thing you had just pressed
 * 270pt further down the page - the control ran away from the finger that
 * opened it. An absolutely positioned one moves nothing, so it can simply go
 * wherever there is room.
 *
 * Measured on the fee-assign screen in a 586x415 window: pressing Months put
 * the trigger at y=346 with twelve options needing 384pt below it, in a window
 * that ends at 366. That menu now opens upwards.
 */
function place(
  anchor: { x: number; y: number; width: number; height: number },
  window: { width: number; height: number },
  preferredWidth?: number,
) {
  const below = window.height - (anchor.y + anchor.height) - GAP - MARGIN;
  const above = anchor.y - GAP - MARGIN;

  /*
   * Downwards unless upwards is genuinely roomier - NOT "whenever it does not
   * all fit". A menu that flips for one option too many is a menu that jumps
   * from one side of its trigger to the other as somebody types into it.
   */
  const flip = below < Math.min(TALLEST, above) && above > below;

  const width = Math.min(
    Math.max(preferredWidth ?? anchor.width, anchor.width, 180),
    window.width - MARGIN * 2,
  );

  return {
    flip,
    width,
    // Clamped to the window, so a control near the right edge opens inwards
    // rather than off the side.
    left: Math.min(Math.max(MARGIN, anchor.x), Math.max(MARGIN, window.width - width - MARGIN)),
    top: anchor.y + anchor.height + GAP,
    bottom: window.height - anchor.y + GAP,
    maxHeight: Math.max(120, Math.min(TALLEST, flip ? above : below)),
  };
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
