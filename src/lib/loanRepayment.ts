import { LOAN_KEYS, LOAN_REPAYMENT_CONFIRMATIONS } from "../types/loanRepayment.ts";
import type { LoanKey, LoanRepaymentConfirmation, LoanRepaymentFields, LoanRepaymentRecord } from "../types/loanRepayment.ts";
import { isCalendarDate } from "./workIncome.ts";

// 房貸／增貸還款明細的純驗證（不碰 Firebase、儲存或網路）。
// 還款明細一定連結既有支出：總額必須等於該支出金額；本金、利息、手續費由使用者依銀行通知輸入，程式不推算。

export interface LoanExpenseLike {
  id: string;
  date: string;
  amount: number;
  category: string;
  note?: string;
  isPrivate?: boolean;
}

export interface LoanRepaymentDraft {
  loanKey: string;
  dueDate: string;
  paidDate: string;
  principal: string;
  interest: string;
  fee: string;
  confirmation: string;
}

export type LoanRepaymentError =
  | "INVALID_LOAN"
  | "INVALID_DUE_DATE"
  | "INVALID_PAID_DATE"
  | "DATES_TOO_FAR_APART"
  | "INVALID_PRINCIPAL"
  | "INVALID_INTEREST"
  | "INVALID_FEE"
  | "NOTHING_REPAID"
  | "SPLIT_NOT_EQUAL_TOTAL"
  | "INVALID_EXPENSE_AMOUNT"
  | "INVALID_CONFIRMATION"
  | "NO_CHANGES";

export type LoanRepaymentResult = { ok: true; value: LoanRepaymentFields } | { ok: false; code: LoanRepaymentError };

export const LOAN_REPAYMENT_MESSAGES: Record<LoanRepaymentError, string> = {
  INVALID_LOAN: "請選擇原房貸或房屋增貸。",
  INVALID_DUE_DATE: "請輸入正確的應繳日。",
  INVALID_PAID_DATE: "請輸入正確的實際扣款日。",
  DATES_TOO_FAR_APART: "實際扣款日與應繳日相差超過 62 天，請確認日期。",
  INVALID_PRINCIPAL: "本金必須是 0 或正整數（新台幣元）。",
  INVALID_INTEREST: "利息必須是 0 或正整數（新台幣元）。",
  INVALID_FEE: "手續費必須是 0 或正整數（新台幣元）。",
  NOTHING_REPAID: "本金與利息不能都是 0。",
  SPLIT_NOT_EQUAL_TOTAL: "本金＋利息＋手續費必須等於這筆支出的金額。",
  INVALID_EXPENSE_AMOUNT: "這筆支出的金額不是正整數，無法建立還款明細。",
  INVALID_CONFIRMATION: "請選擇確認方式。",
  NO_CHANGES: "沒有變更。",
};

const WHOLE = /^(0|[1-9][0-9]{0,14})$/;
const MAX_DAYS_APART = 62;

/** 可能是房貸或增貸的支出（只是提示用；使用者確認後才建立明細）。 */
export function isLoanExpenseCandidate(expense: Pick<LoanExpenseLike, "category" | "note" | "isPrivate">): boolean {
  if (expense.isPrivate) return false;
  const note = expense.note ?? "";
  return note.includes("房貸") || note.includes("增貸");
}

/** 依備註建議貸款別：含「增貸」→ 房屋增貸，否則原房貸。 */
export function suggestLoanKey(note: string | undefined): LoanKey {
  return (note ?? "").includes("增貸") ? "TOP_UP_LOAN" : "ORIGINAL_MORTGAGE";
}

export function draftForExpense(expense: LoanExpenseLike, existing?: LoanRepaymentRecord | null): LoanRepaymentDraft {
  if (existing) {
    return {
      loanKey: existing.loanKey, dueDate: existing.dueDate, paidDate: existing.paidDate,
      principal: String(existing.principal), interest: String(existing.interest), fee: String(existing.fee), confirmation: existing.confirmation,
    };
  }
  // 補登／轉換：日期預設為支出日期，本金與利息留白，必須由使用者依銀行通知填寫（不推算）。
  return { loanKey: suggestLoanKey(expense.note), dueDate: expense.date, paidDate: expense.date, principal: "", interest: "", fee: "0", confirmation: "BANK_CONFIRMED" };
}

function daysApart(a: string, b: string) {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

/** 驗證草稿並產生要寫入的欄位；existing 存在時保留其狀態（作廢／還原另外處理）。 */
export function buildLoanRepayment(expense: LoanExpenseLike, draft: LoanRepaymentDraft, existing?: LoanRepaymentRecord | null): LoanRepaymentResult {
  if (!(LOAN_KEYS as readonly string[]).includes(draft.loanKey)) return { ok: false, code: "INVALID_LOAN" };
  const dueDate = draft.dueDate.trim(), paidDate = draft.paidDate.trim();
  if (!isCalendarDate(dueDate)) return { ok: false, code: "INVALID_DUE_DATE" };
  if (!isCalendarDate(paidDate)) return { ok: false, code: "INVALID_PAID_DATE" };
  if (daysApart(dueDate, paidDate) > MAX_DAYS_APART) return { ok: false, code: "DATES_TOO_FAR_APART" };
  const parts = { principal: draft.principal.trim(), interest: draft.interest.trim(), fee: draft.fee.trim() };
  if (!WHOLE.test(parts.principal)) return { ok: false, code: "INVALID_PRINCIPAL" };
  if (!WHOLE.test(parts.interest)) return { ok: false, code: "INVALID_INTEREST" };
  if (!WHOLE.test(parts.fee)) return { ok: false, code: "INVALID_FEE" };
  const principal = Number(parts.principal), interest = Number(parts.interest), fee = Number(parts.fee);
  if (principal + interest <= 0) return { ok: false, code: "NOTHING_REPAID" };
  if (!Number.isSafeInteger(expense.amount) || expense.amount <= 0) return { ok: false, code: "INVALID_EXPENSE_AMOUNT" };
  if (principal + interest + fee !== expense.amount) return { ok: false, code: "SPLIT_NOT_EQUAL_TOTAL" };
  if (!(LOAN_REPAYMENT_CONFIRMATIONS as readonly string[]).includes(draft.confirmation)) return { ok: false, code: "INVALID_CONFIRMATION" };
  const value: LoanRepaymentFields = {
    loanKey: draft.loanKey as LoanKey, dueDate, paidDate, totalAmount: expense.amount, principal, interest, fee,
    confirmation: draft.confirmation as LoanRepaymentConfirmation, status: existing?.status ?? "ACTIVE",
  };
  if (existing && (Object.keys(value) as (keyof LoanRepaymentFields)[]).every((key) => existing[key] === value[key])) return { ok: false, code: "NO_CHANGES" };
  return { ok: true, value };
}

export const LOAN_REPAYMENT_STATUS_LABELS = { ACTIVE: "已建立還款明細", VOID: "還款明細已作廢" } as const;
