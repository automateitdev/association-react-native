import { createContext, useContext, useEffect, useRef } from 'react';
import type { View } from 'react-native';
import { space } from './tokens';

/**
 * How a panel that has just opened gets itself back on screen.
 *
 * THE BUG THIS FIXES
 * ------------------
 * Measured on the fee-assign screen in a 586x415 window: pressing Months put
 * the trigger at y=346 and its twelve options from y=392 down to y=776 - the
 * window ends at 366, where a bottom tab bar takes over. The control appeared
 * to open into nothing. Every form dropdown and every date field in the app has
 * the same shape, so it was never about the months.
 *
 * WHY NOT FLIP THE MENU ABOVE THE TRIGGER, WHICH IS THE USUAL ANSWER
 * -----------------------------------------------------------------
 * Because these menus are IN THE FLOW rather than overlaid - see the long note
 * at the top of ui/AnchoredSelect for why they have to be. An in-flow panel
 * rendered above its trigger pushes the trigger DOWN by its own height, so
 * "flipping up" a 270pt menu moves the thing you just pressed 270pt further
 * down the page: the control runs away from the finger that opened it, and on
 * a short window it lands off the bottom edge anyway. Flipping is an answer for
 * absolutely positioned popovers, and only one of these two variants is.
 *
 * So the page scrolls instead - which is what a native picker does, and what
 * the panel needs whether it is overlaid or in the flow.
 *
 * THE PANEL IS MEASURED, NOT ASSUMED. Its height depends on how many options it
 * has, whether it carries a search box, and whether the caller capped it; a
 * constant here would be wrong for most of them within a week.
 */
export type ScrollHost = {
  /** Move the page down by `dy` points. */
  scrollBy: (dy: number) => void;
  /** The visible box of the page, in window coordinates. */
  measureViewport: (report: (box: { top: number; bottom: number }) => void) => void;
};

const ScrollHostContext = createContext<ScrollHost | null>(null);

export const ScrollHostProvider = ScrollHostContext.Provider;

/** Breathing room between a revealed panel and the edge it was clearing. */
const margin = space.md;

/**
 * Spread the result onto a panel and it scrolls itself into view when `open`
 * turns true.
 *
 * WAITING FOR THE LAYOUT, TWO WAYS, BECAUSE ONE OF THEM STOPS.
 *
 * The panel has to have been laid out before it can be measured. `onLayout` is
 * the event that says so and is the right trigger - but under React Native Web
 * it is a ResizeObserver, and ResizeObserver callbacks are delivered with the
 * frame. So is `requestAnimationFrame`, which was tried first and measured
 * taking 2,056ms to fire. A window that is not being painted is not given
 * frames, and neither signal arrives; ui/Appear carries a timeout for exactly
 * this reason and says so on itself.
 *
 * So both, whichever comes first, through one guarded attempt. A timeout is not
 * tied to painting, and `onLayout` is the earlier and more accurate of the two
 * whenever frames are flowing.
 *
 * The guard spends itself on the first attempt that finds a laid-out panel -
 * measuring a height of zero means the layout has not happened and costs
 * nothing, and `onLayout` fires again on every resize, which a search box
 * narrowing its list does on every keystroke. Re-scrolling the page under
 * somebody who is typing would be its own bug.
 *
 * NOTHING HAPPENS OUTSIDE A SCROLLABLE PAGE. `Screen` provides the host; a
 * `scroll={false}` screen has nowhere to scroll to, and this quietly does
 * nothing rather than pretending. Same for a panel that already fits.
 */
export function useReveal(open: boolean) {
  const ref = useRef<View>(null);
  const host = useContext(ScrollHostContext);
  const spent = useRef(false);

  const attempt = () => {
    if (!open || host === null || spent.current) return;

    spent.current = true;

    ref.current?.measureInWindow((_x, y, _width, height) => {
      // Not laid out yet: give the guard back and wait for the other signal.
      if (height === 0) {
        spent.current = false;

        return;
      }

      host.measureViewport(({ top, bottom }) => {
        const hidden = y + height + margin - bottom;

        if (hidden <= 0) return;

        /*
         * Never past the panel's own top edge.
         *
         * The trigger sits immediately above it, so stopping here keeps the
         * control the panel belongs to on screen as well - a menu that has
         * scrolled its own field out of the window has answered one question by
         * raising another. When the panel is taller than the window this clamp
         * binds and the field does go, which is the right trade: the options
         * are what the press asked for.
         */
        const room = Math.max(0, y - margin - top);

        host.scrollBy(Math.min(hidden, room));
      });
    });
  };

  useEffect(() => {
    if (!open) {
      spent.current = false;

      return;
    }

    const timer = setTimeout(attempt, 120);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return { ref, onLayout: attempt };
}
