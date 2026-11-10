import assert from "node:assert/strict";
import test from "node:test";
import { buildIncomeChanges, draftFromIncome, editableIncomeCategories } from "../src/lib/incomeEdit.ts";

const original = { date: "2026-10-05", amount: 52000, category: "本薪", note: "10 月本薪" };

test("income edit: unchanged draft reports NO_CHANGES (no write, no new version downstream)", () => {
  assert.deepEqual(buildIncomeChanges(original, draftFromIncome(original)), { ok: false, code: "NO_CHANGES" });
});

test("income edit: only changed fields are written; owner / householdId / createdBy are never part of the change", () => {
  const result = buildIncomeChanges(original, { ...draftFromIncome(original), amount: "53000.5" });
  assert.deepEqual(result, { ok: true, changes: { amount: 53000.5 } });
  const all = buildIncomeChanges(original, { date: "2026-10-06", amount: "1", category: "加班費", note: "改" });
  assert.deepEqual(all, { ok: true, changes: { date: "2026-10-06", amount: 1, category: "加班費", note: "改" } });
  for (const key of ["owner", "householdId", "createdBy", "id"]) assert.equal(key in all.changes, false);
});

test("income edit: clearing the note removes the field (null), whitespace-only notes count as empty", () => {
  assert.deepEqual(buildIncomeChanges(original, { ...draftFromIncome(original), note: "   " }), { ok: true, changes: { note: null } });
  assert.deepEqual(buildIncomeChanges({ ...original, note: undefined }, { ...draftFromIncome(original), note: "" }), { ok: false, code: "NO_CHANGES" });
});

test("income edit: invalid input is rejected before any write", () => {
  const draft = draftFromIncome(original);
  for (const date of ["2026-02-30", "2026/10/05", "", "2026-13-01"]) {
    assert.deepEqual(buildIncomeChanges(original, { ...draft, date }), { ok: false, code: "INVALID_DATE" });
  }
  for (const amount of ["0", "-1", "abc", "1.234", "", "1e5", "9999999999999999999"]) {
    assert.deepEqual(buildIncomeChanges(original, { ...draft, amount }), { ok: false, code: "INVALID_AMOUNT" });
  }
  assert.deepEqual(buildIncomeChanges(original, { ...draft, category: "未知" }), { ok: false, code: "INVALID_CATEGORY" });
  assert.deepEqual(buildIncomeChanges(original, { ...draft, category: "年終" }), { ok: false, code: "INVALID_CATEGORY" });
  assert.deepEqual(buildIncomeChanges(original, { ...draft, note: "x".repeat(201) }), { ok: false, code: "NOTE_TOO_LONG" });
});

test("income edit: a legacy 年終 record keeps its category selectable; new edits cannot pick 年終", () => {
  assert.equal(editableIncomeCategories("年終")[0], "年終");
  assert.equal(editableIncomeCategories("本薪").includes("年終"), false);
  const legacy = { ...original, category: "年終" };
  assert.deepEqual(buildIncomeChanges(legacy, { ...draftFromIncome(legacy), amount: "60000" }), { ok: true, changes: { amount: 60000 } });
  assert.deepEqual(buildIncomeChanges(legacy, { ...draftFromIncome(legacy), category: "年終獎金" }), { ok: true, changes: { category: "年終獎金" } });
});
