import { AnchoredSelect, type SelectOption } from './AnchoredSelect';
import { Text } from './Text';
import { type } from './tokens';

export type PickerOption = SelectOption;

/**
 * A single choice from a list, with optional grouping, for a FORM.
 *
 * This used to wrap HeroUI's Select. It no longer does, and the reason is a bug
 * rather than a preference: that popover does not anchor under React Native
 * Web, so every dropdown on the fee forms opened at the corner of the window
 * instead of under its own field. Measured on an untouched form - trigger at
 * x=234, y=143, menu at x=27, y=5.
 *
 * The public shape here is unchanged - a list of options, the selected value as
 * a string, a callback with a string - so nothing that used it had to move. See
 * ui/AnchoredSelect for the mechanism, which the toolbar filters share.
 */
export function Picker({
  options,
  value,
  onChange,
  placeholder = 'Choose…',
  isDisabled = false,
}: {
  options: PickerOption[];
  /** The selected option's `value`, or null when nothing is chosen. */
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
}) {
  return (
    <AnchoredSelect
      variant="field"
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      isDisabled={isDisabled}
    />
  );
}

/** A picker with a label above it and an optional error beneath. */
export function PickerField({
  label,
  hint,
  error,
  ...picker
}: Parameters<typeof Picker>[0] & { label: string; hint?: string; error?: string }) {
  return (
    <>
      <Text style={{ ...type.rowMeta, marginBottom: 4 }}>{label}</Text>
      <Picker {...picker} />
      {error ? (
        <Text tone="danger" style={{ ...type.rowMeta, marginTop: 4 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text tone="muted" style={{ ...type.rowMeta, marginTop: 4 }}>
          {hint}
        </Text>
      ) : null}
    </>
  );
}
