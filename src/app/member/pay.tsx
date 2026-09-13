import { Redirect } from 'expo-router';

/**
 * `/member/pay` moved here.
 *
 * This route used to be a screen of its own - the one that listed the same
 * instalments the dues screen had just listed, with checkboxes. The two were
 * merged into `/member`, so there is nothing left to show; but the URL is one
 * a member on the web build may have bookmarked, and a 404 is a poor answer to
 * "the link I saved for paying my subscription".
 *
 * `Redirect` rather than a screen saying "this has moved": there is nowhere
 * else to go and nothing to decide, so a page that makes somebody read and tap
 * is a toll booth. It REPLACES rather than pushes, so Back goes wherever they
 * came from instead of bouncing them through here again.
 *
 * The tab bar does not get an entry for this - see `href: null` in _layout.
 * Expo Router makes a tab out of every file in this directory, so without it
 * the merge would have put "pay" back in the bar as an invisible fourth tab
 * that redirects to the first.
 */
export default function PayRedirect() {
  return <Redirect href="/member" />;
}
