import { Text } from './Text';
import { type } from './tokens';

/**
 * A member's status, in the words they would hear at the counter.
 *
 * `inactive` is the database value and a poor label to show anyone: it reads as
 * dormant or lapsed, when what it actually means is that someone is waiting on
 * the association to act. Staff seeing "Awaiting approval" know there is
 * something for them to do; "Inactive" suggests there is not.
 *
 * ACTIVE IS QUIET ON PURPOSE.
 * The first version drew all three states as filled pills, so a list of members
 * - most of whom are active, because that is what a healthy association looks
 * like - was a column of loud blue badges saying "normal". The eye was drawn to
 * every row equally, which is the same as being drawn to none. Only the states
 * that need someone to do something are given weight now.
 *
 * The prop type is spelled out here rather than imported from the members
 * feature so that `ui/` keeps depending on nothing but the design system.
 */
export function StatusBadge({ status }: { status: 'active' | 'inactive' | 'suspended' }) {
  if (status === 'active') {
    return (
      <Text tone="muted" style={type.rowMeta}>
        Active
      </Text>
    );
  }

  return (
    <Text
      tone={status === 'suspended' ? 'danger' : 'accent'}
      style={{ ...type.rowMeta, fontWeight: '600' }}
    >
      {status === 'suspended' ? 'Suspended' : 'Awaiting approval'}
    </Text>
  );
}
