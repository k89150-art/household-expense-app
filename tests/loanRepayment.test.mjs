import assert from "node:assert/strict";
import test from "node:test";
import { buildLoanRepayment, draftForExpense, isLoanExpenseCandidate, suggestLoanKey } from "../src/lib/loanRepayment.ts";

// 虛構資料：房貸支出（居家固定費／房貸）與增貸支出（其他／房屋增貸）。
const mortgage = { id: "exp-mortgage", date: "2026-10-05", amount: 10015, category: "居家固定費", note: "房貸", isPrivate: false };
const topUp = { id: "exp-topup", date: "2026-10-06", amount: 10000, category: "其他", note: "房屋增貸", isPrivate: false };
const filled = (expense, over = {}) => ({ ...draftForExpense(expense), principal: "8000", interest: "2000", fee: "15", ...over });

test("loan repayment: candidates are expenses noted 房貸 / 增貸; private expenses never", () => {
  assert.equal(isLoanExpenseCandidate(mortgage), true);
  assert.equal(isLoanExpenseCandidate(topUp), true);
  assert.equal(isLoanExpenseCandidate({ category: "居家固定費", note: "電費" }), false);
  assert.equal(isLoanExpenseCandidate({ ...mortgage, isPrivate: true }), false);
  assert.equal(suggestLoanKey("房貸"), "ORIGINAL_MORTGAGE");
  assert.equal(suggestLoanKey("房屋增貸"), "TOP_UP_LOAN");
});

test("loan repayment: back-fill draft takes the expense date and leaves principal / interest empty (nothing is guessed)", () => {
  assert.deepEqual(draftForExpense(topUp), { loanKey: "TOP_UP_LOAN", dueDate: "2026-10-06", paidDate: "2026-10-06", principal: "", interest: "", fee: "0", confirmation: "BANK_CONFIRMED" });
  assert.deepEqual(buildLoanRepayment(topUp, draftForExpense(topUp)), { ok: false, code: "INVALID_PRINCIPAL" });
});

test("loan repayment: principal + interest + fee must equal the expense amount; the total is the expense amount", () => {
  const ok = buildLoanRepayment(mortgage, filled(mortgage));
  assert.deepEqual(ok, { ok: true, value: { loanKey: "ORIGINAL_MORTGAGE", dueDate: "2026-10-05", paidDate: "2026-10-05", totalAmount: 10015,
    principal: 8000, interest: 2000, fee: 15, confirmation: "BANK_CONFIRMED", status: "ACTIVE" } });
  assert.deepEqual(buildLoanRepayment(mortgage, filled(mortgage, { fee: "0" })), { ok: false, code: "SPLIT_NOT_EQUAL_TOTAL" });
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
