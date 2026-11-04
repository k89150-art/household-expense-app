import assert from "node:assert/strict";
import test from "node:test";
import { INCOME_CATEGORIES, INCOME_ENTRY_CATEGORIES, INCOME_OWNERS } from "../src/types/income.ts";

test("income owners preserve the existing household member identifiers", () => {
  assert.deepEqual(INCOME_OWNERS, ["chris", "wife"]);
});

test("income categories preserve every existing Firestore value", () => {
  assert.deepEqual(INCOME_CATEGORIES, [
    "本薪",
    "獎勵金",
    "加班費",
    "值班費",
    "衛福部津貼",
    "年終",
    "年終獎金",
    "生活費轉入",
    "其他",
  ]);
});

test("income entry categories preserve the current form options", () => {
  assert.deepEqual(INCOME_ENTRY_CATEGORIES, [
    "本薪",
    "獎勵金",
    "加班費",
    "值班費",
    "衛福部津貼",
    "年終獎金",
    "生活費轉入",
    "其他",
  ]);
});
