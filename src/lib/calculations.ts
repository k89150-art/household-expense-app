import { Expense, PrepaidSettlement } from "@/types/domain";

export function calculatePrepaidWeeklyExpense(input: {
  previousBalance: number;
  topUpAmount: number;
  currentBalance: number;
}) {
  const calculatedExpense = input.previousBalance + input.topUpAmount - input.currentBalance;
  if (calculatedExpense < 0) {
    throw new Error("本期支出不可為負數，請確認上次餘額、加值金額與本次餘額。 ");
  }
  return calculatedExpense;
}

export function summarizeMonthlyExpenses(expenses: Expense[]) {
  return expenses.reduce(
    (summary, expense) => {
      if (expense.excludeFromExpenseReport) return summary;
      summary.total += expense.amount;
      summary.byCategory[expense.category] = (summary.byCategory[expense.category] ?? 0) + expense.amount;
      summary.byTarget[expense.target] = (summary.byTarget[expense.target] ?? 0) + expense.amount;
      summary.byPayer[expense.paidBy] = (summary.byPayer[expense.paidBy] ?? 0) + expense.amount;
      return summary;
    },
    { total: 0, byCategory: {} as Record<string, number>, byTarget: {} as Record<string, number>, byPayer: {} as Record<string, number> }
  );
}

export function settlementToExpense(settlement: Omit<PrepaidSettlement, "id" | "linkedExpenseId" | "createdAt">) {
  return {
    amount: settlement.calculatedExpense,
    category: "餐飲" as const,
    scope: "personal" as const,
    target: "chris" as const,
    paymentMethod: "prepaid" as const,
    prepaidAccountId: settlement.prepaidAccountId,
    note: settlement.note ?? "本週醫院午餐",
  };
}
