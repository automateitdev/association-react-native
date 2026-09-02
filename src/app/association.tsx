import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { request } from '@/api/client';
import { ApiError } from '@/api/errors';
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
 * Asked once and remembered. Every request afterwards carries the slug in
 * `X-Tenant`, and the API resolves the association BEFORE authenticating -
 * a token from one association means nothing at another (ADR-0002).
 *
 * The code is validated against the server before it is stored, so a typo is
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

  const trimmed = code.trim().toLowerCase();
  const error = lookup.error instanceof ApiError ? lookup.error : null;

  return (
    <Screen width="reading">
      <View style={{ gap: 8, paddingTop: 24 }}>
        <Text style={{ fontSize: 24, fontWeight: '700' }}>Find your association</Text>
        <Text>
          Enter the code your association gave you. You will only be asked for this once.
        </Text>
      </View>

      <TextField>
        <Label>Association code</Label>
        <Input
          value={code}
          onChangeText={setCode}
          placeholder="e.g. cocsol"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="go"
          onSubmitEditing={() => trimmed && lookup.mutate(trimmed)}
        />
      </TextField>

      {error ? (
        <Text style={{ color: '#b3261e' }}>{error.message}</Text>
      ) : null}

      <Button
        isDisabled={trimmed.length < 2 || lookup.isPending}
        onPress={() => lookup.mutate(trimmed)}
      >
        <Button.Label>{lookup.isPending ? 'Checking…' : 'Continue'}</Button.Label>
      </Button>

      <Text style={{ fontSize: 12, opacity: 0.7 }}>
        Do not know your code? Ask your association office.
      </Text>
    </Screen>
  );
}
