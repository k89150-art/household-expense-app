import assert from "node:assert/strict";
import test from "node:test";
import {
  cardActivityRange,
  cardPaymentDocumentId,
  cardStatementLabel,
  isInCardStatement,
  nextLegacyInstallmentState,
  shiftMonth,
  statementDateForCard,
  statementRangeForCard,
} from "../src/lib/cardBilling.ts";

test("shiftMonth handles year boundaries", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
});

test("Cathay closes on the 28th of the bill month", () => {
  assert.equal(statementDateForCard("國泰", "2026-06"), "2026-06-28");
  assert.deepEqual(statementRangeForCard("國泰", "2026-06"), {
    startDate: "2026-05-29",
    endDate: "2026-06-28",
  });
});

test("CTBC and E.SUN close on the 7th of the following month", () => {
  assert.deepEqual(statementRangeForCard("中信", "2026-06"), {
    startDate: "2026-06-08",
    endDate: "2026-07-07",
  });
  assert.deepEqual(statementRangeForCard("玉山", "2026-06"), {
    startDate: "2026-06-08",
    endDate: "2026-07-07",
  });
});

test("Taishin closes on the 2nd of the following month", () => {
  assert.deepEqual(statementRangeForCard("台新", "2026-06"), {
    startDate: "2026-06-03",
    endDate: "2026-07-02",
  });
});

test("statement range includes both boundary dates", () => {
  assert.equal(isInCardStatement("2026-06-08", "中信", "2026-06"), true);
  assert.equal(isInCardStatement("2026-07-07", "中信", "2026-06"), true);
  assert.equal(isInCardStatement("2026-06-07", "中信", "2026-06"), false);
  assert.equal(isInCardStatement("2026-07-08", "中信", "2026-06"), false);
});

test("statement labels expose the exact range", () => {
  assert.equal(
    cardStatementLabel("台新", "2026-06"),
    "2026 年 6 月帳單｜06/03 - 07/02｜2026-07-02 結帳",
  );
});

test("activity range covers every card for adjacent bill months", () => {
  assert.deepEqual(cardActivityRange(["2026-06", "2026-07"]), {
    startDate: "2026-05-29",
    endDate: "2026-08-07",
  });
});

test("one owner, card and bill month always maps to one payment document", () => {
  assert.equal(
    cardPaymentDocumentId("wife", "台新", "2026-07"),
    "card-payment_wife_台新_2026-07",
  );
});

test("legacy installments advance exactly one period after payment", () => {
  assert.deepEqual(
    nextLegacyInstallmentState({
      totalInstallments: 6,
      nextInstallmentNo: 5,
      nextBillMonth: "2026-06",
    }, "2026-06"),
    {
      nextInstallmentNo: 6,
      nextBillMonth: "2026-07",
    },
  );
});

test("legacy installments close after the final period", () => {
  assert.deepEqual(
    nextLegacyInstallmentState({
      totalInstallments: 6,
      nextInstallmentNo: 6,
      nextBillMonth: "2026-07",
    }, "2026-07"),
    { isActive: false },
  );
});

test("legacy installments catch up when multiple paid months already exist", () => {
  assert.deepEqual(
    nextLegacyInstallmentState({
      totalInstallments: 6,
      nextInstallmentNo: 1,
      nextBillMonth: "2026-06",
    }, "2026-08"),
    {
      nextInstallmentNo: 4,
      nextBillMonth: "2026-09",
    },
  );
});
