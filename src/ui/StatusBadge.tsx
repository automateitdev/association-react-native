import { Chip } from 'heroui-native';

/**
 * A member's status, in the words they would hear at the counter.
 *
 * `inactive` is the database value and a poor label to show anyone: it reads as
 * dormant or lapsed, when what it actually means is that someone is waiting on
 * the association to act. Staff seeing "Awaiting approval" know there is
 * something for them to do; "Inactive" suggests there is not.
 *
 * The prop type is spelled out here rather than imported from the members
 * feature so that `ui/` keeps depending on nothing but the design system.
 */
export function StatusBadge({ status }: { status: 'active' | 'inactive' | 'suspended' }) {
  const label =
    status === 'active' ? 'Active' : status === 'inactive' ? 'Awaiting approval' : 'Suspended';

  return (
    <Chip variant={status === 'active' ? 'primary' : 'secondary'}>
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
}
