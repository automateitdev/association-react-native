import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { slugFromInput } from '@/features/auth/discovery';
import { useSession } from '@/features/auth/session';
import { Button, Screen, ScreenHeader, Text, space, type } from '@/ui';

/**
 * `…/join/demo-one` — the link an association sends its members.
 *
 * The whole point is that nobody types a code. An association puts this link on
 * its notice board, in a WhatsApp group or on a printed form, and a member who
 * follows it lands on the sign-in screen already pointed at the right books.
 *
 * IT SWITCHES, IT DOES NOT MERGE. Following a link for a different association
 * than the one already stored replaces it, and `chooseTenant` clears the query
 * cache as it does — the cache is keyed by path, not by association, so without
 * that the previous association's figures would render under the new one's
 * name.
 *
 * WHICH IS WHY IT ASKS FIRST when there is something to lose. Silently moving a
 * signed-in member to another association because they tapped a forwarded link
 * would sign them out of their own and look like the app breaking. A member
 * arriving cold — the overwhelmingly common case — sees no prompt at all.
 *
 * ON LINK SECURITY: this must be reached through a VERIFIED https link (Android
 * App Links, iOS Universal Links) before it is advertised. A custom
 * `bcsapprn://` scheme is not exclusive — another app can register it, catch
 * the link, and show a convincing fake sign-in. See discovery.ts.
 */
export default function JoinScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { tenantSlug, session, chooseTenant } = useSession();

  const target = slugFromInput(String(slug ?? ''));

  const [applied, setApplied] = useState(false);

  // Nothing to lose: no association yet, or the same one. Apply it silently.
  const switchesAway = Boolean(tenantSlug && target && tenantSlug !== target);
  const shouldPrompt = switchesAway && Boolean(session);

  useEffect(() => {
    if (!target || applied || shouldPrompt) {
      return;
    }

    if (tenantSlug === target) {
      setApplied(true);
      return;
    }

    void chooseTenant(target).then(() => setApplied(true));
  }, [target, tenantSlug, applied, shouldPrompt, chooseTenant]);

  if (!target) {
    return (
      <Screen width="reading">
        <ScreenHeader title="That link does not look right" />
        <Text style={type.body}>
          The association code in the link is not one this app recognises. Ask your association
          for the link again, or enter the code by hand.
        </Text>
        <View style={{ marginTop: space.lg }}>
          <Button onPress={() => setApplied(true)}>
            <Button.Label>Enter it by hand</Button.Label>
          </Button>
        </View>
      </Screen>
    );
  }

  if (shouldPrompt) {
    return (
      <Screen width="reading">
        <ScreenHeader title="Switch association?" />
        <Text style={type.body}>
          {/*
            Named on both sides. "Switch association?" alone asks somebody to
            agree to something without telling them what they are leaving.
          */}
          This link is for <Text style={type.rowTitle}>{target}</Text>. You are signed in to{' '}
          <Text style={type.rowTitle}>{tenantSlug}</Text>, and switching will sign you out of it.
        </Text>

        <View style={{ marginTop: space.lg, gap: space.sm }}>
          <Button onPress={() => void chooseTenant(target).then(() => setApplied(true))}>
            <Button.Label>Switch to {target}</Button.Label>
          </Button>
        </View>
      </Screen>
    );
  }

  if (!applied) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  // Back through the launch gate, which decides sign-in versus role.
  return <Redirect href="/" />;
}
