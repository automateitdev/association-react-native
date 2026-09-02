import '@/global.css';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { MaterialSymbols_400Regular } from '@expo-google-fonts/material-symbols';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { HeroUINativeProvider, useThemeColor } from 'heroui-native';
import { useFonts } from 'expo-font';
import { useMemo } from 'react';
import { ActivityIndicator, I18nManager, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ApiError } from '@/api/errors';
import { SessionProvider } from '@/features/auth/session';

/**
 * Application shell.
 *
 * GestureHandlerRootView must be the OUTERMOST wrapper - HeroUI Native's
 * overlays (bottom sheets, popovers) mount through it, and without it they
 * render but do not respond to touch.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();

  /*
   * Typeface and icon font, loaded before anything renders.
   *
   * The app shipped in the platform's default system font, which is why it read
   * as unfinished - and `--font-display: Spline Sans, Inter` sat unused in
   * global.css the whole time, declared and never applied to anything.
   *
   * Inter is chosen for the reason this app needs most: its figures are clear
   * at small sizes and it has proper tabular numerals, so a column of amounts
   * lines up. Four weights, because the type scale actually uses four.
   *
   * MaterialSymbols is the icon set - a ligature font, so an icon costs one
   * Text node and inherits colour and size like text. See ui/Icon.tsx.
   */
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    MaterialSymbols_400Regular,
  });

  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /**
             * Do not retry what will not succeed.
             *
             * A 403 for a suspended member is a settled answer; retrying it
             * three times only delays telling them. Only genuinely transient
             * failures are worth another attempt.
             */
            retry: (failureCount, error) =>
              error instanceof ApiError ? error.isRetryable && failureCount < 2 : failureCount < 2,

            staleTime: 30_000,

            // Members check their dues right after paying at a bank counter.
            // Refetching on focus is what makes the status look live.
            refetchOnWindowFocus: true,
          },
          mutations: {
            /**
             * NEVER retry a mutation automatically.
             *
             * Payment creation is idempotent only when the SAME key is reused.
             * An automatic retry sits outside that guarantee, and a duplicate
             * payment is the exact failure the key exists to prevent. Retrying
             * is the member's decision, made explicitly, reusing the key.
             */
            retry: false,
          },
        },
      }),
    [],
  );

  /*
   * Hold the first frame until the fonts are in.
   *
   * Rendering in the system font and swapping to Inter a beat later is a
   * visible reflow on every launch - text jumps size and the layout settles
   * after the user has started reading. A brief spinner is the lesser evil, and
   * on web the fonts are usually cached anyway.
   */
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider
        config={{
          // Members set large system font sizes. The cap keeps layouts intact
          // while still honouring the preference (NFR-USE-3).
          textProps: { allowFontScaling: true, maxFontSizeMultiplier: 1.5 },
          textInputProps: { allowFontScaling: true, maxFontSizeMultiplier: 1.5 },
          isRTL: I18nManager.isRTL,
        }}
      >
        {/*
          ThemeBackground paints the ground in the SAME theme HeroUI renders its
          components in.

          Without it the app is genuinely unreadable: HeroUI follows the
          `light`/`dark` CSS variant (which falls back to prefers-color-scheme),
          so on a dark-preferring system it draws dark surfaces and white text -
          while the page keeps React Native Web's default light background.
          White text on light grey. The provider has no theme prop; this is the
          mechanism.
        */}
        {/*
          The app paints its own ground.

          Two earlier attempts were wrong and are worth recording:
          - `ThemeBackground` is for component-level glass/overlay fills, and
            its own docs say it is ignored when children are supplied. It was a
            no-op here.
          - Importing `@react-navigation/native` directly fails outright:
            expo-router refuses it from SDK 56 onward. It vendors react-
            navigation internally and re-exports ThemeProvider/DarkTheme/
            DefaultTheme itself, which is the sanctioned path used below.

          `bg-background` is the Uniwind utility backed by HeroUI's
          `--color-background` token, so this follows the theme rather than
          hard-coding a colour.
        */}
        <View className="flex-1 bg-background">
          {/*
            The navigator sets its screen background as an INLINE style from its
            own theme - #f2f2f2 by default - so it sat on top of everything and
            `contentStyle` never reached it. Giving it the dark theme is what
            actually fixes the unreadable white-on-light text.
          */}
          <NavigationTheme scheme={colorScheme}>
            <QueryClientProvider client={queryClient}>
              <SessionProvider>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: 'transparent' },
                  }}
                />
              </SessionProvider>
            </QueryClientProvider>
          </NavigationTheme>
        </View>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}

/**
 * react-navigation's theme, taught about the app's palette.
 *
 * The navigator colours things from its OWN theme, not HeroUI's - the active
 * tab's tint and its highlight both come from `colors.primary`, which is a stock
 * blue. Left alone, the sidebar highlighted in blue while every other accent on
 * screen was green, and no amount of styling on our side reached it.
 *
 * Nested inside HeroUINativeProvider because useThemeColor needs that context,
 * so this cannot live in the component above.
 */
function NavigationTheme({
  scheme,
  children,
}: {
  scheme: ReturnType<typeof useColorScheme>;
  children: React.ReactNode;
}) {
  const accent = useThemeColor('accent');
  const background = useThemeColor('background');
  const foreground = useThemeColor('foreground');
  const surface = useThemeColor('surface');
  const border = useThemeColor('border');

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  const theme = useMemo(
    () => ({
      ...base,
      colors: {
        ...base.colors,
        primary: accent,
        background,
        text: foreground,
        // `card` is what the tab bar and headers paint themselves with.
        card: surface,
        border,
      },
    }),
    [base, accent, background, foreground, surface, border],
  );

  return <ThemeProvider value={theme}>{children}</ThemeProvider>;
}
