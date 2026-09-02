import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { Text } from './Text';
import { space, type } from './tokens';

/**
 * The application's own chrome.
 *
 * WHY THIS EXISTS
 * ---------------
 * There was none. Every screen began with its own page title and nothing above
 * it, so the app never said what it was, which association you were in, or who
 * you were signed in as - and sign-out was buried inside a page header, which
 * is not where anyone looks for it.
 *
 * That matters more here than in a single-tenant app. This is multi-tenant
 * software where staff at one association must never act on another's data;
 * keeping the association's name permanently on screen is the cheapest guard
 * there is against acting in the wrong one. Its absence was a real gap, not a
 * missing flourish.
 */
export function AppBar({
  association,
  userName,
  userRole,
  onSignOut,
  themePreference,
  onCycleTheme,
}: {
  association: string;
  userName?: string;
  userRole?: string;
  onSignOut: () => void;
  /** Shown so the control says which of the three states it is in. */
  themePreference?: 'light' | 'dark' | 'system';
  onCycleTheme?: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="bg-surface border-b border-border"
      style={{
        paddingTop: insets.top + space.sm,
        paddingBottom: space.sm,
        paddingHorizontal: space.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
      }}
    >
      {/*
        A mark, not a logo. No association has supplied one, and inventing a
        drawn logo for a real organisation would be worse than an honest glyph.
      */}
      <View
        className="bg-accent"
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="bank" size={17} tone="inverse" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={type.rowTitle} numberOfLines={1}>
          {association}
        </Text>
        {userName ? (
          <Text tone="muted" style={type.rowMeta} numberOfLines={1}>
            {userName}
            {userRole ? ` · ${userRole}` : ''}
          </Text>
        ) : null}
      </View>

      {/*
        The theme control names its CURRENT state rather than the next one.
        A sun that means "you are in light mode" and a sun that means "switch to
        light mode" look identical, and only one of them is honest - so the
        label spells it out for a screen reader, and `system` gets its own glyph
        rather than borrowing whichever mode it happens to be resolving to.
      */}
      {onCycleTheme ? (
        <Pressable
          onPress={onCycleTheme}
          accessibilityRole="button"
          accessibilityLabel={`Theme: ${themePreference ?? 'system'}. Tap to change.`}
          style={{
            paddingVertical: space.sm,
            paddingHorizontal: space.sm,
            borderRadius: 8,
          }}
        >
          <Icon
            name={
              themePreference === 'light'
                ? 'light'
                : themePreference === 'dark'
                  ? 'dark'
                  : 'auto'
            }
            size={18}
            tone="muted"
          />
        </Pressable>
      ) : null}

      {/*
        Sign out lives here, once, rather than on whichever screen had room for
        it. Labelled for screen readers because the glyph carries the meaning.
      */}
      <Pressable
        onPress={onSignOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.xs,
          paddingVertical: space.sm,
          paddingHorizontal: space.sm,
          borderRadius: 8,
        }}
      >
        <Icon name="signOut" size={18} tone="muted" />
      </Pressable>
    </View>
  );
}
