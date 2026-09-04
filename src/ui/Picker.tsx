import { AnchoredSelect, type SelectOption } from './AnchoredSelect';
import { FormField } from './Form';

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

/**
 * A picker wearing the same chrome as every other form field.
 *
 * It used to draw its own label and error with Text and rowMeta, which meant a
 * form containing both a text input and a picker showed two different label
 * typographies one above the other - HeroUI's Label for the input, rowMeta for
 * this. See ui/Form.
 */
export function PickerField({
  label,
  required,
  hint,
  error,
  ...picker
}: Parameters<typeof Picker>[0] & {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
}) {
  return (
    <FormField label={label} required={required} hint={hint} error={error}>
      <Picker {...picker} />
    </FormField>
  );
}
