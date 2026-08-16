import assert from "node:assert/strict";
import test from "node:test";
import { advanceReimbursementDate, reimbursedAdvancesForPeriod } from "../src/lib/advanceCashFlow.ts";

const records = [
  { id: "july-paid-in-august", date: "2026-07-17", amount: 1080, status: "已收回", reimbursedDate: "2026-08-16" },
  { id: "july-pending", date: "2026-07-14", amount: 6600, status: "已送件" },
  { id: "legacy-reimbursement", date: "2026-07-01", amount: 500, status: "已收回" },
];

test("reimbursement belongs to the month it was received", () => {
  assert.deepEqual(reimbursedAdvancesForPeriod(records, "2026-07-01", "2026-07-31").map((record) => record.id), ["legacy-reimbursement"]);
  assert.deepEqual(reimbursedAdvancesForPeriod(records, "2026-08-01", "2026-08-31").map((record) => record.id), ["july-paid-in-august"]);
});

test("legacy reimbursements without a received date fall back to the original date", () => {
  assert.equal(advanceReimbursementDate(records[2]), "2026-07-01");
  assert.equal(advanceReimbursementDate(records[1]), null);
});
