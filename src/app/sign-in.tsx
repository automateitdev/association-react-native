import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ApiError, ErrorCode } from '@/api/errors';
import { clearTenantSlug } from '@/api/storage';
import { useSession } from '@/features/auth/session';
import {
  Actions,
  Button,
  Icon,
  Form,
  FormField,
  Input,
  Panel,
  Screen,
  Text,
  TextField,
  space,
  type,
} from '@/ui';
import { useTheme } from '@/features/theme';

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
  const { preference, cycle } = useTheme();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  const attempt = useMutation({
    mutationFn: () => signIn(login.trim(), password),
    onSuccess: () => router.replace('/'),
  });

  const error = attempt.error instanceof ApiError ? attempt.error : null;

  return (
    <Screen width="reading">
      {/*
        The one screen with no AppBar, because there is no session yet to name
        an association or a user. It still needs the mark and the theme control:
        without them it looked like a different, unfinished application - and a
        member who prefers light mode should not have to sign in to a theme they
        cannot read first.
      */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          marginBottom: space.xl,
        }}
      >
        <View
          className="bg-accent"
          style={{ width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="bank" size={17} tone="inverse" />
        </View>

        <Text style={{ ...type.rowTitle, flex: 1 }}>Cooperative Society</Text>

        <Text
          accessibilityRole="button"
          accessibilityLabel={`Theme: ${preference}. Tap to change.`}
          onPress={cycle}
        >
          <Icon
            name={preference === 'light' ? 'light' : preference === 'dark' ? 'dark' : 'auto'}
            size={18}
            tone="muted"
          />
        </Text>
      </View>

      <View style={{ gap: space.xs }}>
        <Text style={type.title}>Sign in</Text>
        <Text tone="muted" style={type.body}>
          Use the mobile number or email registered with your association.
        </Text>
      </View>

      <View style={{ marginTop: space.lg }} />

      {/*
        FormField rather than InputField: these two inputs carry autofill and
        keyboard props (textContentType, returnKeyType, onSubmitEditing) that
        are particular to signing in. Widening InputField to pass every one of
        them through would make the common case worse to read, and the chrome -
        which is what has to match the rest of the app - is the same either way.
      */}
      <Form maxWidth={null}>
        <FormField label="Mobile number or email" required>
          <Input
            value={login}
            onChangeText={setLogin}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
            textContentType="username"
          />
        </FormField>

        <FormField label="Password" required>
          <Input
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => attempt.mutate()}
          />
        </FormField>
      </Form>

      {error ? <SignInError error={error} /> : null}

      <Actions>
        <Button
          isDisabled={!login.trim() || !password || attempt.isPending}
          onPress={() => attempt.mutate()}
        >
          <Button.Label>{attempt.isPending ? 'Signing in…' : 'Sign in'}</Button.Label>
        </Button>
      </Actions>

      <View style={{ marginTop: space.xl, gap: space.xs }}>
        <Text tone="muted" style={type.rowMeta}>
          Association: {tenantSlug}
        </Text>
        <Text
          tone="accent"
          style={{ ...type.rowMeta, textDecorationLine: 'underline' }}
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
