/**
 * The ONLY place this app imports HeroUI Native, and the app's own layout layer.
 *
 * WHY THE INDIRECTION
 * -------------------
 * HeroUI Native ships 43 React Native components against 75+ for its web
 * library, and the gaps are concentrated in dense controls - there is no table,
 * no data grid, no pagination, no date picker. Some of those have to be built by
 * hand for the staff screens (risk R-1).
 *
 * Routing every import through here means replacing or supplementing a
 * component touches ONE directory instead of every screen that used it. It also
 * makes the dependency legible: `grep -r heroui-native src/` returning only
 * files in this directory is the check that this has not eroded.
 *
 * WHAT THIS DIRECTORY IS NOW
 * --------------------------
 * More than a seam. The first screens used HeroUI's `Card` as the universal
 * container - every section a filled slab, every list item a box inside a box -
 * and the result read as blocks rather than content. `Section`, `Row`, `Amount`
 * and the tokens they share exist so that grouping is expressed with space, a
 * type scale and a hairline instead of with borders.
 *
 * `Card` is still exported, for the rare thing that genuinely is a distinct
 * object. Prefer `Section` for grouping and `Panel` for a callout; a screen
 * carrying three Cards has gone back to being blocky.
 */

export {
  Alert,
  Avatar,
  BottomSheet,
  Card,
  Checkbox,
  Chip,
  Description,
  Dialog,
  // The error slot for a form field. Distinct from Description, which is the
  // helper text - using Description for a validation message says "here is a
  // hint" in the place the user is looking for "here is what went wrong".
  FieldError,
  Input,
  Label,
  Select,
  Separator,
  Spinner,
  Surface,
  TextArea,
  TextField,
} from 'heroui-native';

// Text is OURS, not HeroUI's: Typography colours itself with a component class
// that Tailwind utilities cannot override, so tones have to be resolved from the
// theme and applied as a style. See Text.tsx.
export { Text } from './Text';

// Ours, not HeroUI's: the library's smallest button is 40pt, which is a touch
// target and too tall beside 13.5pt text on a desktop. See Button.tsx.
export { Button } from './Button';

// Layout
export { Screen, ScreenHeader } from './Screen';
export { Section, Divider, Panel, Actions, useActionButtonStyle } from './Section';
export { Row, Field } from './Row';
export { SearchField } from './SearchField';
export { Toolbar } from './Toolbar';
export { Picker, PickerField, type PickerOption } from './Picker';

// The shared form chrome. One label/hint/error implementation, so a text input
// and a dropdown in the same form cannot drift apart. See Form.tsx.
export { Form, FormField, FormActions, FormRow, InputField } from './Form';

// Ours, not HeroUI's: its Select popover does not anchor on React Native Web.
// See FilterSelect.tsx for the measurements.
export { FilterSelect, type FilterOption } from './FilterSelect';
export { AnchoredSelect, type SelectOption } from './AnchoredSelect';
export {
  DataTable,
  Cell,
  NumberCell,
  type Column,
  type SortState,
  type ServerPaging,
} from './DataTable';

// Ours, not HeroUI's: the library ships no date picker (R-1), and preset chips
// alone cannot express an arbitrary period. See Calendar.tsx.
export { Calendar, toIso, todayIso, humanDate, type IsoDate, type DateRange } from './Calendar';
export { DateField } from './DateField';

// Content
export { Amount, AmountBreakdown } from './Amount';
export { Stat, StatGrid, Tile } from './Stat';
export { MoneyRow } from './MoneyRow';
export { StateView } from './StateView';
export { StatusBadge } from './StatusBadge';
export { Icon, ICONS, type IconName } from './Icon';
export { AppBar } from './AppBar';
export { NavSurface } from './NavSurface';

// Theme colours as strings, for the third-party components that cannot take a
// className. See themeColor.ts - the conversion it does is not optional.
export { useThemeColorReader, type ThemeToken } from './themeColor';

// Shared measurements, for the cases a screen genuinely needs one directly.
export { space, type, font } from './tokens';
export { useIsDesktop, useContentWidth, DESKTOP_BREAKPOINT } from './breakpoint';
