import { AnchoredSelect, type SelectOption } from './AnchoredSelect';

export type FilterOption = SelectOption;

/**
 * A one-of-N filter, as a dropdown, sized for a toolbar.
 *
 * WHY A DROPDOWN AND NOT CHIPS
 * Four chips are four controls competing for attention to express ONE decision,
 * and only one of them can be true at a time. That is a select. It also stops
 * the toolbar growing a control every time a status is added.
 *
 * The mechanism is shared with the form pickers - see ui/AnchoredSelect, which
 * also explains why neither uses HeroUI's Select.
 */
export function FilterSelect({
  options,
  value,
  onChange,
  icon,
  width = 190,
}: {
  options: FilterOption[];
  /** Always one of the option values - a filter is never "unset". */
  value: string;
  onChange: (value: string) => void;
  icon?: SelectOption['icon'];
  width?: number;
}) {
  return (
    <AnchoredSelect
      variant="compact"
      options={options}
      value={value}
      onChange={onChange}
      icon={icon}
      width={width}
    />
  );
}
