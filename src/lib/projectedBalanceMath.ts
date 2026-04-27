import type { Expense } from '@/components/ExpenseTable';

interface ComputeProjectedMonthResultParams {
  effectiveMonthExpenses: Expense[];
  invoiceTotal: number;
  invoiceByCategory: Record<string, number>;
  startingBalance: number;
  isCreditCardPayment: (expense: Expense) => boolean;
}

export function computeProjectedMonthResult({
  effectiveMonthExpenses,
  invoiceTotal,
  invoiceByCategory,
  startingBalance,
  isCreditCardPayment,
}: ComputeProjectedMonthResultParams) {
  const nonTransfers = effectiveMonthExpenses.filter((expense) => expense.type !== 'transfer');

  const totalIncome = nonTransfers
    .filter((expense) => expense.type === 'income')
    .reduce((sum, expense) => sum + expense.value, 0);

  const debitExpense = nonTransfers
    .filter(
      (expense) =>
        expense.type !== 'income' &&
        !expense.credit_card_id &&
        !isCreditCardPayment(expense),
    )
    .reduce((sum, expense) => sum + expense.value, 0);

  const totalExpense = debitExpense + invoiceTotal;

  const byCategory: Record<string, number> = { ...invoiceByCategory };
  nonTransfers
    .filter(
      (expense) =>
        expense.type !== 'income' &&
        !expense.credit_card_id &&
        !isCreditCardPayment(expense),
    )
    .forEach((expense) => {
      byCategory[expense.final_category] = (byCategory[expense.final_category] || 0) + expense.value;
    });

  const largest = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    projectedBalance: startingBalance + totalIncome - totalExpense,
    largestCategory: largest ? { name: largest[0], total: largest[1], categoryKey: largest[0] } : null,
  };
}