import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { request } from '@/api/client';
import { useSession } from '@/features/auth/session';
import { Button, Field, Screen, ScreenHeader, Section, Text, space, type } from '@/ui';

/**
 * The member's own record.
 *
 * Read-only for now. Profile changes go through an approval queue on the server
 * (FR-MEM-4) rather than writing directly - a member cannot silently change the
 * membership number or mobile the association identifies them by. The edit flow
 * that submits a change REQUEST is the next piece of work here.
 */
export default function ProfileScreen() {
  const { session, tenantSlug } = useSession();

  /*
   * The association's NAME, not its slug. A member reading their own details
   * should see "Demo Association One", not "demo-one" - the slug is a routing
   * key we made up, and showing it here is the app leaking its own plumbing
   * into the one screen that is entirely about the member.
   *
   * Same lookup and cache as the sign-in screen; failure falls back to the slug
   * rather than showing an error, because the name is cosmetic here.
   */
  const association = useQuery({
    queryKey: ['tenant', 'name', tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: 60 * 60 * 1000,
    retry: false,
    queryFn: async () =>
      (
        await request<{ data: { slug: string; name: string } }>('/tenants/lookup', {
          query: { slug: String(tenantSlug) },
          skipTenant: true,
        })
      ).data,
  });
  const profile = session?.profile;

  return (
    <Screen width="reading">
      <ScreenHeader title="Your details" />

      <Section title="Membership" first>
        <Field label="Name" value={profile?.name} />
        <Field label="Membership no." value={profile?.membership_no} />
        <Field
          label="Shares held"
          value={profile?.shares != null ? String(profile.shares) : null}
        />
        <Field label="Association" value={association.data?.name ?? tenantSlug} />
      </Section>

      <Section title="Contact">
        <Field label="Mobile" value={profile?.mobile} />
        <Field label="Email" value={profile?.email} />

        <Text tone="muted" style={{ ...type.rowMeta, marginTop: space.sm }}>
          To change your details, contact your association office. Changes are reviewed before they
          take effect.
        </Text>
      </Section>

    </Screen>
  );
}
