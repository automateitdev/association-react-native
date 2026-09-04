import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/api/client';

/**
 * Per-association configuration (FR-SET-1).
 *
 * This is what makes a second association possible without a code change: the
 * fine rate, the grace period, the suspension threshold and the bank account
 * members pay into are all rows here, where the legacy system hard-codes every
 * one of them.
 *
 * THE GATEWAY IS NOT SET FROM HERE AT ALL.
 *
 * It used to be: an association's own admin could enter the merchant
 * credentials. `ar_account` is where members' money lands, so that put a
 * money-diversion vector behind `settings.edit` - a permission granted for
 * editing fine rates. And because credentials are deliberately never readable,
 * a malicious change left almost nothing to compare against afterwards.
 *
 * Setting them moved to whoever provisions the association, at the server
 * console (`php artisan tenant:gateway`). What the association keeps is what it
 * needs: `GatewaySummary` says whether a gateway is configured, whether it is
 * switched on, and the last four digits of the AR account - enough to confirm
 * WHICH account, never enough to use it. It can also turn online payment off
 * through `payment.online_enabled`, which reduces capability and cannot
 * redirect anything.
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
  /** Always 'platform' - the association cannot set this itself. */
  managed_by: string;
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
