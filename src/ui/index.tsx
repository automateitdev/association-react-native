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
  Button,
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

// Layout
export { Screen, ScreenHeader } from './Screen';
export { Section, Divider, Panel, Actions } from './Section';
export { Row, Field } from './Row';
export { Picker, PickerField, type PickerOption } from './Picker';
export { DataTable, Cell, NumberCell, type Column } from './DataTable';

// Content
export { Amount, AmountBreakdown } from './Amount';
export { Stat, StatGrid, Tile } from './Stat';
export { MoneyRow } from './MoneyRow';
export { StateView } from './StateView';
export { StatusBadge } from './StatusBadge';
export { Icon, ICONS, type IconName } from './Icon';
export { AppBar } from './AppBar';

// Shared measurements, for the cases a screen genuinely needs one directly.
export { space, type, font } from './tokens';
export { useIsDesktop, useContentWidth, DESKTOP_BREAKPOINT } from './breakpoint';
