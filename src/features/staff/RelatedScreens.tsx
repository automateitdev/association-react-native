import { router } from 'expo-router';
import { useSession } from '@/features/auth/session';
import { Button, Icon, Inline, type IconName } from '@/ui';

/**
 * Where the screens NEXT TO this one live.
 *
 * WHY THIS IS NOT IN THE TOOLBAR, which is where every one of these links
 * started out. That bar has a rule, and it is written on the component: the
 * left side changes what you are looking at, the right side does something
 * with it. A link to another screen does neither. Put among the filters it
 * reads as one more way to narrow the list; put among the actions it reads as
 * one more thing you can do to the rows - and on the members screen, sitting
 * beside three file-type icons, "Certificates & ID cards" read as a fourth
 * download format.
 *
 * So the doors out of a screen sit together, above the list, in one wrapping
 * row. It is a small thing that only became obvious once two screens had
 * accumulated four of them each.
 *
 * PERMISSION PER LINK, and it is the permission of the screen BEHIND the door
 * rather than anything about this one. A door that opens onto a 403 is worse
 * than no door.
 */
export type RelatedScreen = {
  /** What the destination requires. Missing it hides the link entirely. */
  permission: string;
  icon: IconName;
  label: string;
  href: string;
};

export function RelatedScreens({ links }: { links: RelatedScreen[] }) {
  const { can } = useSession();

  const allowed = links.filter((link) => can(link.permission));

  // Nothing to show is nothing to space. An empty row still costs a gap.
  if (allowed.length === 0) return null;

  return (
    <Inline gap="sm" wrap>
      {allowed.map((link) => (
        <Button
          key={link.href}
          size="sm"
          variant="secondary"
          onPress={() => router.push(link.href as never)}
        >
          <Icon name={link.icon} size={15} tone="muted" />
          <Button.Label>{link.label}</Button.Label>
        </Button>
      ))}
    </Inline>
  );
}
