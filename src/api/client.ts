import Constants from 'expo-constants';
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
