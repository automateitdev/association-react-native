/**
 * The ONLY place this app imports HeroUI Native.
 *
 * WHY THE INDIRECTION
 * -------------------
 * HeroUI Native ships ~37 React Native components against 75+ for its web
 * library, and the gaps are concentrated in dense controls - there is no table,
 * no data grid, no pagination, no date picker. Some of those will have to be
 * built by hand for the staff screens (risk R-1).
 *
 * Routing every import through here means replacing or supplementing a
 * component touches ONE directory instead of every screen that used it. It also
 * makes the dependency legible: `grep -r heroui-native src/` returning exactly
 * one file is the check that this has not eroded.
 *
 * Adapters are deliberately thin. This is a seam, not a design system.
 */

export {
  Alert,
  Avatar,
  BottomSheet,
  Button,
  Card,
  Checkbox,
  Chip,
  Dialog,
  Input,
  Label,
  Separator,
  Spinner,
  Surface,
  TextArea,
  TextField,
  Typography as Text,
} from 'heroui-native';

export { Screen } from './Screen';
export { StateView } from './StateView';
export { MoneyRow } from './MoneyRow';
