import { router } from 'expo-router';
import { View } from 'react-native';
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
  const { session, signOut, tenantSlug } = useSession();
  const profile = session?.profile;

  return (
    <Screen>
      <ScreenHeader title="Your details" />

      <Section title="Membership" first>
        <Field label="Name" value={profile?.name} />
        <Field label="Membership no." value={profile?.membership_no} />
        <Field
          label="Shares held"
          value={profile?.shares != null ? String(profile.shares) : null}
        />
        <Field label="Association" value={tenantSlug} />
      </Section>

      <Section title="Contact">
        <Field label="Mobile" value={profile?.mobile} />
        <Field label="Email" value={profile?.email} />

        <Text tone="muted" style={{ ...type.rowMeta, marginTop: space.sm }}>
          To change your details, contact your association office. Changes are reviewed before they
          take effect.
        </Text>
      </Section>

      <View style={{ marginTop: space.xl }}>
        <Button
          variant="secondary"
          onPress={async () => {
            await signOut();
            router.replace('/');
          }}
        >
          <Button.Label>Sign out</Button.Label>
        </Button>
      </View>
    </Screen>
  );
}
