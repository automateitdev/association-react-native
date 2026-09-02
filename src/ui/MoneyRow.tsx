import { View } from 'react-native';
import { Typography as Text } from 'heroui-native';
import { formatMoney, isPositive, type Money } from '@/api/money';

/**
 * An instalment and its fine, shown apart.
 *
 * This component exists to make the platform's governing rule hard to break by
 * accident:
 *
 *     A fine is not an instalment.
 *
 * There is no prop here that takes a single merged amount. A screen that wants
 * to show what a member owes has to hand over both parts, and the total it
 * renders is the one the SERVER calculated - never a sum computed here.
 *
 * The fine row is hidden when there is no fine, so an ordinary on-time payment
 * does not carry a "Fine ৳0.00" line implying something went wrong.
 */
export function MoneyRow({
  instalment,
  fine,
  total,
  locale = 'en',
  currency = 'BDT',
  emphasis = false,
}: {
  instalment: Money;
  fine: Money;
  /**
   * Server-computed. OPTIONAL, but never derivable: when the API does not send
   * a total for this row, no total is shown. The alternative - passing one of
   * the other two, or adding them here - would print a figure that is simply
   * wrong the moment a fine exists.
   */
  total?: Money;
  locale?: string;
  currency?: string;
  emphasis?: boolean;
}) {
  const hasFine = isPositive(fine);
  const money = (value: Money) => formatMoney(value, { locale, currency });

  return (
    <View style={{ gap: 4 }}>
      <Line label="Instalment" value={money(instalment)} />

      {hasFine ? <Line label="Late fine" value={money(fine)} /> : null}

      {/* Only worth a separate line when there is a fine to add AND the server
          actually told us the total. Never computed here. */}
      {hasFine && total ? <Line label="Total" value={money(total)} bold /> : null}
    </View>
  );
}

function Line({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ fontWeight: bold ? '700' : '400' }}>{label}</Text>
      <Text style={{ fontWeight: bold ? '700' : '400', fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}
