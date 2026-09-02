import { View } from 'react-native';
import { Button, Spinner, Typography as Text } from 'heroui-native';
import { ApiError, ErrorCode } from '@/api/errors';

/**
 * Loading, empty and error states in one place.
 *
 * The error half matters more than it looks. FR-APP-9 requires a clear,
 * actionable message for each failure the API can return, and the difference
 * between codes is the difference between "wait", "pay", and "call the office".
 * Scattering that across screens is how a member ends up staring at "Something
 * went wrong" when the real answer was "your membership is awaiting approval".
 *
 * The server's message is always displayed. It knows specifics the app does
 * not - which association, how many periods overdue.
 */
export function StateView({
  loading,
  error,
  empty,
  emptyTitle = 'Nothing here yet',
  emptyMessage,
  onRetry,
  children,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  onRetry?: () => void;
  children?: React.ReactNode;
}) {
  if (loading) {
    return (
      <View style={{ paddingVertical: 48, alignItems: 'center', gap: 12 }}>
        <Spinner />
        <Text>Loading…</Text>
      </View>
    );
  }

  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />;
  }

  if (empty) {
    return (
      <View style={{ paddingVertical: 48, alignItems: 'center', gap: 8 }}>
        <Text style={{ fontWeight: '600' }}>{emptyTitle}</Text>
        {emptyMessage ? <Text style={{ textAlign: 'center' }}>{emptyMessage}</Text> : null}
      </View>
    );
  }

  return <>{children}</>;
}

function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const api = error instanceof ApiError ? error : null;

  const title = api ? titleFor(api.code) : 'Something went wrong';
  const message = api?.message ?? 'Please try again.';

  // A retry button on a settled refusal is worse than none: it invites the
  // member to keep tapping at something that will never change.
  const canRetry = onRetry && (api === null || api.isRetryable);

  return (
    <View style={{ paddingVertical: 40, alignItems: 'center', gap: 12 }}>
      <Text style={{ fontWeight: '700', fontSize: 16, textAlign: 'center' }}>{title}</Text>
      <Text style={{ textAlign: 'center' }}>{message}</Text>

      {api?.details?.overdue_periods ? (
        <Text style={{ textAlign: 'center' }}>
          {String(api.details.overdue_periods)} unpaid instalment(s) on record.
        </Text>
      ) : null}

      {canRetry ? (
        <Button onPress={onRetry}>
          <Button.Label>Try again</Button.Label>
        </Button>
      ) : null}

      {api?.requestId ? (
        // Given to the office when a member calls: it leads straight to the
        // server log line for their exact request.
        <Text style={{ fontSize: 11, opacity: 0.6 }}>Reference: {api.requestId}</Text>
      ) : null}
    </View>
  );
}

/**
 * A short heading per code. The server supplies the explanation; this supplies
 * the one-line framing that tells the member which KIND of problem it is.
 */
function titleFor(code: string): string {
  switch (code) {
    case ErrorCode.MEMBER_INACTIVE:
      return 'Membership awaiting approval';
    case ErrorCode.MEMBER_SUSPENDED:
      return 'Membership suspended';
    case ErrorCode.TENANT_SUSPENDED:
      return 'Association unavailable';
    case ErrorCode.NETWORK_UNAVAILABLE:
      return 'No connection';
    case ErrorCode.INSUFFICIENT_PERMISSION:
    case ErrorCode.NOT_OWNER:
      return 'Not available to you';
    case ErrorCode.ASSIGN_ALREADY_SETTLED:
      return 'Already paid';
    case ErrorCode.ASSIGN_ALREADY_PENDING:
      return 'Payment already submitted';
    case ErrorCode.RATE_LIMITED:
      return 'Too many attempts';
    default:
      return 'Something went wrong';
  }
}
