import { router } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '@/features/auth/session';
import { Button, Card, Screen, Separator, Text } from '@/ui';

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
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Your details</Text>

      <Card>
        <Card.Body style={{ gap: 8 }}>
          <Row label="Name" value={profile?.name} />
          <Row label="Membership no." value={profile?.membership_no} />
          <Row label="Mobile" value={profile?.mobile} />
          <Row label="Email" value={profile?.email} />
          <Separator />
          <Row label="Shares held" value={profile?.shares != null ? String(profile.shares) : null} />
          <Row label="Association" value={tenantSlug} />
        </Card.Body>
      </Card>

      <Text style={{ fontSize: 12, opacity: 0.7 }}>
        To change your details, contact your association office. Changes are reviewed before
        they take effect.
      </Text>

      <Button
        variant="secondary"
        onPress={async () => {
          await signOut();
          router.replace('/');
        }}
      >
        <Button.Label>Sign out</Button.Label>
      </Button>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ opacity: 0.7 }}>{label}</Text>
      {/* An unset field says so rather than rendering blank, which reads as a
          loading failure. */}
      <Text style={{ fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>
        {value || 'Not recorded'}
      </Text>
    </View>
  );
}
