/**
 * The API's error contract, mirrored on the client.
 *
 * Every failure from the API arrives in one envelope:
 *
 *   { error: { code, message, details?, request_id? } }
 *
 * TWO RULES, and they are the whole reason this file exists:
 *
 *   1. Branch on `code`. Never on `message`.
 *      Wording changes without a version bump; codes do not. A client that
 *      parses message text breaks the day someone improves the copy.
 *
 *   2. Display `message`. Never invent one.
 *      The server knows things the app does not - how many periods a member is
 *      overdue, which association is suspended. Its wording is written for the
 *      member.
 *
 * See bcs-docs/05-api-contract.md §1.4 for the authoritative catalogue.
 */

export const ErrorCode = {
  // Tenancy
  TENANT_NOT_RESOLVED: 'TENANT_NOT_RESOLVED',
  TENANT_SUSPENDED: 'TENANT_SUSPENDED',
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',

  // Authentication
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  /**
   * Deliberately distinct from MEMBER_SUSPENDED.
   *
   * "Waiting for approval" and "you owe money" are entirely different
   * situations for a member, and collapsing them into one message is what
   * sends both of them to the association office to ask which.
   */
  MEMBER_INACTIVE: 'MEMBER_INACTIVE',
  MEMBER_SUSPENDED: 'MEMBER_SUSPENDED',

  // Authorisation
  INSUFFICIENT_PERMISSION: 'INSUFFICIENT_PERMISSION',
  NOT_OWNER: 'NOT_OWNER',

  // Payments
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
  ASSIGN_ALREADY_SETTLED: 'ASSIGN_ALREADY_SETTLED',
  ASSIGN_ALREADY_PENDING: 'ASSIGN_ALREADY_PENDING',
  PAYMENT_NOT_PENDING: 'PAYMENT_NOT_PENDING',
  PAYMENT_REFUSED: 'PAYMENT_REFUSED',

  /** The gateway could not be reached at all. Transient; nothing was charged. */
  GATEWAY_UNREACHABLE: 'GATEWAY_UNREACHABLE',
  DOCUMENT_REJECTED: 'DOCUMENT_REJECTED',
  /** The gateway answered and said no. Retrying will not change its mind. */
  GATEWAY_SESSION_REFUSED: 'GATEWAY_SESSION_REFUSED',

  // Generic
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  TENANT_UNAVAILABLE: 'TENANT_UNAVAILABLE',

  /** Not from the server: the request never completed. */
  NETWORK_UNAVAILABLE: 'NETWORK_UNAVAILABLE',

  /**
   * Not from the server either: this build cannot do the thing on THIS
   * platform. Report download, which exists on web and not yet on a device.
   *
   * Distinct from a failure, and the distinction matters to whoever reads the
   * message: nothing went wrong, and retrying will not help.
   */
  UNSUPPORTED: 'UNSUPPORTED',

  /** A code this build has never heard of. See `isUnknown`. */
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCodeValue | string,
    message: string,
    readonly status: number,
    readonly details?: Record<string, unknown>,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /**
   * A code added to the API after this build shipped.
   *
   * Members update on their own schedule, so an old build stays in the field
   * for months and WILL meet codes it does not know. That must degrade to the
   * server's message, not to a crash or a blank screen.
   */
  get isUnknown(): boolean {
    return !(this.code in ErrorCode);
  }

  /** The session is over: clear credentials and send the user to sign in. */
  get requiresReauthentication(): boolean {
    return this.code === ErrorCode.TOKEN_EXPIRED;
  }

  /**
   * The member cannot use the app right now, and it is not their session's
   * fault. These need a screen explaining the situation, not a toast.
   */
  get isBlocking(): boolean {
    return (
      this.code === ErrorCode.MEMBER_INACTIVE ||
      this.code === ErrorCode.MEMBER_SUSPENDED ||
      this.code === ErrorCode.TENANT_SUSPENDED
    );
  }

  /** Worth offering a retry button for; the others are not the user's fault to fix. */
  get isRetryable(): boolean {
    /*
     * A gateway that ANSWERED and refused is not worth retrying, even though it
     * arrives as a 5xx. Its mind will not change on the second attempt - an AR
     * account it does not recognise is still unrecognised - and "try again"
     * sends a member round a loop instead of to the office. Checked before the
     * status, which would otherwise sweep it up.
     */
    if (this.code === ErrorCode.GATEWAY_SESSION_REFUSED) {
      return false;
    }

    return (
      this.code === ErrorCode.NETWORK_UNAVAILABLE ||
      this.code === ErrorCode.RATE_LIMITED ||
      this.code === ErrorCode.TENANT_UNAVAILABLE ||
      this.code === ErrorCode.GATEWAY_UNREACHABLE ||
      this.status >= 500
    );
  }
}

/**
 * Fallback copy, used ONLY when the server sent nothing usable - a network
 * failure, or a response that was not our envelope at all.
 *
 * When the server did send a message, that message wins. It knows the specifics.
 */
export function fallbackMessage(code: string): string {
  switch (code) {
    case ErrorCode.NETWORK_UNAVAILABLE:
      return 'No connection. Check your network and try again.';
    case ErrorCode.TENANT_NOT_RESOLVED:
    case ErrorCode.TENANT_NOT_FOUND:
      return 'That association could not be found.';
    case ErrorCode.TOKEN_EXPIRED:
      return 'Your session has ended. Please sign in again.';
    case ErrorCode.UNSUPPORTED:
      return 'That is not available on this device yet.';
    case ErrorCode.GATEWAY_UNREACHABLE:
      return 'We could not reach the payment gateway. Nothing has been charged.';
    case ErrorCode.GATEWAY_SESSION_REFUSED:
      return 'The payment gateway would not start this payment. Nothing has been charged.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
