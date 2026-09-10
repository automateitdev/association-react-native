import { Pressable } from "react-native";
import { Icon } from "./Icon";
import { Inline } from "./Layout";
import { Text } from "./Text";
import { space, type } from "./tokens";

/**
 * Which page of how many, and the two ways off it.
 *
 * WHY IT LEFT ui/DataTable. The table has had this since it grew server paging;
 * the two list screens that are NOT tables - vouchers and profile updates -
 * each grew their own instead, and the two versions did not match the table or
 * each other: full-width secondary buttons reading "Previous" and "Next" with
 * the count trailing after them, against the table's pair of glyph buttons with
 * the count between. Three implementations of one control is how a product ends
 * up looking assembled rather than designed.
 *
 * GLYPHS, NOT WORDS, and the count BETWEEN them rather than after. The pair
 * reads as one control that way - "back, where I am, forward" - and it stays
 * the same width in every language, which "Previous"/"Next" does not.
 *
 * ONE-BASED, because it is shown to a person. Callers holding a zero-based
 * index convert at the boundary rather than making every reader of this file
 * remember which convention it took.
 */
export function Pager({
  page,
  pageCount,
  onGoTo,
}: {
  /** The page being shown, counting from 1. */
  page: number;
  pageCount: number;
  onGoTo: (page: number) => void;
}) {
  // Nothing to navigate. Said here rather than at each call site, because the
  // check was forgotten on one of the three screens that needed it.
  if (pageCount <= 1) return null;

  return (
    <Inline gap="sm">
      <PageButton
        icon="back"
        label="Previous page"
        disabled={page <= 1}
        onPress={() => onGoTo(page - 1)}
      />

      <Text tone="muted" style={type.rowMeta}>
        {page} / {pageCount}
      </Text>

      <PageButton
        icon="forward"
        label="Next page"
        disabled={page >= pageCount}
        onPress={() => onGoTo(page + 1)}
      />
    </Inline>
  );
}

function PageButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: "back" | "forward";
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className="border border-border rounded-md"
      style={{
        paddingHorizontal: space.sm,
        paddingVertical: space.xs,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Icon name={icon} size={15} tone={disabled ? "muted" : "default"} />
    </Pressable>
  );
}
