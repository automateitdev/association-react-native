import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ApiError, ErrorCode } from '@/api/errors';
import { clearTenantSlug } from '@/api/storage';
import { useSession } from '@/features/auth/session';
import { Button, Input, Label, Screen, Text, TextField } from '@/ui';

/**
 * Sign in.
 *
 * Members use their mobile number or email; staff use their email. One endpoint
 * serves both, and the response says which role signed in.
 *
 * The refusals matter as much as the success. MEMBER_INACTIVE and
 * MEMBER_SUSPENDED are separate codes precisely so this screen can say
 * something different for each - "waiting for approval" and "you owe money" are
 * different situations, and one shared message sends both members to the office
 * to ask which one they are.
 */
export default function SignInScreen() {
  const { signIn, tenantSlug } = useSession();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  const attempt = useMutation({
    mutationFn: () => signIn(login.trim(), password),
    onSuccess: () => router.replace('/'),
  });

  const error = attempt.error instanceof ApiError ? attempt.error : null;

  return (
    <Screen>
      <View style={{ gap: 8, paddingTop: 24 }}>
        <Text style={{ fontSize: 24, fontWeight: '700' }}>Sign in</Text>
        <Text>Use the mobile number or email registered with your association.</Text>
      </View>

      <TextField>
        <Label>Mobile number or email</Label>
        <Input
          value={login}
          onChangeText={setLogin}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="default"
          textContentType="username"
        />
      </TextField>

      <TextField>
        <Label>Password</Label>
        <Input
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => attempt.mutate()}
        />
      </TextField>

      {error ? <SignInError error={error} /> : null}

      <Button
        isDisabled={!login.trim() || !password || attempt.isPending}
        onPress={() => attempt.mutate()}
      >
        <Button.Label>
          {attempt.isPending ? 'Signing in…' : 'Sign in'}
        </Button.Label>
      </Button>

      <View style={{ marginTop: 8, gap: 4 }}>
        <Text style={{ fontSize: 12, opacity: 0.7 }}>Association: {tenantSlug}</Text>
        <Text
          style={{ fontSize: 12, textDecorationLine: 'underline' }}
          onPress={async () => {
            await clearTenantSlug();
            router.replace('/association');
          }}
        >
          Change association
        </Text>
      </View>
    </Screen>
  );
}

/**
 * One screen, several genuinely different answers.
 */
function SignInError({ error }: { error: ApiError }) {
  const guidance = (() => {
    switch (error.code) {
      case ErrorCode.MEMBER_INACTIVE:
        // Nothing to retry. Their registration is with the office.
        return 'Your association will activate your membership once your registration is approved.';

      case ErrorCode.MEMBER_SUSPENDED: {
        const overdue = error.details?.overdue_periods;
        return overdue
          ? `You have ${String(overdue)} unpaid instalment(s). Contact your association office to be reinstated.`
          : 'Contact your association office to be reinstated.';
      }

      case ErrorCode.TENANT_SUSPENDED:
        return 'This association cannot be reached at the moment. Contact your office.';

      case ErrorCode.RATE_LIMITED:
        return 'Too many attempts. Wait a moment before trying again.';

      case ErrorCode.INVALID_CREDENTIALS:
        // Deliberately does not say which of the two was wrong.
        return null;

      default:
        return null;
    }
  })();

  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: '#b3261e', fontWeight: '600' }}>{error.message}</Text>
      {guidance ? <Text style={{ color: '#b3261e' }}>{guidance}</Text> : null}
    </View>
  );
}
