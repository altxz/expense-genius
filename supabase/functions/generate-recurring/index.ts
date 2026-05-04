import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizeDescription(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    // Fetch all recurring expenses
    const { data: recurring, error: fetchError } = await supabase
      .from("expenses")
      .select("*")
      .eq("is_recurring", true)
      .neq("type", "transfer");

    if (fetchError) {
      console.error("Fetch error:", fetchError);
      throw fetchError;
    }

    // Fetch all recurring exceptions in one shot — used to skip occurrences the
    // user explicitly removed/edited/quick-paid.
    const { data: exceptions } = await supabase
      .from("recurring_exceptions")
      .select("template_id, occurrence_date");

    const exceptionSet = new Set(
      (exceptions ?? []).map((e: any) => `${e.template_id}|${e.occurrence_date}`),
    );

    let created = 0;
    let skipped = 0;

    for (const expense of recurring || []) {
      const freq = expense.frequency || "monthly";
      const originalDate = new Date(expense.date);

      // Determine the target day for this month
      const targetDay = originalDate.getDate();
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const adjustedDay = Math.min(targetDay, lastDayOfMonth);
      const targetDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(adjustedDay).padStart(2, "0")}`;

      // Skip if original date is in current month (it's the source)
      const origMonth = `${originalDate.getFullYear()}-${String(originalDate.getMonth() + 1).padStart(2, "0")}`;
      if (origMonth === currentMonth) {
        skipped++;
        continue;
      }

      // Check frequency
      if (freq === "monthly") {
        // OK, generate every month
      } else if (freq === "weekly") {
        if (today.getDay() !== originalDate.getDay()) {
          skipped++;
          continue;
        }
      } else if (freq === "yearly") {
        if (today.getMonth() !== originalDate.getMonth()) {
          skipped++;
          continue;
        }
      }

      // Honor explicit user exceptions (mark as paid w/ new date, delete one
      // occurrence, edit "this one only", edit "all from now on", etc.)
      const occurrenceDate = freq === "weekly" ? todayStr : targetDate;
      if (exceptionSet.has(`${expense.id}|${occurrenceDate}`)) {
        skipped++;
        continue;
      }

      // Check if already generated for this period — match by description+type
      // only (value or exact day might have changed when user paid/edited).
      const checkStart = freq === "weekly"
        ? todayStr
        : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
      const checkEnd = freq === "weekly"
        ? todayStr
        : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${lastDayOfMonth}`;

      const { data: existing } = await supabase
        .from("expenses")
        .select("id, description, type")
        .eq("user_id", expense.user_id)
        .eq("type", expense.type)
        .eq("is_recurring", false)
        .gte("date", checkStart)
        .lte("date", checkEnd);

      const normalizedTarget = normalizeDescription(expense.description);
      const alreadyMaterialized = (existing ?? []).some(
        (row: any) => normalizeDescription(row.description) === normalizedTarget,
      );

      if (alreadyMaterialized) {
        skipped++;
        continue;
      }

      // Generate the recurring entry
      const newExpense: Record<string, unknown> = {
        user_id: expense.user_id,
        description: expense.description,
        value: expense.value,
        final_category: expense.final_category,
        type: expense.type,
        date: occurrenceDate,
        is_recurring: false,
        is_paid: false,
        wallet_id: expense.wallet_id,
        credit_card_id: expense.credit_card_id,
        notes: `Gerado automaticamente (recorrente ${freq})`,
        payment_method: expense.payment_method,
      };

      if (expense.credit_card_id && expense.invoice_month) {
        newExpense.invoice_month = currentMonth;
      }

      const { error: insertError } = await supabase
        .from("expenses")
        .insert(newExpense);

      if (insertError) {
        console.error(`Insert error for ${expense.description}:`, insertError);
        continue;
      }

      created++;
    }

    console.log(`Recurring expenses processed: ${created} created, ${skipped} skipped`);

    return new Response(
      JSON.stringify({ success: true, created, skipped, date: todayStr }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-recurring error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao processar despesas recorrentes" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
