import { Redirect } from 'expo-router';

/**
 * `/member/history` folded into the statement.
 *
 * It listed the same money the statement does, arranged by PAYMENT instead of
 * by period - so a member looking up March found the month on one tab and had
 * to cross to another for the receipt. Two tabs, one question.
 *
 * The statement absorbed both halves: the receipt now sits on the row of the
 * period it paid for, and the payments that settle no period at all - refused
 * and awaiting - have a section of their own beneath the table. Organising by
 * period would otherwise have lost them, and 154 of this association's
 * payments are refusals a member should still be able to find.
 *
 * `Redirect` rather than a screen explaining the move: there is nowhere else to
 * go and nothing to decide, so a page that makes somebody read and tap is a
 * toll booth. Same reasoning as `/member/pay` when dues and pay merged - a URL
 * somebody bookmarked deserves better than a 404.
 */
export default function HistoryRedirect() {
  return <Redirect href="/member/statement" />;
}
