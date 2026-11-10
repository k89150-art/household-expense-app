import { LOAN_KEYS, LOAN_REPAYMENT_CONFIRMATIONS } from "../types/loanRepayment.ts";
import type { DebitedRepaymentFields, LoanKey, LoanRepaymentConfirmation, LoanRepaymentRecord, PendingRepaymentFields } from "../types/loanRepayment.ts";
import { isCalendarDate } from "./workIncome.ts";

// 房貸／增貸還款明細的純驗證（不碰 Firebase、儲存或網路）。
// 還款明細一定連結既有支出。兩段式：先「待銀行扣款」（只記預定扣款日，金額＝這筆支出），銀行實際扣款後再「確認銀行已扣款」，
// 本金、利息、手續費由使用者依銀行通知輸入，程式不推算；實際扣款總額可以與當初轉帳金額不同，原始支出不改寫。

export interface LoanExpenseLike {
  id: string;
  date: string;
  amount: number;
  category: string;
  note?: string;
  isPrivate?: boolean;
  paymentMethod?: string;
  /** 穩定識別（固定支出範本「房貸」「房屋增貸」新增的支出才有）。 */
  loanKey?: string;
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
  | "INVALID_PLANNED_DATE"
  | "INVALID_DUE_DATE"
  | "INVALID_PAID_DATE"
  | "DATES_TOO_FAR_APART"
  | "INVALID_PRINCIPAL"
  | "INVALID_INTEREST"
  | "INVALID_FEE"
  | "NOTHING_REPAID"
  | "INVALID_EXPENSE_AMOUNT"
  | "INVALID_CONFIRMATION"
  | "NO_CHANGES";

export type LoanRepaymentResult = { ok: true; value: DebitedRepaymentFields } | { ok: false; code: LoanRepaymentError };

export const LOAN_REPAYMENT_MESSAGES: Record<LoanRepaymentError, string> = {
  INVALID_LOAN: "請選擇原房貸或房屋增貸。",
  INVALID_PLANNED_DATE: "請輸入預定扣款日（銀行通知上的應繳日）。",
  INVALID_DUE_DATE: "請輸入正確的應繳日。",
  INVALID_PAID_DATE: "請輸入銀行實際扣款日。",
  DATES_TOO_FAR_APART: "實際扣款日與應繳日相差超過 62 天，請確認日期。",
  INVALID_PRINCIPAL: "本金必須是 0 或正整數（新台幣元）。",
  INVALID_INTEREST: "利息必須是 0 或正整數（新台幣元）。",
  INVALID_FEE: "手續費必須是 0 或正整數（新台幣元）。",
  NOTHING_REPAID: "本金與利息不能都是 0。",
  INVALID_EXPENSE_AMOUNT: "這筆支出的金額不是正整數，無法建立還款明細。",
  INVALID_CONFIRMATION: "請選擇確認方式。",
  NO_CHANGES: "沒有變更。",
};

const WHOLE = /^(0|[1-9][0-9]{0,14})$/;
const MAX_DAYS_APART = 62;

/** 支出本身的穩定貸款識別（固定支出範本寫入的 loanKey）；沒有就是 null。 */
export function expenseLoanKey(expense: Pick<LoanExpenseLike, "loanKey">): LoanKey | null {
  return (LOAN_KEYS as readonly string[]).includes(expense.loanKey ?? "") ? expense.loanKey as LoanKey : null;
}

/**
 * 哪些支出可以開「還款明細」（只是顯示入口；建立時仍由使用者選擇貸款並確認）：
 * 1. 支出帶有穩定識別 loanKey（固定支出範本「房貸」「房屋增貸」）；
 * 2. 舊支出（沒有 loanKey）：以結構化欄位判斷——非個人雜支、銀行扣款／轉帳、類別為居家固定費或其他
 *    （這兩個範本既有支出的類別與付款方式），不以備註文字作為唯一條件；
 * 3. 備註含「房貸」「增貸」只作為額外提示（例如手動輸入、付款方式不同的舊資料）。
 * 已建立還款明細的支出一律可開（由呼叫端判斷）。
 */
export function isLoanExpenseCandidate(expense: Pick<LoanExpenseLike, "category" | "note" | "isPrivate" | "paymentMethod" | "loanKey">): boolean {
  if (expense.isPrivate) return false;
  if (expenseLoanKey(expense)) return true;
  if (expense.paymentMethod === "bank_transfer" && (expense.category === "居家固定費" || expense.category === "其他")) return true;
  const note = expense.note ?? "";
  return note.includes("房貸") || note.includes("增貸");
}

/** 建議貸款別：穩定識別優先；否則備註含「增貸」→ 房屋增貸，其餘預設原房貸（使用者可改）。 */
export function suggestLoanKey(expenseOrNote: Pick<LoanExpenseLike, "note" | "loanKey"> | string | undefined): LoanKey {
  if (expenseOrNote && typeof expenseOrNote === "object") {
    const stable = expenseLoanKey(expenseOrNote);
    if (stable) return stable;
    expenseOrNote = expenseOrNote.note;
  }
  return (expenseOrNote ?? "").includes("增貸") ? "TOP_UP_LOAN" : "ORIGINAL_MORTGAGE";
}

/** 舊文件（沒有 stage）視為銀行已扣款。 */
export function repaymentStage(record: Pick<LoanRepaymentRecord, "stage"> | { stage?: unknown }): "PENDING_DEBIT" | "BANK_DEBITED" {
  return record.stage === "PENDING_DEBIT" ? "PENDING_DEBIT" : "BANK_DEBITED";
}

export function draftForExpense(expense: LoanExpenseLike, existing?: LoanRepaymentRecord | null): LoanRepaymentDraft {
  if (existing && existing.stage !== "PENDING_DEBIT") {
    return {
      loanKey: existing.loanKey, dueDate: existing.dueDate, paidDate: existing.paidDate,
      principal: String(existing.principal), interest: String(existing.interest), fee: String(existing.fee), confirmation: existing.confirmation,
    };
  }
  if (existing) {
    // 待扣款 -> 確認銀行已扣款：預定扣款日帶入，實際扣款日、本金、利息留白，必須依銀行通知填寫（不推算）。
    return { loanKey: existing.loanKey, dueDate: existing.dueDate, paidDate: "", principal: "", interest: "", fee: "0", confirmation: "BANK_CONFIRMED" };
  }
  // 新的明細：預定扣款日不使用支出（轉帳）日期，避免把提前轉帳誤當成扣款日；全部由使用者填寫。
  return { loanKey: suggestLoanKey(expense), dueDate: "", paidDate: "", principal: "", interest: "", fee: "0", confirmation: "BANK_CONFIRMED" };
}

export type PendingRepaymentResult = { ok: true; value: PendingRepaymentFields } | { ok: false; code: LoanRepaymentError };

/** 階段 A：待銀行扣款。只需貸款別與預定扣款日；金額就是這筆支出，不填本金或利息。 */
export function buildPendingRepayment(expense: LoanExpenseLike, draft: Pick<LoanRepaymentDraft, "loanKey" | "dueDate">, existing?: LoanRepaymentRecord | null): PendingRepaymentResult {
  if (!(LOAN_KEYS as readonly string[]).includes(draft.loanKey)) return { ok: false, code: "INVALID_LOAN" };
  const dueDate = draft.dueDate.trim();
  if (!isCalendarDate(dueDate)) return { ok: false, code: "INVALID_PLANNED_DATE" };
  if (!Number.isSafeInteger(expense.amount) || expense.amount <= 0) return { ok: false, code: "INVALID_EXPENSE_AMOUNT" };
  const value: PendingRepaymentFields = { stage: "PENDING_DEBIT", loanKey: draft.loanKey as LoanKey, dueDate, totalAmount: expense.amount, status: existing?.status ?? "ACTIVE" };
  if (existing && existing.stage === "PENDING_DEBIT" && existing.loanKey === value.loanKey && existing.dueDate === value.dueDate
    && existing.totalAmount === value.totalAmount && existing.status === value.status) return { ok: false, code: "NO_CHANGES" };
  return { ok: true, value };
}

function daysApart(a: string, b: string) {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

/**
 * 階段 B：銀行已扣款。驗證草稿並產生要寫入的欄位；existing 存在時保留其狀態（作廢／還原另外處理）。
 * 總額 = 本金＋利息＋手續費（銀行實際扣款），不要求等於當初轉帳的支出金額，原始支出不改寫。
 */
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
  if (!(LOAN_REPAYMENT_CONFIRMATIONS as readonly string[]).includes(draft.confirmation)) return { ok: false, code: "INVALID_CONFIRMATION" };
  const value: DebitedRepaymentFields = {
    stage: "BANK_DEBITED", loanKey: draft.loanKey as LoanKey, dueDate, paidDate, totalAmount: principal + interest + fee, principal, interest, fee,
    confirmation: draft.confirmation as LoanRepaymentConfirmation, status: existing?.status ?? "ACTIVE",
  };
  const prior = existing as unknown as Record<string, unknown> | null | undefined;
  if (prior && repaymentStage(existing!) === "BANK_DEBITED" && (Object.keys(value) as (keyof DebitedRepaymentFields)[])
    .every((key) => key === "stage" || prior[key] === value[key])) return { ok: false, code: "NO_CHANGES" };
  return { ok: true, value };
}

export const LOAN_REPAYMENT_STATUS_LABELS = { ACTIVE: "已建立還款明細", VOID: "還款明細已作廢" } as const;
