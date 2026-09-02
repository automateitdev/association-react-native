import '@/global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { HeroUINativeProvider } from 'heroui-native';
import { useMemo } from 'react';
import { I18nManager } from 'react-native';
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
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </SessionProvider>
        </QueryClientProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
