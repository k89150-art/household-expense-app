import assert from "node:assert/strict";
import test from "node:test";
import {
  CANDIDATE_CHRIS_ONLY_WORK_INCOME_POLICY,
  RECURRING_WORK_INCOME_CATEGORIES,
  WORK_INCOME_CATEGORIES,
  selectWorkIncome,
  selectWorkIncomeRecords,
} from "../src/lib/workIncome.ts";

const sourceRecord = {
  id: "income-1",
  householdId: "test-household",
  date: "2026-09-01",
  amount: 1234.56,
  owner: "chris",
  category: "本薪",
  note: "private note",
  createdBy: "private-firebase-uid",
};

const select = (overrides = {}, policy) => selectWorkIncome(
  { ...sourceRecord, ...overrides },
  "test-household",
  policy,
);

test("recognizes all archived work-income categories and recurring categories", () => {
  assert.equal(WORK_INCOME_CATEGORIES.length, 7);
  assert.equal(RECURRING_WORK_INCOME_CATEGORIES.length, 5);
  for (const category of WORK_INCOME_CATEGORIES) {
    const result = select({ category });
    assert.equal(result.kind, "ELIGIBLE");
    assert.equal(result.value.recurring, RECURRING_WORK_INCOME_CATEGORIES.includes(category));
  }
});

test("excludes known non-work income categories", () => {
  for (const category of ["生活費轉入", "其他"]) {
    assert.deepEqual(select({ category }), { kind: "EXCLUDED", reason: "CATEGORY" });
  }
});

test("default policy handles both existing household members equally", () => {
  assert.equal(select({ owner: "chris" }).kind, "ELIGIBLE");
  assert.equal(select({ owner: "wife" }).kind, "ELIGIBLE");
});

test("keeps the existing numeric amount without conversion", () => {
  const result = select();
  assert.equal(result.kind, "ELIGIBLE");
  assert.equal(result.value.amount, 1234.56);
  assert.equal(typeof result.value.amount, "number");
});

test("does not mutate the original source record", () => {
  const input = Object.freeze({ ...sourceRecord });
  const before = structuredClone(input);
  assert.equal(selectWorkIncome(input, "test-household").kind, "ELIGIBLE");
  assert.deepEqual(input, before);
});

test("handles an empty source collection", () => {
  assert.deepEqual(selectWorkIncomeRecords([], "test-household"), []);
});

test("marks malformed source data invalid without coercion", () => {
  for (const overrides of [
    { householdId: "other-household" },
    { owner: "husband" },
    { category: "薪水" },
    { date: "2026-02-29" },
    { amount: 0 },
    { amount: -1 },
    { amount: "1234.56" },
    { amount: 0.001 },
    { amount: Number.POSITIVE_INFINITY },
  ]) {
    assert.deepEqual(select(overrides), { kind: "INVALID", code: "INVALID_SOURCE_DATA" });
  }
  assert.deepEqual(selectWorkIncome(sourceRecord, ""), { kind: "INVALID", code: "INVALID_SOURCE_DATA" });
});

test("keeps the legacy year-end category readable as non-recurring work income", () => {
  const result = select({ category: "年終" });
  assert.equal(result.kind, "ELIGIBLE");
  assert.equal(result.value.category, "年終");
  assert.equal(result.value.recurring, false);
});

test("projects only the minimum non-private work-income fields", () => {
  const result = select({ privateField: "secret", spouseIncome: 999 });
  assert.equal(result.kind, "ELIGIBLE");
  assert.deepEqual(Object.keys(result.value).sort(), ["amount", "category", "date", "recurring"]);
});

test("Chris-only policy remains an isolated opt-in candidate contract", () => {
  assert.equal(select({ owner: "wife" }).kind, "ELIGIBLE");
  assert.deepEqual(
    select({ owner: "wife" }, CANDIDATE_CHRIS_ONLY_WORK_INCOME_POLICY),
    { kind: "EXCLUDED", reason: "OWNER" },
  );
});
