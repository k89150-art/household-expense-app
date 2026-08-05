import assert from "node:assert/strict";
import test from "node:test";
import { previousMonthDayString } from "../src/lib/date.ts";

test("insurance date uses the 24th of the previous month", () => {
  assert.equal(previousMonthDayString(24, new Date(2026, 7, 5)), "2026-07-24");
});

test("previous month date crosses the year boundary", () => {
  assert.equal(previousMonthDayString(24, new Date(2026, 0, 5)), "2025-12-24");
});
