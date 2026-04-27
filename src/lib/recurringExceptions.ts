import { supabase } from '@/lib/supabase';
import { addMonths, addYears, format, parseISO } from 'date-fns';

/**
 * Deletes a single occurrence of a recurring transaction without affecting
 * the rest of the recurring series.
 *
 * Strategy:
 * 1. Always register an exception (template_id + occurrence_date) so the
 *    projection engine won't recreate that occurrence as a virtual entry.
 * 2. If the clicked row is the recurring template itself (is_recurring=true)
 *    AND its DB date matches the occurrence we want to skip, advance the
 *    template's start date to the next valid occurrence (so the template
 *    row stops appearing in this month's feed but the series continues).
 * 3. Otherwise, delete the row by id. This safely removes:
 *    - Materialized copies created by "mark as paid" (is_recurring=false)
 *    - No-ops for purely virtual entries (no DB row exists for that id+date)
 */
export async function deleteSingleRecurringOccurrence(params: {
  userId: string;
  expenseId: string;
  occurrenceDate: string; // YYYY-MM-DD shown in the feed
  isRecurring: boolean;
  frequency?: string | null;
}) {
  const { userId, expenseId, occurrenceDate, isRecurring, frequency } = params;

  // 1. Look up the template (the row stored in DB for this id), if any
  const { data: dbRow } = await supabase
    .from('expenses')
    .select('id, date, is_recurring, frequency')
    .eq('id', expenseId)
    .maybeSingle();

  // 2. Register the exception so projections skip it
  const exceptionPayload = {
    user_id: userId,
    template_id: expenseId,
    occurrence_date: occurrenceDate,
  };
  // Upsert-like behavior: ignore unique violation
  const { error: excErr } = await (supabase.from as any)('recurring_exceptions')
    .insert(exceptionPayload);
  if (excErr && !`${excErr.message}`.toLowerCase().includes('duplicate')) throw excErr;

  // 3. Decide what to do with the underlying row
  if (!dbRow) {
    // Purely virtual occurrence — exception is enough
    return;
  }

  const templateDate = (dbRow as any).date as string;
  const rowIsRecurring = !!(dbRow as any).is_recurring;
  const rowFrequency = ((dbRow as any).frequency as string | null) ?? frequency ?? 'monthly';

  if (rowIsRecurring && isRecurring && templateDate === occurrenceDate) {
    // The clicked row IS the template's own occurrence in its start month.
    // Advance the template start date so future projections still happen,
    // but this month's feed no longer shows it.
    const current = parseISO(`${templateDate}T12:00:00`);
    const next = rowFrequency === 'yearly' ? addYears(current, 1) : addMonths(current, 1);
    const nextDate = format(next, 'yyyy-MM-dd');
    const { error: updErr } = await supabase
      .from('expenses')
      .update({ date: nextDate })
      .eq('id', expenseId);
    if (updErr) throw updErr;
    return;
  }

  // Otherwise the row is a materialized copy (is_recurring=false) or a
  // recurring row that no longer represents this occurrence. Remove it.
  const { error: delErr } = await supabase.from('expenses').delete().eq('id', expenseId);
  if (delErr) throw delErr;
}
