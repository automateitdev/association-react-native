import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/client';
import type { Money } from '@/api/money';

/**
 * The staff dashboard.
 *
 * Note what the API does NOT return: any figure combining instalments and
 * fines. Collections and outstanding each come back as two separate amounts,
 * and there is no endpoint that adds them.
 *
 * That is the platform's governing rule reaching the dashboard, and it has a
 * real consequence for the screen. The obvious design for a dashboard is one
 * large number - "৳420,000 collected" - and that number cannot be produced
 * here without the app doing money arithmetic, which it must never do. So the
 * screen shows two figures where a conventional dashboard would show one. That
 * is the correct answer, not a limitation to work around: a single "collected"
 * total that silently includes fines is the exact defect (D-1) the legacy
 * reports carry.
 */

export type DashboardData = {
  members: {
    active: number;
    inactive: number;
    suspended: number;
  };
  collections: {
    instalments: Money;
    fines: Money;
  };
  outstanding: {
    instalments: Money;
    fines: Money;
  };
  payments_pending_approval: number;
};

export const dashboardKeys = {
  all: ['staff', 'dashboard'] as const,
};

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.all,
    queryFn: async () => (await request<{ data: DashboardData }>('/staff/dashboard')).data,

    // Staff leave this open on a desk. Approving a payment elsewhere should be
    // reflected here without a manual reload.
    staleTime: 15_000,
  });
}
