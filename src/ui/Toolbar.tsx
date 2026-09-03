import type { ReactNode } from 'react';
import { View } from 'react-native';
import { space } from './tokens';

/**
 * The controls that act on the table directly beneath it.
 *
 * WHY THIS EXISTS - PROXIMITY IS THE WHOLE POINT
 * ----------------------------------------------
 * The filters used to live at the top of the page: search, then status chips,
 * then a date range, then a download block, and only then the table they all
 * applied to. By the time a reader reached the rows, the controls governing
 * them were off the top of the screen, and scrolling back up to change a filter
 * meant losing sight of what it changed.
 *
 * Grouping them here and sitting them ON the table says what a page of stacked
 * sections could not: these narrow THIS. It is also the arrangement every data
 * grid uses, which is worth something on its own - staff have met it before.
 *
 * FILTERS LEFT, ACTIONS RIGHT. The left side changes what you are looking at;
 * the right side does something with it. Keeping the download away from the
 * filters stops it reading as one more way to narrow the list.
 */
export function Toolbar({ filters, actions }: { filters: ReactNode; actions?: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        // Wraps rather than compresses: on a phone the filters stack above the
        // actions, which is the right order, and nothing shrinks below its
        // legible size to avoid it.
        flexWrap: 'wrap',
        gap: space.md,
        marginBottom: space.md,

        /*
          Above the table, and this is load-bearing.

          A dropdown in this bar opens as an absolutely-positioned list that
          overlaps the rows beneath. Without a stacking context here the table
          - a later sibling - paints over it, and the menu appears with member
          names showing through the middle of it.
        */
        zIndex: 30,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: space.sm,
          // Takes the slack, so the actions stay pinned right on a wide screen
          // and fall in beneath on a narrow one.
          flex: 1,
          minWidth: 260,
        }}
      >
        {filters}
      </View>

      {actions ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>{actions}</View>
      ) : null}
    </View>
  );
}
