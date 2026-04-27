import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { getInvoicePeriod, matchExpensesToInvoice } from '@/lib/invoiceHelpers';
import { buildMaterializedRecurringSignature, buildMonthRecurringSignature, buildRecurringExceptionSignature, buildRecurringLooseSignature, buildRecurringSignature, hideMaterializedRecurringTemplates, shouldProjectRecurringInMonth } from '@/lib/recurringProjection';
import type { CreditCard as CreditCardType } from '@/lib/invoiceHelpers';
import type { Expense } from '@/components/ExpenseTable';

const EXPENSE_COLS = 'id, description, value, date, type, final_category, category_ai, credit_card_id, wallet_id, destination_wallet_id, is_paid, is_recurring, frequency, installments, installment_group_id, installment_info, invoice_month, payment_method, notes, tags, project_id, debt_id, created_at';

export interface ProjectedTotals {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  startingBalance: number;
  pendingInStartingBalance: number;
  projectedBalance: number;
  largestCategory: { name: string; total: number; categoryKey: string } | null;
  loading: boolean;
  refetch: () => void;
  monthExpenses: Expense[];
  invoiceExpenses: Expense[];
  creditCards: CreditCardType[];
  wallets: { id: string; name: string; initial_balance: number }[];
}

async function fetchProjectedData(userId: string, startDate: string, endDate: string) {
  const [
    { data: expData },
    { data: recurringData },
    { data: ccExpData },
    { data: invoicePaymentsData },
    { data: historicalData },
    { data: cardsData },
    { data: walletsData },
    { data: exceptionsData },
  ] = await Promise.all([
    supabase.from('expenses').select(EXPENSE_COLS).eq('user_id', userId)
      .gte('date', startDate).lt('date', endDate).order('date', { ascending: false }),
    supabase.from('expenses').select(EXPENSE_COLS).eq('user_id', userId)
      .eq('is_recurring', true).lt('date', endDate),
    supabase.from('expenses').select(EXPENSE_COLS).eq('user_id', userId)
      .not('credit_card_id', 'is', null),
    // Also fetch invoice payment records (no credit_card_id but have invoice_month and start with "Pagamento fatura")
    supabase.from('expenses').select(EXPENSE_COLS).eq('user_id', userId)
      .is('credit_card_id', null).not('invoice_month', 'is', null).like('description', 'Pagamento fatura%'),
    supabase.from('expenses').select('id, description, date, value, type, credit_card_id, is_paid, final_category')
      .eq('user_id', userId).lt('date', startDate).is('credit_card_id', null),
    supabase.from('credit_cards').select('*').eq('user_id', userId),
    supabase.from('wallets').select('id, name, initial_balance').eq('user_id', userId).order('name'),
    (supabase.from as any)('recurring_exceptions').select('template_id, occurrence_date').eq('user_id', userId),
  ]);

  // Merge CC expenses + invoice payment records (deduped)
  const ccExps = (ccExpData || []) as Expense[];
  const paymentExps = (invoicePaymentsData || []) as Expense[];
  const ccIds = new Set(ccExps.map(e => e.id));
  const mergedInvoiceExpenses = [...ccExps, ...paymentExps.filter(p => !ccIds.has(p.id))];

  return {
    monthExpenses: (expData || []) as Expense[],
    recurringExpenses: (recurringData || []) as Expense[],
    invoiceExpenses: mergedInvoiceExpenses,
    historicalExpenses: (historicalData || []) as any[],
    creditCards: (cardsData || []) as CreditCardType[],
    wallets: (walletsData || []).map((w: any) => ({ id: w.id, name: w.name, initial_balance: w.initial_balance ?? 0 })),
    recurringExceptions: ((exceptionsData as any[]) || []) as { template_id: string; occurrence_date: string }[],
  };
}

