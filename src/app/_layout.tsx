import '@/global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { HeroUINativeProvider } from 'heroui-native';
import { useMemo } from 'react';
import { I18nManager, useColorScheme, View } from 'react-native';
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
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
          </ThemeProvider>
        </View>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
