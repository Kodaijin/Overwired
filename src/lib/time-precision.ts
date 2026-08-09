import { isSameMinute, startOfMinute } from "date-fns";

/**
 * Whether one instant falls in a strictly earlier minute than another.
 *
 * Every time in this app that a person can type comes from a `datetime-local`
 * field, so a minute is the finest thing they can say. Comparing a typed
 * "14:20" against a stored 14:20:44 as if it meant 14:20:00.000 produces
 * nonsense refusals - "that reading is before the episode started" about a
 * reading typed for the very minute the episode started. Boundary checks
 * therefore compare whole minutes.
 *
 * The cost is that a reading can sit up to 59 seconds outside its episode's
 * window, which moves a duration by less than a minute. Refusing the entry
 * outright is the worse trade for someone recording pain.
 */
export function isEarlierMinute(earlier: Date, later: Date): boolean {
  return startOfMinute(earlier).getTime() < startOfMinute(later).getTime();
}

/**
 * Reconciles a time typed into a form with the one already on record.
 *
 * `datetime-local` inputs carry whole minutes. A stored instant recorded as
 * "now" has seconds and milliseconds, none of which the field can show or send
 * back — so re-submitting an *untouched* edit form posts a time up to 59.999
 * seconds earlier than the one on record.
 *
 * That is enough to break a save. An episode ended at 21:20:51.903 has its
 * closing reading at exactly that instant; the form posts 21:20:00.000, which
 * would leave the reading after the episode's own end, and the save is refused.
 *
 * So: a submitted time falling in the same minute as the stored one is treated
 * as untouched and the stored value is kept, at full precision. The form cannot
 * express a change smaller than a minute, so nothing the user could have meant
 * is lost — and unlike a tolerance in the window checks, no reading is ever
 * left sitting outside the episode it belongs to.
 */
export function preserveStoredTime(submitted: Date, stored: Date | null): Date;
export function preserveStoredTime(
  submitted: Date | null,
  stored: Date | null,
): Date | null;
export function preserveStoredTime(
  submitted: Date | null,
  stored: Date | null,
): Date | null {
  if (submitted == null || stored == null) return submitted;
  return isSameMinute(submitted, stored) ? stored : submitted;
}
