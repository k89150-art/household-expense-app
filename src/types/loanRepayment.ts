/**
 * 房貸／增貸還款明細（家庭記帳同步第二階段）。
 * 文件位置：households/{householdId}/loanRepayments/{expenseId}，文件 ID 等於原支出的文件 ID，
 * 所以一筆支出最多只有一筆還款明細，不會另外新增支出，家庭支出只算一次。
 * 金額一律為新台幣整數：totalAmount = principal + interest + fee = 原支出金額。
 */
export const LOAN_KEYS = ["ORIGINAL_MORTGAGE", "TOP_UP_LOAN"] as const;
export type LoanKey = typeof LOAN_KEYS[number];

export const LOAN_REPAYMENT_STATUSES = ["ACTIVE", "VOID"] as const;
export type LoanRepaymentStatus = typeof LOAN_REPAYMENT_STATUSES[number];

export const LOAN_REPAYMENT_CONFIRMATIONS = ["BANK_CONFIRMED", "OWNER_CONFIRMED"] as const;
export type LoanRepaymentConfirmation = typeof LOAN_REPAYMENT_CONFIRMATIONS[number];

export const LOAN_KEY_LABELS: Record<LoanKey, string> = { ORIGINAL_MORTGAGE: "原房貸", TOP_UP_LOAN: "房屋增貸" };
export const LOAN_CONFIRMATION_LABELS: Record<LoanRepaymentConfirmation, string> = { BANK_CONFIRMED: "已對過銀行通知", OWNER_CONFIRMED: "自行確認" };

/** 使用者可編輯的欄位（householdId、expenseId、createdBy 由程式決定，不可改）。 */
export interface LoanRepaymentFields {
  loanKey: LoanKey;
  dueDate: string;
  paidDate: string;
  totalAmount: number;
  principal: number;
  interest: number;
  fee: number;
  confirmation: LoanRepaymentConfirmation;
  status: LoanRepaymentStatus;
}

export interface LoanRepaymentRecord extends LoanRepaymentFields {
  id: string;
  householdId: string;
  expenseId: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}
