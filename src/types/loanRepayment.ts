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

/**
 * 兩段式還款（家庭記帳同步第三階段）：
 * - PENDING_DEBIT（待銀行扣款）：已記帳（例如先轉入扣款帳戶），銀行尚未扣款。只有貸款別、預定扣款日與記帳金額，
 *   Portfolio Steward 只顯示，不減少本金。
 * - BANK_DEBITED（銀行已扣款）：依銀行通知填寫實際扣款日、本金、利息、手續費後，Portfolio Steward 才只扣減本金。
 * 舊文件沒有 stage 欄位，視為 BANK_DEBITED（意義不變）。
 */
export const LOAN_REPAYMENT_STAGES = ["PENDING_DEBIT", "BANK_DEBITED"] as const;
export type LoanRepaymentStage = typeof LOAN_REPAYMENT_STAGES[number];
export const LOAN_REPAYMENT_STAGE_LABELS: Record<LoanRepaymentStage, string> = { PENDING_DEBIT: "待銀行扣款", BANK_DEBITED: "銀行已扣款" };

/** 待銀行扣款：totalAmount 等於這筆支出（轉帳）金額。 */
export interface PendingRepaymentFields {
  stage: "PENDING_DEBIT";
  loanKey: LoanKey;
  dueDate: string;
  totalAmount: number;
  status: LoanRepaymentStatus;
}

/** 銀行已扣款：totalAmount = principal + interest + fee（銀行實際扣款，可與當初轉帳金額不同）。 */
export interface DebitedRepaymentFields {
  stage: "BANK_DEBITED";
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

/** 使用者可編輯的欄位（householdId、expenseId、createdBy 由程式決定，不可改）。 */
export type LoanRepaymentFields = PendingRepaymentFields | DebitedRepaymentFields;

export type LoanRepaymentRecord = LoanRepaymentFields & {
  id: string;
  householdId: string;
  expenseId: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};
