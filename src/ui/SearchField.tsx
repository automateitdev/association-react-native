import { Pressable, TextInput, View } from 'react-native';
import { useThemeColor } from 'heroui-native';
import { Icon } from './Icon';
import { useIsDesktop } from './breakpoint';
import { font, space, type } from './tokens';

/**
 * A search box, sized like a control rather than like a form field.
 *
 * WHY NOT HeroUI's TextField
 * --------------------------
 * Two reasons, and the first is the one that shows.
 *
 * Its Input is a FORM field: 48pt tall, full width, built to sit in a stack of
 * labelled inputs where that height is right. A filter above a table is not
 * that. It sat 340pt wide and half again the height of everything around it,
 * which is what made it read as the most important thing on the page rather
 * than as a way to narrow the list underneath.
 *
 * Second, HeroUI's TextField has no slot for leading content, so a magnifier
 * inside the box is not expressible with it at all - and a search box without
 * one is a rectangle you have to read the placeholder of to identify.
 *
 * THE CLEAR BUTTON APPEARS ONLY WHEN THERE IS SOMETHING TO CLEAR. A permanent
 * one is a control that does nothing most of the time, and on a filter bar that
 * is the difference between "you have searched for something" being visible at
 * a glance and not.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search',
  width = 260,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /** Capped, not stretched: no search box needs the width of the page. */
  width?: number;
}) {
  const isDesktop = useIsDesktop();

  // Resolved rather than classed: TextInput's placeholder colour is a prop, and
  // a Tailwind utility cannot reach it.
  const placeholderColor = useThemeColor('field-placeholder');
  const foreground = useThemeColor('field-foreground');

  return (
    <View
      className="bg-field-background border border-field-border rounded-lg"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.md,
        // 34 beside a 32pt button reads as the same family of control. On a
        // phone it stays at the touch-target height for the same reason the
        // buttons do.
        height: isDesktop ? 34 : 40,
        width,
        maxWidth: '100%',
      }}
    >
      <Icon name="search" size={15} tone="muted" />

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        autoCapitalize="none"
        autoCorrect={false}
        // The web's own affordance: a search input gets an Escape-to-clear and
        // the right keyboard on a phone.
        returnKeyType="search"
        style={{
          flex: 1,
          color: foreground,
          fontFamily: font.regular,
          fontSize: type.body.fontSize,
          /*
            RN Web draws its own focus ring on inputs, which does not match
            anything else in the app. React Native's TextStyle has no
            outlineStyle - it is a web-only property that RN Web passes through
            - so the cast is the honest way to say "this line is for the web
            build" rather than a type being wrong.
          */
          ...({ outlineStyle: 'none' } as object),
        }}
      />

      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Clear the search"
          hitSlop={8}
        >
          <Icon name="close" size={14} tone="muted" />
        </Pressable>
      ) : null}
    </View>
  );
}
