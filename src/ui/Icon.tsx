import { Text as RNText } from 'react-native';
import { useThemeColor } from 'heroui-native';

/**
 * An icon, from the Material Symbols font.
 *
 * WHY A FONT RATHER THAN SVG COMPONENTS
 * -------------------------------------
 * `@expo-google-fonts/material-symbols` is a ligature font: rendering the text
 * "payments" produces the payments glyph. That means an icon costs one Text
 * node, inherits colour and size like text does, and adds no per-icon bundle
 * weight - the whole set is one font file already being loaded.
 *
 * The alternative, `@expo/vector-icons`, is not installed and would be a second
 * icon system alongside a font this project already ships.
 *
 * NAMES ARE NOT FREE-TEXT.
 * A wrong name renders as the literal word - "membrs" would print "membrs" in
 * the sidebar rather than failing - so the names used are collected in ICONS
 * below and referenced by key. A typo is then a type error.
 */

export const ICONS = {
  // Navigation
  overview: 'dashboard',
  approvals: 'inbox',
  members: 'group',
  fees: 'receipt_long',
  reports: 'bar_chart',

  // Member surface
  dues: 'account_balance_wallet',
  pay: 'payments',
  history: 'history',
  profile: 'person',

  // Actions
  add: 'add',
  edit: 'edit',
  back: 'arrow_back',
  search: 'search',
  signOut: 'logout',
  refresh: 'refresh',
  check: 'check',
  close: 'close',

  // Status and meaning
  warning: 'warning',
  suspended: 'block',
  awaiting: 'schedule',
  active: 'check_circle',
  bank: 'account_balance',
  document: 'description',
  empty: 'inbox',
  chevron: 'chevron_right',
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  tone = 'default',
  color,
}: {
  name: IconName;
  size?: number;
  tone?: 'default' | 'muted' | 'danger' | 'accent' | 'inverse';
  /** An explicit colour, for cases where the tone presets do not fit. */
  color?: string;
}) {
  // Hooks cannot be conditional, so every tone colour is resolved.
  const muted = useThemeColor('muted');
  const danger = useThemeColor('danger');
  const accent = useThemeColor('accent');
  const foreground = useThemeColor('foreground');
  const inverse = useThemeColor('accent-foreground');

  const resolved =
    color ??
    (tone === 'muted'
      ? muted
      : tone === 'danger'
        ? danger
        : tone === 'accent'
          ? accent
          : tone === 'inverse'
            ? inverse
            : foreground);

  return (
    <RNText
      // The ligature only forms in the icon font, so this family is not
      // negotiable and deliberately not themed.
      style={{
        fontFamily: 'MaterialSymbols_400Regular',
        fontSize: size,
        lineHeight: size,
        color: resolved,
      }}
      // The glyph carries no meaning a screen reader can use; the label beside
      // it does. Announcing "dashboard" twice is worse than announcing it once.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {ICONS[name]}
    </RNText>
  );
}
