import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { ApiError, ErrorCode, fallbackMessage } from './errors';
import { getTenantSlug, getToken } from './storage';

/**
 * The single way this app talks to the API.
 *
 * Screens never call fetch. Everything goes through here, because three things
 * must be true of EVERY request and none of them should be a screen's problem
 * to remember:
 *
 *   1. the association travels in `X-Tenant`
 *   2. the bearer token is attached
 *   3. failures arrive as ApiError with a code, never as a raw response
 *
 * See bcs-docs/05-api-contract.md.
 */

const BASE_URL: string =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  'http://10.0.2.2:8000/api/v1';

/** Timeout for a normal request. Uploads get their own, longer, budget. */
const DEFAULT_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 120_000;

/** Generating a report is real server work; 20s would abort one that was coming. */
const EXPORT_TIMEOUT_MS = 60_000;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Multipart. Sets no Content-Type: the runtime must add the boundary. */
  formData?: FormData;
  /** Required by POST /payments. See withIdempotencyKey(). */
  idempotencyKey?: string;
  query?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
  /** Central endpoints (/health, /tenants/lookup) that take no association. */
  skipTenant?: boolean;
  signal?: AbortSignal;
};

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    formData,
    idempotencyKey,
    query,
    skipTenant = false,
    signal,
  } = options;

  const timeoutMs = options.timeoutMs ?? (formData ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);

  const headers: Record<string, string> = { Accept: 'application/json' };

  if (!skipTenant) {
    const slug = await getTenantSlug();

    // Failing here rather than sending a tenant-less request keeps the error
    // honest: this is a client bug, not a server refusal.
    if (!slug) {
      throw new ApiError(
        ErrorCode.TENANT_NOT_RESOLVED,
        fallbackMessage(ErrorCode.TENANT_NOT_RESOLVED),
        0,
      );
    }

    headers['X-Tenant'] = slug;
  }

  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  // Deliberately NOT set for FormData - the runtime appends the multipart
  // boundary, and overriding it produces a request the server cannot parse.
  if (body !== undefined && !formData) headers['Content-Type'] = 'application/json';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // Honour a caller's own cancellation as well as the timeout.
  signal?.addEventListener('abort', () => controller.abort());

  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal: controller.signal,
    });
  } catch {
    // A timeout and a dead network are the same thing to a member standing in
    // a bank queue: the request did not happen, and retrying is reasonable.
    throw new ApiError(
      ErrorCode.NETWORK_UNAVAILABLE,
      fallbackMessage(ErrorCode.NETWORK_UNAVAILABLE),
      0,
    );
  } finally {
    clearTimeout(timeout);
  }

  return parse<T>(response);
}

/**
 * Fetch a file and hand it to the user to save (FR-REP-7).
 *
 * WHY THIS IS NOT A LINK
 * ----------------------
 * The obvious implementation is an anchor pointing at the export URL. It cannot
 * work: the endpoint is authenticated with a bearer token in a HEADER, and a
 * browser navigation carries no headers. The request would arrive
 * unauthenticated and be refused.
 *
 * So the file is fetched like any other request, with the same tenant header
 * and the same token, and the resulting blob is handed to the browser to save.
 *
 * The FILENAME comes from the server's Content-Disposition, which the API
 * exposes to cross-origin readers for exactly this purpose (see the backend's
 * config/cors.php). `fallbackName` covers the case where a proxy strips the
 * header - a file that saves under a dull name is a far better outcome than a
 * download that fails.
 *
 * WEB ONLY, AND SAID OUT LOUD.
 * There is no download on a device yet. Doing it properly needs expo-file-system
 * to write the bytes and expo-sharing to hand them to another app, and neither
 * is a declared dependency of this project today. Rather than ship a native path
 * that cannot be tested from here, this fails with a message that says what is
 * missing. Staff reporting is a desktop activity by design (R-3), so the gap is
 * real but not on the main path.
 */
export async function download(
  path: string,
  options: { query?: RequestOptions['query']; fallbackName: string } & Pick<
    RequestOptions,
    'signal'
  >,
): Promise<void> {
  if (Platform.OS !== 'web') {
    throw new ApiError(
      ErrorCode.UNSUPPORTED,
      'Downloading a report is only available in a web browser at the moment.',
      0,
    );
  }

  const headers: Record<string, string> = { Accept: '*/*' };

  const slug = await getTenantSlug();
  if (!slug) {
    throw new ApiError(
      ErrorCode.TENANT_NOT_RESOLVED,
      fallbackMessage(ErrorCode.TENANT_NOT_RESOLVED),
      0,
    );
  }
  headers['X-Tenant'] = slug;

  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  // Longer than a normal read: a PDF of several hundred members is real work
  // for the server, and the 20s default would abort a report that was coming.
  const timeout = setTimeout(() => controller.abort(), EXPORT_TIMEOUT_MS);
  options.signal?.addEventListener('abort', () => controller.abort());

  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}${buildQuery(options.query)}`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      ErrorCode.NETWORK_UNAVAILABLE,
      fallbackMessage(ErrorCode.NETWORK_UNAVAILABLE),
      0,
    );
  } finally {
    clearTimeout(timeout);
  }

  /*
   * A failure here is JSON, not a file - REPORT_TOO_LARGE is the one staff will
   * actually meet. Routing it through the same parser means it reaches the
   * screen as an ApiError carrying the server's own explanation, rather than
   * saving an error page to the user's Downloads folder.
   */
  if (!response.ok) {
    await parse<never>(response);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filenameFrom(response) ?? options.fallbackName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Without this the blob is held for the lifetime of the page, and a few
    // report downloads is a few megabytes that never come back.
    URL.revokeObjectURL(url);
  }
}

/** The server's chosen filename, if it survived the trip. */
function filenameFrom(response: Response): string | null {
  const disposition = response.headers.get('content-disposition');
  if (!disposition) return null;

  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return match ? match[1] : null;
}

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();

  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON at all - a proxy error page, a 502 from the edge. Treat it as a
    // server failure rather than pretending to understand it.
    if (!response.ok) {
      throw new ApiError(
        ErrorCode.UNKNOWN,
        fallbackMessage(ErrorCode.UNKNOWN),
        response.status,
      );
    }
  }

  if (response.ok) return payload as T;

  const envelope = (payload as { error?: Record<string, unknown> } | null)?.error;

  if (envelope && typeof envelope.code === 'string') {
    throw new ApiError(
      envelope.code,
      // The server's wording wins. It knows specifics the app does not.
      typeof envelope.message === 'string' && envelope.message
        ? envelope.message
        : fallbackMessage(envelope.code),
      response.status,
      envelope.details as Record<string, unknown> | undefined,
      typeof envelope.request_id === 'string' ? envelope.request_id : undefined,
    );
  }

  throw new ApiError(ErrorCode.UNKNOWN, fallbackMessage(ErrorCode.UNKNOWN), response.status);
}

function buildQuery(query?: RequestOptions['query']): string {
  if (!query) return '';

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.append(key, String(value));
  }

  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

/**
 * A stable key for one payment ATTEMPT.
 *
 * Generated once when the member taps Pay and reused for every retry of that
 * same attempt (FR-APP-2). Generating a fresh key per retry would defeat the
 * entire mechanism: the server would see each retry as a new payment, which is
 * exactly the duplicate-charge problem idempotency exists to prevent.
 */
export function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? fallbackUuid();
}

function fallbackUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
