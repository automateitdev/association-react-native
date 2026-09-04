import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/api/client';

/**
 * Per-association configuration (FR-SET-1).
 *
 * This is the screen that makes a second association possible without a code
 * change: the fine rate, the grace period, the suspension threshold, the bank
 * account members pay into and the gateway credentials are all rows here, where
 * the legacy system hard-codes every one of them.
 *
 * GATEWAY CREDENTIALS ARE WRITE-ONLY.
 *
 * The API never returns them - not to anybody, including the superadmin who
 * entered them. `GatewaySummary` is all that comes back: whether a gateway is
 * configured, whether it is switched on, and the last four digits of the AR
 * account so somebody can confirm WHICH account is set without being handed
 * anything they could use.
 *
 * So the form cannot be pre-filled, and rotating a credential means typing the
 * whole set again. That is not an oversight to work around - an API able to
 * display a merchant password turns one stolen staff token into a compromised
 * merchant account.
 */

/** Money arrives as a string and is only ever displayed (FR-MON-4). */
export type Money = string;

export type Settings = {
  fine: {
    rate: Money;
    grace_days: number;
    suspension_threshold: number;
  };
  invoice: {
    format: string;
  };
  payment: {
    intent_ttl_minutes: number;
    online_enabled: boolean;
  };
  bank: {
    account_name: string | null;
    account_number: string | null;
    bank_name: string | null;
    branch: string | null;
    routing_number: string | null;
    instructions: string | null;
  };
  gateway: GatewaySummary;
};

export type GatewaySummary = {
  provider: string;
  configured: boolean;
  is_active: boolean;
  /** Enough to confirm which account, never enough to use it. */
  ar_account_last4: string | null;
};

/**
 * What the settings form may send.
 *
 * Every group is optional and so is every field inside it: the API takes
 * `sometimes` on all of them, so a screen that saves one section must not have
 * to send the others back unchanged.
 */
export type SettingsUpdate = {
  fine?: Partial<{ rate: string; grace_days: number; suspension_threshold: number }>;
  invoice?: Partial<{ format: string }>;
  payment?: Partial<{ intent_ttl_minutes: number; online_enabled: boolean }>;
  bank?: Partial<{
    account_name: string | null;
    account_number: string | null;
    bank_name: string | null;
    branch: string | null;
    routing_number: string | null;
    instructions: string | null;
  }>;
};

export type GatewayCredentials = {
  api_base_url: string;
  redirect_base_url: string;
  username: string;
  password: string;
  ar_account: string;
  basic_auth: string;
  /** What the gateway sends US, so a real callback can be told from a guess. */
  callback_username: string;
  callback_password: string;
  is_active?: boolean;
};

export const settingsKeys = {
  all: ['staff', 'settings'] as const,
};

export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: async () => (await request<{ data: Settings }>('/staff/settings')).data,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: SettingsUpdate) =>
      (await request<{ data: Settings }>('/staff/settings', { method: 'PUT', body })).data,

    /*
      The response IS the new settings, so it is written straight into the cache
      rather than invalidated. Saving the fine rate and then watching the field
      you just typed flicker back to its old value while a refetch runs reads as
      the save having failed.
    */
    onSuccess: (data) => queryClient.setQueryData(settingsKeys.all, data),
  });
}

export function useUpdateGateway() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: GatewayCredentials) =>
      (await request<{ data: GatewaySummary }>('/staff/settings/gateway', { method: 'PUT', body }))
        .data,

    // Only the summary comes back, so the rest of the settings are left alone.
    onSuccess: (gateway) =>
      queryClient.setQueryData<Settings>(settingsKeys.all, (current) =>
        current ? { ...current, gateway } : current,
      ),
  });
}
