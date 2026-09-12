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

/**
 * EVERY BLOCK IS OPTIONAL, and which arrived is in `meta.visible`.
 *
 * Each figure is gated on the permission that owns the report behind it -
 * `members.view`, `reports.paid`, `reports.due`, `payments.view` - because a
 * dashboard figure is that report's information, smaller. Until 2026-09-12 one
 * `dashboard.view` returned all of it, which made this endpoint a way round
 * every other permission on the platform.
 *
 * The screen needs `visible` rather than inferring from absent keys: "you may
 * not see this" and "there is nothing to show" are different sentences, and a
 * client guessing between them would get it wrong the first time a figure came
 * back legitimately empty.
 */
export type DashboardBlock = 'members' | 'collections' | 'outstanding' | 'approvals';

export type MonthlyCollection = {
  /** `2026-09`, for keys and ordering. */
  month: string;
  /** `Sep`, for the axis. */
  label: string;
  /** Instalments only - fines are a different thing and are not charted with them. */
  instalments: Money;
};

export type DashboardData = {
  members?: {
    active: number;
    inactive: number;
    suspended: number;
  };
  collections?: {
    instalments: Money;
    fines: Money;
    /**
     * THE FIGURE THAT MAKES THE OTHERS MEAN SOMETHING. All-time collections
     * against all-time arrears reads as a failing association when it may be a
     * new one: the two cover different spans and are not comparable.
     */
    this_month: {
      instalments: Money;
      fines: Money;
    };
    /** Six months, oldest first, with the quiet ones present as zero. */
    by_month: MonthlyCollection[];
  };
  outstanding?: {
    instalments: Money;
    fines: Money;
  };
  payments_pending_approval?: number;
};

export type Dashboard = {
  data: DashboardData;
  meta: { visible: DashboardBlock[] };
};

export const dashboardKeys = {
  all: ['staff', 'dashboard'] as const,
};

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.all,
    queryFn: async () => await request<Dashboard>('/staff/dashboard'),

    // Staff leave this open on a desk. Approving a payment elsewhere should be
    // reflected here without a manual reload.
    staleTime: 15_000,
  });
}