export function useProjectedTotals(): ProjectedTotals {
  const { user } = useAuth();
  const { startDate, endDate, selectedMonth, selectedYear } = useSelectedDate();
  const queryClient = useQueryClient();

  const queryKey = ['projected-totals', user?.id, startDate, endDate];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchProjectedData(user!.id, startDate, endDate),
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });

  const monthExpenses = data?.monthExpenses ?? [];
  const visibleMonthExpenses = useMemo(() => hideMaterializedRecurringTemplates(monthExpenses), [monthExpenses]);
  const recurringExpenses = data?.recurringExpenses ?? [];
  const invoiceExpenses = data?.invoiceExpenses ?? [];
  const historicalExpenses = data?.historicalExpenses ?? [];
  const creditCards = data?.creditCards ?? [];
  const wallets = data?.wallets ?? [];
  const recurringExceptions = data?.recurringExceptions ?? [];
  const exceptionSet = useMemo(
    () => new Set(recurringExceptions.map(e => buildRecurringExceptionSignature(e.template_id, e.occurrence_date))),
    [recurringExceptions]
  );

  // Virtual recurring
  const effectiveMonthExpenses = useMemo(() => {
    // Build two sets: exact signature (type|desc|value) and loose signature (type|desc)
    // A real entry suppresses a recurring template if EITHER matches.
    // This prevents duplication when user changes value during "mark as paid".
    const realSignatures = new Set(
      visibleMonthExpenses.map(e => buildRecurringSignature(e.type, e.value, e.description))
    );
    const realLooseSignatures = new Set(visibleMonthExpenses.map(e => buildRecurringLooseSignature(e.type, e.description)));
    const materializedRecurringSignatures = new Set(
      visibleMonthExpenses
        .filter(e => !e.is_recurring)
        .map(e => buildMaterializedRecurringSignature(e))
    );
    const realIds = new Set(visibleMonthExpenses.map(e => e.id));
    const virtualEntries: Expense[] = [];

    recurringExpenses.forEach(r => {
      if (realIds.has(r.id)) return;
      // Respect frequency + don't backfill into months before the template start
      if (!shouldProjectRecurringInMonth(r.date, selectedYear, selectedMonth, r.frequency)) return;
      const sig = buildRecurringSignature(r.type, r.value, r.description);
      const looseSig = buildRecurringLooseSignature(r.type, r.description);
      if (
        realSignatures.has(sig) ||
        realLooseSignatures.has(looseSig) ||
        materializedRecurringSignatures.has(buildMaterializedRecurringSignature(r))
      ) return;
      if (r.type === 'transfer' || r.credit_card_id) return;
      const occurrenceDate = (() => {
        const origDay = new Date(r.date + 'T12:00:00').getDate();
        const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const day = Math.min(origDay, daysInMonth);
        return `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      })();
      // Skip if user explicitly excluded this single occurrence
      if (exceptionSet.has(buildRecurringExceptionSignature(r.id, occurrenceDate))) return;
      virtualEntries.push({
        ...r,
        date: occurrenceDate,
        is_paid: false,
      });
    });

    return [...visibleMonthExpenses, ...virtualEntries];
  }, [visibleMonthExpenses, recurringExpenses, selectedMonth, selectedYear, exceptionSet]);

  // Starting balance
  const { startingBalance, pendingInStartingBalance } = useMemo(() => {
    const walletSum = wallets.reduce((s, w) => s + w.initial_balance, 0);

    const nonTransfers = historicalExpenses.filter((e: any) => e.type !== 'transfer');
    const historicalIncome = nonTransfers.filter((e: any) => e.type === 'income').reduce((s: number, e: any) => s + e.value, 0);
    // Exclude "Pagamento fatura" — invoice impact is already captured by ccInvoiceTotal
    const historicalDebit = nonTransfers.filter((e: any) => e.type !== 'income' && !e.description?.startsWith('Pagamento fatura')).reduce((s: number, e: any) => s + e.value, 0);

    const pendingExpenses = nonTransfers.filter((e: any) => e.type !== 'income' && !e.is_paid);
    const pendingIncome = nonTransfers.filter((e: any) => e.type === 'income' && !e.is_paid);
    const pendingAmount = pendingExpenses.reduce((s: number, e: any) => s + e.value, 0)
      - pendingIncome.reduce((s: number, e: any) => s + e.value, 0);

    let virtualRecurringBalance = 0;
    const realByMonthSig = new Set<string>();
    const realByMonthLoose = new Set<string>();
    const addSigs = (e: any) => {
      if (e.type === 'transfer') return;
      const ym = e.date ? e.date.substring(0, 7) : '';
      if (ym) {
        realByMonthSig.add(buildMonthRecurringSignature(ym, e.type, e.value, e.description));
        realByMonthLoose.add(`${ym}|${buildRecurringLooseSignature(e.type, e.description)}`);
      }
    };
    historicalExpenses.forEach(addSigs);
    visibleMonthExpenses.forEach(addSigs);

    const selectedMonthStart = selectedYear * 12 + selectedMonth;

    recurringExpenses.forEach(r => {
      if (r.type === 'transfer' || r.credit_card_id) return;
      const rDate = new Date(r.date + 'T12:00:00');
      const rStartMonth = rDate.getFullYear() * 12 + rDate.getMonth();
      const origDay = rDate.getDate();
      for (let m = rStartMonth; m < selectedMonthStart; m++) {
        const yr = Math.floor(m / 12);
        const mo = m % 12;
        // Respect frequency (yearly only matches its own month)
        if (!shouldProjectRecurringInMonth(r.date, yr, mo, r.frequency)) continue;
        const monthKey = `${yr}-${String(mo + 1).padStart(2, '0')}`;
        const sig = buildMonthRecurringSignature(monthKey, r.type, r.value, r.description);
        const looseSig = `${monthKey}|${buildRecurringLooseSignature(r.type, r.description)}`;
        if (realByMonthSig.has(sig) || realByMonthLoose.has(looseSig)) continue;
        const daysInMonth = new Date(yr, mo + 1, 0).getDate();
        const occDate = `${monthKey}-${String(Math.min(origDay, daysInMonth)).padStart(2, '0')}`;
        if (exceptionSet.has(buildRecurringExceptionSignature(r.id, occDate))) continue;
        if (r.type === 'income') virtualRecurringBalance += Number(r.value);
        else virtualRecurringBalance -= Number(r.value);
      }
    });

    let ccInvoiceTotal = 0;
    if (creditCards.length > 0) {
      const ccPool = invoiceExpenses;
      const selectedDate = new Date(selectedYear, selectedMonth, 1);
      creditCards.forEach(card => {
        for (let i = 1; i <= 24; i++) {
          const dt = new Date(selectedDate);
          dt.setMonth(dt.getMonth() - i);
          const m = dt.getMonth();
          const y = dt.getFullYear();
          const period = getInvoicePeriod(card, y, m);
          const invoice = matchExpensesToInvoice(ccPool, period);
          if (invoice.total > 0) ccInvoiceTotal += invoice.total;
        }
      });
    }

    const balance = walletSum + historicalIncome - historicalDebit + virtualRecurringBalance - ccInvoiceTotal;
    return { startingBalance: balance, pendingInStartingBalance: pendingAmount };
  }, [wallets, historicalExpenses, visibleMonthExpenses, recurringExpenses, creditCards, invoiceExpenses, selectedMonth, selectedYear, exceptionSet]);

  // Invoice totals
  const invoiceTotals = useMemo(() => {
    if (creditCards.length === 0) return { total: 0, byCategory: {} as Record<string, number> };
    const ccPool = invoiceExpenses.length > 0 ? invoiceExpenses : visibleMonthExpenses;
    let total = 0;
    const byCategory: Record<string, number> = {};
    creditCards.forEach(card => {
      const period = getInvoicePeriod(card, selectedYear, selectedMonth);
      const invoice = matchExpensesToInvoice(ccPool, period);
      total += invoice.total;
      invoice.transactions.forEach(tx => {
        byCategory[tx.final_category] = (byCategory[tx.final_category] || 0) + tx.value;
      });
    });
    return { total, byCategory };
  }, [creditCards, invoiceExpenses, visibleMonthExpenses, selectedMonth, selectedYear]);

  // Compute totals
  const result = useMemo(() => {
    const nonTransfers = effectiveMonthExpenses.filter(e => e.type !== 'transfer');
    const totalIncome = nonTransfers.filter(e => e.type === 'income').reduce((s, e) => s + e.value, 0);
    // Exclude "Pagamento fatura" — invoice impact is already captured by invoiceTotals.total
    const debitExpense = nonTransfers.filter(e => e.type !== 'income' && !e.credit_card_id && !e.description?.startsWith('Pagamento fatura')).reduce((s, e) => s + e.value, 0);
    const totalExpense = debitExpense + invoiceTotals.total;

    const byCategory: Record<string, number> = { ...invoiceTotals.byCategory };
    nonTransfers
      .filter(e => e.type !== 'income' && !e.credit_card_id && !e.description.startsWith('Pagamento fatura'))
      .forEach(e => {
        byCategory[e.final_category] = (byCategory[e.final_category] || 0) + e.value;
      });
    const largest = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      projectedBalance: startingBalance + totalIncome - totalExpense,
      largestCategory: largest ? { name: largest[0], total: largest[1], categoryKey: largest[0] } : null,
    };
  }, [effectiveMonthExpenses, invoiceTotals, startingBalance]);

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  return {
    ...result,
    startingBalance,
    pendingInStartingBalance,
    loading: isLoading,
    refetch,
    monthExpenses: effectiveMonthExpenses,
    invoiceExpenses,
    creditCards,
    wallets,
  };
}
