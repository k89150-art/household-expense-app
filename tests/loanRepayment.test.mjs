import assert from "node:assert/strict";
import test from "node:test";
import { buildLoanRepayment, buildPendingRepayment, draftForExpense, isLoanExpenseCandidate, repaymentStage, suggestLoanKey } from "../src/lib/loanRepayment.ts";

// 虛構資料：房貸支出（居家固定費／房貸）與增貸支出（其他／房屋增貸）。
const mortgage = { id: "exp-mortgage", date: "2026-10-05", amount: 10015, category: "居家固定費", note: "房貸", isPrivate: false };
const topUp = { id: "exp-topup", date: "2026-10-06", amount: 10000, category: "其他", note: "房屋增貸", isPrivate: false };
const filled = (expense, over = {}) => ({ ...draftForExpense(expense), dueDate: expense.date, paidDate: expense.date, principal: "8000", interest: "2000", fee: "15", ...over });

test("loan repayment: the stable loanKey identifies loan expenses; legacy ones by category + bank transfer; private never", () => {
  // stable id written by the recurring templates 房貸 / 房屋增貸, whatever the note says
  assert.equal(isLoanExpenseCandidate({ category: "其他", note: "11 月", loanKey: "TOP_UP_LOAN", paymentMethod: "cash" }), true);
  assert.equal(suggestLoanKey({ note: "房貸", loanKey: "TOP_UP_LOAN" }), "TOP_UP_LOAN");
  assert.equal(isLoanExpenseCandidate({ category: "其他", note: "x", loanKey: "CAR_LOAN" }), false);   // unknown id is ignored
  // legacy (no loanKey): structured fields, not the note alone
  assert.equal(isLoanExpenseCandidate({ category: "居家固定費", note: "", paymentMethod: "bank_transfer" }), true);
  assert.equal(isLoanExpenseCandidate({ category: "其他", note: "提前轉入扣款帳戶", paymentMethod: "bank_transfer" }), true);
  assert.equal(isLoanExpenseCandidate({ category: "餐飲", note: "午餐", paymentMethod: "bank_transfer" }), false);
  assert.equal(isLoanExpenseCandidate({ category: "居家固定費", note: "管理費", paymentMethod: "cash" }), false);
  assert.equal(isLoanExpenseCandidate(mortgage), true);
  assert.equal(isLoanExpenseCandidate(topUp), true);
  assert.equal(isLoanExpenseCandidate({ category: "居家固定費", note: "電費" }), false);
  assert.equal(isLoanExpenseCandidate({ ...mortgage, isPrivate: true, loanKey: "ORIGINAL_MORTGAGE" }), false);
  assert.equal(suggestLoanKey("房貸"), "ORIGINAL_MORTGAGE");
  assert.equal(suggestLoanKey("房屋增貸"), "TOP_UP_LOAN");
});

test("loan repayment: a new draft guesses no date (the transfer date is not the debit date) and leaves principal / interest empty", () => {
  assert.deepEqual(draftForExpense(topUp), { loanKey: "TOP_UP_LOAN", dueDate: "", paidDate: "", principal: "", interest: "", fee: "0", confirmation: "BANK_CONFIRMED" });
  assert.deepEqual(buildPendingRepayment(topUp, draftForExpense(topUp)), { ok: false, code: "INVALID_PLANNED_DATE" });
  assert.deepEqual(buildLoanRepayment(topUp, { ...draftForExpense(topUp), dueDate: "2026-10-06" }), { ok: false, code: "INVALID_PAID_DATE" });
});

