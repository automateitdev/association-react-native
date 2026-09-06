import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { request } from '@/api/client';
import { ApiError, ErrorCode } from '@/api/errors';
import { clearTenantSlug } from '@/api/storage';
import { useSession } from '@/features/auth/session';
import {
  Actions,
  Button,
  DENSE_INPUT_STYLE,
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

  /*
   * The association's real name, so this screen says whose books you are
   * signing into rather than "Cooperative Society" - which is every one of
   * them. It reads as a generic template until it names somebody.
   *
   * Failure is silent by design: not knowing the name is a cosmetic loss, and
   * an error banner about it above a working sign-in form would be noise at
   * exactly the wrong moment.
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

  const error = attempt.error instanceof ApiError ? attempt.error : null;

  return (
    <Screen width="reading" center>
      {/*
        CENTRED, AND CAPPED. The form used to run the full width of the reading
        column - 720pt inputs on a desktop - with everything pinned to the top
        left. That is not a plain design, it is an unfinished one: a page with
        two fields on it has to place them somewhere deliberate, and the top
        left corner is where things land when nobody chose.
      */}
      <View style={{ alignItems: 'center', paddingTop: space.xl }}>
        <View style={{ width: '100%', maxWidth: CARD_WIDTH, gap: space.lg }}>
          {/*
            The one screen with no AppBar, because there is no session yet to
            name an association or a user. It still needs the mark and the theme
            control: without them it looked like a different, unfinished
            application - and a member who prefers light mode should not have to
            sign in to a theme they cannot read first.
          */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View
              className="bg-accent"
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="bank" size={21} tone="inverse" />
            </View>

            <View style={{ flex: 1 }}>
              {/*
                The association's own name, once known. Falling back to the
                slug rather than to a generic label: "demo-one" at least tells
                a member which set of books this is, and "Cooperative Society"
                tells them nothing they did not already assume.
              */}
              <Text style={type.rowTitle} numberOfLines={1}>
                {association.data?.name ?? tenantSlug ?? 'Cooperative Society'}
              </Text>
              {association.data ? (
                <Text tone="muted" style={type.rowMeta}>
                  Cooperative society
                </Text>
              ) : null}
            </View>

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

          {/*
            A Panel, and this is the case it exists for: one focused surface on
            an otherwise empty page. The design system keeps it rare because
            three of them make a screen blocky - a single card that holds the
            only thing on the page is the opposite problem.
          */}
          <Panel>
            <View style={{ gap: space.xs, marginBottom: space.md }}>
              <Text style={type.title}>Sign in</Text>
              <Text tone="muted" style={type.body}>
                Use the mobile number or email registered with your association.
              </Text>
            </View>

            {/*
              FormField rather than InputField: these two inputs carry autofill
              and keyboard props (textContentType, returnKeyType,
              onSubmitEditing) that are particular to signing in. Widening
              InputField to pass every one of them through would make the common
              case worse to read, and the chrome - which is what has to match the
              rest of the app - is the same either way.
            */}
            {/*
              `dense`. 48pt is HeroUI's touch target and the right default, but
              two fields in a 380pt card read as slabs at that height - the
              control ends up wider than it is tall by a factor that makes the
              card look like a placeholder. 40 still clears a thumb.
            */}
            <Form maxWidth={null} dense>
              <FormField label="Mobile number or email" required>
                <Input
                  style={DENSE_INPUT_STYLE}
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
                  style={DENSE_INPUT_STYLE}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={() => attempt.mutate()}
                />
              </FormField>
            </Form>

            {error ? (
              <View style={{ marginTop: space.md }}>
                <SignInError error={error} />
              </View>
            ) : null}

            <View style={{ marginTop: space.lg }}>
              <Button
                isDisabled={!login.trim() || !password || attempt.isPending}
                onPress={() => attempt.mutate()}
              >
                <Button.Label>{attempt.isPending ? 'Signing in…' : 'Sign in'}</Button.Label>
              </Button>
            </View>
          </Panel>

          {/*
            Phrased as a question rather than a label. "Association: demo-one"
            states a fact nobody asked for; "Not X?" is the only reason somebody
            reads this line at all - they are in the wrong place.
          */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.xs }}>
            <Text tone="muted" style={type.rowMeta}>
              Not {association.data?.name ?? tenantSlug}?
            </Text>
            <Text
              tone="accent"
              style={type.rowMeta}
              onPress={async () => {
                await clearTenantSlug();
                router.replace('/association');
              }}
            >
              Change association
            </Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}

/** Narrow enough that a 48pt control reads as a field, not a banner. */
const CARD_WIDTH = 380;

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
    /*
      `tone="danger"` rather than a hex value. This screen hard-coded #b3261e -
      a light-theme red - so the one message a member most needs to read sat
      almost invisible against a dark background. The same mistake was fixed on
      the pay screen and left here.
    */
    <View style={{ gap: 4 }}>
      <Text tone="danger" style={{ ...type.body, fontWeight: '600' }}>
        {error.message}
      </Text>
      {guidance ? (
        <Text tone="danger" style={type.body}>
          {guidance}
        </Text>
      ) : null}
    </View>
  );
}
