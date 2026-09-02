import { View } from 'react-native';
import { Text } from './Text';
import { formatMoney, isPositive, type Money } from '@/api/money';
import { space, type } from './tokens';

/**
 * A figure, sized to its job.
 *
 * The old rows printed every amount at body size in a label/value line, so a
 * ৳1,200 total looked exactly like an invoice number. On a payment row the
 * amount IS the point; it should be the first thing the eye lands on.
 *
 * Tabular numerals throughout - without them a column of amounts does not line
 * up, which is precisely where misreading a figure becomes expensive.
 */
export function Amount({
  value,
  size = 'md',
  muted = false,
}: {
  value: Money;
  size?: 'sm' | 'md' | 'lg';
  muted?: boolean;
}) {
  const style =
    size === 'lg' ? type.stat : size === 'sm' ? type.rowMeta : type.amount;

  return (
    <Text
      className={muted ? 'text-muted' : undefined}
      style={{ ...style, fontVariant: ['tabular-nums'] }}
    >
      {formatMoney(value)}
    </Text>
  );
}

/**
 * What a row is worth, with the instalment and the fine kept apart.
 *
 * THE RULE HAS NOT CHANGED, ONLY THE PRESENTATION.
 * There is still no prop that takes a merged amount, the total is still the one
 * the SERVER calculated, and the fine still disappears when there is none - so
 * an on-time instalment carries no "Fine ৳0.00" implying something went wrong.
 *
 * What changed is the shape. The old MoneyRow printed three stacked label/value
 * lines per item, which on a list of payments produced a wall of small text
 * where the important number was indistinguishable from the parts. Here the
 * server's total is the anchor and the breakdown sits beneath it, quieter -
 * still both figures, still visibly separate, still never added here.
 */
export function AmountBreakdown({
  instalment,
  fine,
  total,
  align = 'right',
}: {
  instalment: Money;
  fine: Money;
  /**
   * Server-computed. OPTIONAL and never derivable: with no total from the API,
   * no total is shown. Passing one of the other two, or adding them here, would
   * print a figure that is simply wrong the moment a fine exists.
   */
  total?: Money;
  align?: 'left' | 'right';
}) {
  const hasFine = isPositive(fine);
  const alignItems = align === 'right' ? 'flex-end' : 'flex-start';

  return (
    <View style={{ alignItems, gap: 2 }}>
      <Amount value={total && hasFine ? total : instalment} />

      {/*
        Only worth spelling out when there is a fine to separate. On an ordinary
        instalment the single figure above already says everything.
      */}
      {hasFine ? (
        <Text tone="muted" style={{ ...type.rowMeta, fontVariant: ['tabular-nums'] }}>
          {formatMoney(instalment)} + {formatMoney(fine)} fine
        </Text>
      ) : null}
    </View>
  );
}
