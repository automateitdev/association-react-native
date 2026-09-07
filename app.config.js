/**
 * app.json, with the two values a build has to change.
 *
 * WHY THIS FILE EXISTS. `extra.apiUrl` was hard-coded to `http://localhost:8000`
 * in app.json, which is right on a developer's machine and useless anywhere
 * else: a web build for the test server has to point at the test server, and
 * nothing about a build is allowed to depend on somebody remembering to edit a
 * tracked file first - that edit gets committed by accident, and then a
 * developer's next `npm start` talks to the test server's database.
 *
 * Expo reads app.json first and hands it here as `config`, so the file stays
 * the single source of everything else and this only overrides what CI sets.
 *
 * DEFAULTS ARE THE LOCAL ONES. Building with neither variable set gives exactly
 * what app.json says, which is what a developer expects.
 */
module.exports = ({ config }) => {
  const suffix =
    process.env.BCS_TENANT_HOST_SUFFIX ||
    config.extra?.tenantHostSuffix ||
    undefined;

  // The app.json value is dropped, not spread back in: it is the null this
  // exists to keep out of the built config.
  const { tenantHostSuffix: _ignored, ...extra } = config.extra ?? {};

  return {
    ...config,
    extra: {
      ...extra,

      // Where the API lives. Set by CI for the test build; localhost otherwise.
      apiUrl: process.env.BCS_API_URL ?? config.extra?.apiUrl,

      /*
       * The host suffix that names an association: `demo-one.bcs.example.org`
       * resolves to the slug `demo-one` without anybody typing it (see
       * features/auth/discovery.ts). Absent means "ask", which is correct
       * everywhere it has not been deliberately set.
       *
       * OMITTED WHEN UNSET, not written as null. Expo serialises a null in
       * `extra` as `{}`, and discovery.ts reads that value as a string - `{}` is
       * truthy, so the guard that should skip host discovery entirely instead
       * falls through to comparing hostnames against ".[object Object]". It
       * happens to return the same answer today, for the wrong reason, and would
       * stop doing so the moment anyone touched that condition.
       */
      ...(suffix === undefined ? {} : { tenantHostSuffix: suffix }),
    },
  };
};
