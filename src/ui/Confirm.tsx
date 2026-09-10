import type { ReactNode } from 'react';
import { Button } from './Button';
import { Inline } from './Layout';
import { Panel, useActionButtonStyle } from './Section';
import { Text } from './Text';
import { type as typeScale } from './tokens';

/**
 * "Are you sure?", asked in place.
 *
 * IN THE PAGE, NOT OVER IT, and that is not a stylistic preference. A modal
 * needs a portal, a stacking context above everything and a focus trap - the
 * first two of which this app has already been bitten by: see the note at the
 * top of ui/AnchoredSelect, where a menu stayed behind a button until all
 * TWENTY-ONE of its ancestors were raised. Asking in the flow costs none of
 * that and cannot be defeated by a parent.
 *
 * It also keeps what is being decided ON SCREEN. A dialog covers the row you
 * were looking at, so "suspend this member?" arrives with the member hidden
 * behind it, and the only way to check the name is to cancel.
 *
 * WHAT THIS OWNS, AND WHAT IT DOES NOT
 * ------------------------------------
 * It owns the surface, the question, the two buttons, which of them is
 * destructive, and the fact that the safe one comes first. It does NOT own what
 * you put between them: the member-status screen this was lifted from asks for
 * a reason in a TextArea and prints an extra warning when the action is
 * reinstatement, and both belong to that screen rather than here.
 *
 * `blocked` rather than `disabled` on the confirm: the caller's own reason for
 * refusing - a required note left empty - is a different thing from the button
 * being busy, and both have to be able to hold it shut at once.
 */
export function Confirm({
  question,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  destructive = false,
  pending = false,
  blocked = false,
  cancelLabel = 'Cancel',
}: {
  /** What is about to happen, as a question. "Suspend Karim Ahmed?" */
  question: string;
  /** The explanation, and anything the decision needs - a note, a date. */
  children?: ReactNode;
  /**
   * The verb, in full. "Confirm suspend", not "OK".
   *
   * A button reading OK beside one reading Cancel makes the reader re-read the
   * question to find out which is which; a button carrying its own verb can be
   * pressed without looking back up.
   */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Takes something away - suspend, reject, void. Colours the confirm red. */
  destructive?: boolean;
  /** In flight. Holds the button shut and says so on it. */
  pending?: boolean;
  /** The caller's own reason to refuse - a required note still empty. */
  blocked?: boolean;
  /** "Cancel" reads right for most of these; "Keep it" sometimes reads better. */
  cancelLabel?: string;
}) {
  const actionStyle = useActionButtonStyle();

  return (
    <Panel tone={destructive ? 'danger' : 'neutral'}>
      <Text style={typeScale.rowTitle}>{question}</Text>

      {children}

      {/*
        CANCEL FIRST, and it is the quieter of the two.

        The destructive one is not made easy to reach by accident, and the way
        out of a question nobody meant to ask is the first thing under the
        thumb.
      */}
      <Inline gap="sm">
        <Button variant="secondary" style={actionStyle} onPress={onCancel} isDisabled={pending}>
          <Button.Label>{cancelLabel}</Button.Label>
        </Button>

        <Button
          style={actionStyle}
          variant={destructive ? 'danger' : 'primary'}
          isDisabled={pending || blocked}
          onPress={onConfirm}
        >
          <Button.Label>{pending ? 'Saving…' : confirmLabel}</Button.Label>
        </Button>
      </Inline>
    </Panel>
  );
}