test("two-stage: 待銀行扣款 records only the loan, the planned debit date and the expense amount", () => {
  const transfer = { id: "exp-1105", date: "2026-11-05", amount: 19200, category: "居家固定費", note: "房貸", isPrivate: false };
  const p = buildPendingRepayment(transfer, { loanKey: "ORIGINAL_MORTGAGE", dueDate: "2026-11-21" });
  assert.deepEqual(p, { ok: true, value: { stage: "PENDING_DEBIT", loanKey: "ORIGINAL_MORTGAGE", dueDate: "2026-11-21", totalAmount: 19200, status: "ACTIVE" } });
  const existing = { ...p.value, id: transfer.id, householdId: "default-household", expenseId: transfer.id, createdBy: "u" };
  assert.deepEqual(buildPendingRepayment(transfer, { loanKey: "ORIGINAL_MORTGAGE", dueDate: "2026-11-21" }, existing), { ok: false, code: "NO_CHANGES" });
  assert.equal(buildPendingRepayment(transfer, { loanKey: "ORIGINAL_MORTGAGE", dueDate: "2026-11-22" }, existing).ok, true);
  // confirming the bank debit: the draft keeps the planned date, everything else must be entered
  assert.deepEqual(draftForExpense(transfer, existing), { loanKey: "ORIGINAL_MORTGAGE", dueDate: "2026-11-21", paidDate: "", principal: "", interest: "", fee: "0", confirmation: "BANK_CONFIRMED" });
  // the bank's own debit (19,122) differs from the transfer (19,200): recorded as the bank's split, the expense is not rewritten
  const d = buildLoanRepayment(transfer, { ...draftForExpense(transfer, existing), paidDate: "2026-11-21", principal: "10956", interest: "8166", fee: "0" }, existing);
  assert.deepEqual(d, { ok: true, value: { stage: "BANK_DEBITED", loanKey: "ORIGINAL_MORTGAGE", dueDate: "2026-11-21", paidDate: "2026-11-21", totalAmount: 19122,
    principal: 10956, interest: 8166, fee: 0, confirmation: "BANK_CONFIRMED", status: "ACTIVE" } });
  assert.equal(transfer.amount, 19200);
  assert.equal(repaymentStage({}), "BANK_DEBITED");            // legacy documents without a stage
  assert.equal(repaymentStage({ stage: "PENDING_DEBIT" }), "PENDING_DEBIT");
});

test("loan repayment: the debited total is principal + interest + fee (the bank's actual debit)", () => {
  const ok = buildLoanRepayment(mortgage, filled(mortgage));
  assert.deepEqual(ok, { ok: true, value: { stage: "BANK_DEBITED", loanKey: "ORIGINAL_MORTGAGE", dueDate: "2026-10-05", paidDate: "2026-10-05", totalAmount: 10015,
    principal: 8000, interest: 2000, fee: 15, confirmation: "BANK_CONFIRMED", status: "ACTIVE" } });
  assert.equal(buildLoanRepayment(mortgage, filled(mortgage, { fee: "0" })).value.totalAmount, 10000);
  assert.deepEqual(buildLoanRepayment(topUp, filled(topUp, { fee: "0", principal: "7000", interest: "3000" })).ok, true);
});

test("loan repayment: invalid values are rejected, never rounded or inferred", () => {
  const cases = [
    [{ loanKey: "CAR" }, "INVALID_LOAN"], [{ dueDate: "2026-02-30" }, "INVALID_DUE_DATE"], [{ paidDate: "x" }, "INVALID_PAID_DATE"],
    [{ paidDate: "2027-01-05" }, "DATES_TOO_FAR_APART"], [{ principal: "8000.5" }, "INVALID_PRINCIPAL"], [{ principal: "-1" }, "INVALID_PRINCIPAL"],
    [{ interest: "01" }, "INVALID_INTEREST"], [{ fee: "" }, "INVALID_FEE"], [{ principal: "0", interest: "0", fee: "10015" }, "NOTHING_REPAID"],
    [{ confirmation: "GUESS" }, "INVALID_CONFIRMATION"],
  ];
  for (const [over, code] of cases) assert.deepEqual(buildLoanRepayment(mortgage, filled(mortgage, over)), { ok: false, code }, code);
  assert.deepEqual(buildLoanRepayment({ ...mortgage, amount: 10015.5 }, filled(mortgage)), { ok: false, code: "INVALID_EXPENSE_AMOUNT" });
});

test("loan repayment: editing keeps the status; an unchanged draft reports NO_CHANGES", () => {
  const value = buildLoanRepayment(mortgage, filled(mortgage)).value;
  const existing = { ...value, id: mortgage.id, householdId: "default-household", expenseId: mortgage.id, createdBy: "u" };
  assert.deepEqual(buildLoanRepayment(mortgage, draftForExpense(mortgage, existing), existing), { ok: false, code: "NO_CHANGES" });
  const moved = buildLoanRepayment(mortgage, { ...draftForExpense(mortgage, existing), dueDate: "2026-11-05", paidDate: "2026-11-05" }, existing);
  assert.equal(moved.ok, true);
  assert.equal(moved.value.dueDate, "2026-11-05");
  assert.equal(buildLoanRepayment(mortgage, draftForExpense(mortgage, { ...existing, status: "VOID" }), { ...existing, status: "VOID" }).ok, false);
});
