import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { request } from '@/api/client';
import { ApiError } from '@/api/errors';
import { slugFromInput } from '@/features/auth/discovery';
import { useSession } from '@/features/auth/session';
import { Button, Input, Label, Screen, Text, TextField } from '@/ui';

type Lookup = {
  slug: string;
  name: string;
  locale: string;
  currency: string;
  timezone: string;
};

/**
 * First launch: which association?
 *
 * Asked once and remembered - and increasingly not asked at all. A member who
 * arrives on their association's own domain, or through a link it sent, is
 * pointed at the right books before this screen is ever reached (discovery.ts).
 * What is left here is the person who found the app in a store, which is a real
 * case and not a failure.
 *
 * Every request afterwards carries the slug in `X-Tenant`, and the API resolves
 * the association BEFORE authenticating - a token from one association means
 * nothing at another (ADR-0002).
 *
 * THE FIELD TAKES A LINK AS WELL AS A CODE. People paste the whole thing;
 * accepting only a bare code means the one person who did exactly what they
 * were told - copied the link their association sent - is the one who gets an
 * error.
 *
 * The result is validated against the server before it is stored, so a typo is
 * caught here rather than becoming a confusing failure on the sign-in screen.
 */
export default function AssociationScreen() {
  const { chooseTenant } = useSession();
  const [code, setCode] = useState('');

  const lookup = useMutation({
    mutationFn: async (slug: string) => {
      const response = await request<{ data: Lookup }>('/tenants/lookup', {
        query: { slug },
        // The one endpoint that must NOT send X-Tenant: it is how the tenant
        // gets chosen in the first place.
        skipTenant: true,
      });

      return response.data;
    },
    onSuccess: async (association) => {
      await chooseTenant(association.slug);
      router.replace('/sign-in');
    },
  });

  // A code, or a link with one in it. Null when it is neither yet.
  const parsed = slugFromInput(code);
  const error = lookup.error instanceof ApiError ? lookup.error : null;

  return (
    <Screen width="reading" center>
      <View style={{ gap: 8, paddingTop: 24 }}>
        <Text style={{ fontSize: 24, fontWeight: '700' }}>Find your association</Text>
        <Text>
          Paste the link your association sent, or enter its code. You will only be asked for
          this once.
        </Text>
      </View>

      <TextField>
        <Label>Association code or link</Label>
        <Input
          value={code}
          onChangeText={setCode}
          placeholder="e.g. cocsol"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="go"
          onSubmitEditing={() => parsed && lookup.mutate(parsed)}
        />
      </TextField>

      {/*
        Shown once a link has clearly been pasted, so somebody who pasted a URL
        can see which code came out of it before committing. `text-danger`
        rather than a hex value: the old error line hard-coded a light-theme red
        that sat unreadable on a dark background.
      */}
      {parsed && parsed !== code.trim().toLowerCase() ? (
        <Text tone="muted">Association code: {parsed}</Text>
      ) : null}

      {error ? <Text tone="danger">{error.message}</Text> : null}

      <Button isDisabled={! parsed || lookup.isPending} onPress={() => parsed && lookup.mutate(parsed)}>
        <Button.Label>{lookup.isPending ? 'Checking…' : 'Continue'}</Button.Label>
      </Button>

      <Text style={{ fontSize: 12, opacity: 0.7 }}>
        Do not know your code? Ask your association office.
      </Text>
    </Screen>
  );
}
