import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/client';
import { useSession } from './session';

/**
 * The association's own details, for showing its NAME rather than its slug.
 *
 * The app bar was rendering `tenantSlug` - "demo-one" - which is a routing
 * identifier, not something anyone at the association calls themselves. In
 * multi-tenant software the one piece of chrome that must always be right is
 * which association you are working in, so it should say "Demo Association One".
 *
 * The lookup is a CENTRAL endpoint: it answers before any association context
 * exists, which is what makes the association picker possible at all.
 */
export type Association = {
  slug: string;
  name: string;
  locale: string;
  currency: string;
  timezone: string;
};

export function useAssociation() {
  const { tenantSlug } = useSession();

  return useQuery({
    queryKey: ['association', tenantSlug],
    enabled: Boolean(tenantSlug),
    queryFn: async () =>
      (
        await request<{ data: Association }>('/tenants/lookup', {
          query: { slug: tenantSlug! },
        })
      ).data,

    // An association's name changes about never, and this is on every screen.
    staleTime: 60 * 60_000,
  });
}
