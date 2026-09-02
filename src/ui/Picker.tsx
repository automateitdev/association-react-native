import { Fragment } from 'react';
import { Select } from 'heroui-native';
import { Text } from './Text';
import { type } from './tokens';

export type PickerOption = {
  value: string;
  label: string;
  /** Optional heading this option sits under. Options are grouped in order. */
  group?: string;
};

/**
 * A single choice from a list, with optional grouping.
 *
 * Wraps HeroUI's Select, which is a compound component - Trigger, Portal,
 * Overlay, Content, Item - and whose value is an option OBJECT rather than the
 * raw value. Repeating that composition at every call site would be five
 * elements of ceremony around one decision, and the object-vs-string detail is
 * exactly the kind of thing that gets half-remembered and quietly mismatched.
 *
 * The public shape here is the plain one: a list of options, the selected
 * value as a string, and a callback with a string.
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
  const selected = options.find((o) => o.value === value);

  // Groups in first-seen order, so the caller controls precedence by sorting
  // rather than by an extra prop.
  const groups: string[] = [];
  for (const option of options) {
    const key = option.group ?? '';
    if (!groups.includes(key)) groups.push(key);
  }

  return (
    <Select
      isDisabled={isDisabled}
      value={selected ? { value: selected.value, label: selected.label } : undefined}
      onValueChange={(option) => {
        // Single-select only; the array form is for multi-select, which nothing
        // here uses.
        const picked = Array.isArray(option) ? option[0] : option;
        if (picked) onChange(String(picked.value));
      }}
    >
      <Select.Trigger>
        <Select.Value placeholder={placeholder} />
        <Select.TriggerIndicator />
      </Select.Trigger>

      <Select.Portal>
        <Select.Overlay />
        <Select.Content presentation="popover" width="trigger">
          {groups.map((group) => (
            <Fragment key={group || 'ungrouped'}>
              {group ? <Select.ListLabel>{group}</Select.ListLabel> : null}

              {options
                .filter((o) => (o.group ?? '') === group)
                .map((option) => (
                  <Select.Item key={option.value} value={option.value} label={option.label} />
                ))}
            </Fragment>
          ))}
        </Select.Content>
      </Select.Portal>
    </Select>
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
