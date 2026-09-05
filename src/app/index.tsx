import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { tenantFromHost, tenantFromQuery } from '@/features/auth/discovery';
import { useSession } from '@/features/auth/session';

/**
 * The launch gate.
 *
 * Three questions, in this order (see session.tsx for why the order matters):
 *   association chosen? -> signed in? -> which role?
 *
 * THE FIRST ONE IS ANSWERED WITHOUT ASKING WHEREVER IT CAN BE. A member who
 * opened a link their association sent, or who is on that association's own
 * domain, has already said which one they belong to - making them read it off
 * the link and type it back in is a step that exists only because the app was
 * not looking. See discovery.ts.
 *
 * The code screen remains for everyone else, and it is not a fallback anybody
 * should be ashamed of: it is what a member gets when they find the app in a
 * store rather than through their association.
 */
export default function Index() {
  const { isLoading, tenantSlug, session, isStaff, chooseTenant } = useSession();

  /*
   * Null while it has not been tried yet, so the redirect below waits rather
   * than sending somebody to the code screen a frame before the association
   * they came in with is applied.
   */
  const [discovered, setDiscovered] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLoading || tenantSlug) {
      setDiscovered(true);
      return;
    }

    // The link wins over the host: somebody following an invite to one
    // association from another's site meant the invite.
    const implied = tenantFromQuery() ?? tenantFromHost();

    if (!implied) {
      setDiscovered(true);
      return;
    }

    /*
     * Stored without asking the server first. The next request carries it, and
     * an association that does not exist fails there with a clear error - where
     * a lookup here would add a round trip to every cold start to guard against
     * a hostname we control.
     */
    void chooseTenant(implied).then(() => setDiscovered(true));
  }, [isLoading, tenantSlug, chooseTenant]);

  if (isLoading || discovered === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!tenantSlug) return <Redirect href="/association" />;
  if (!session) return <Redirect href="/sign-in" />;

  // Role decides the whole navigation tree. One binary, two audiences
  // (ADR-0003).
  return <Redirect href={isStaff ? '/staff' : '/member'} />;
}
