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
  settings: 'manage_accounts',

  // Member surface
  dues: 'account_balance_wallet',
  pay: 'payments',
  history: 'history',
  profile: 'person',

  // Actions
  add: 'add',
  edit: 'edit',
  back: 'arrow_back',
  forward: 'arrow_forward',
  sortUp: 'arrow_upward',
  sortDown: 'arrow_downward',
  calendar: 'calendar_month',
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
  chevronDown: 'expand_more',
  chevronUp: 'expand_less',

  // Export formats
  table: 'table_view',
  print: 'print',

  // Theme control
  light: 'light_mode',
  dark: 'dark_mode',
  auto: 'brightness_auto',
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
  tone?: 'default' | 'muted' | 'danger' | 'accent' | 'inverse' | 'success';
  /** An explicit colour, for cases where the tone presets do not fit. */
  color?: string;
}) {
  // Hooks cannot be conditional, so every tone colour is resolved.
  const muted = useThemeColor('muted');
  const danger = useThemeColor('danger');
  const success = useThemeColor('success');
  const accent = useThemeColor('accent');
  const foreground = useThemeColor('foreground');
  const inverse = useThemeColor('accent-foreground');

  const resolved =
    color ??
    (tone === 'muted'
      ? muted
      : tone === 'danger'
        ? danger
        : tone === 'success'
          ? success
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
      /*
       * Hidden from assistive technology, on every platform.
       *
       * This is a LIGATURE font: the element's text content is literally
       * "account_balance". Without hiding it a screen reader reads that out -
       * verified on web, where every icon in the app bar announced its ligature
       * name as a word.
       *
       * `aria-hidden` is the web one and is what was missing;
       * accessibilityElementsHidden and importantForAccessibility are the iOS
       * and Android equivalents, and React Native Web does not map either of
       * them to aria-hidden. All three are needed to cover all three platforms.
       *
       * Nothing is lost: an icon here always sits beside a label, or inside a
       * control that carries its own accessibilityLabel.
       */
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {ICONS[name]}
    </RNText>
  );
}
