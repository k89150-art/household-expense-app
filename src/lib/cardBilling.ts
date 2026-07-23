export type CardBillingName = "玉山" | "台新" | "國泰" | "中信" | "保費卡";

type CardStatementPolicy = {
  closingDay: number;
  closesInFollowingMonth: boolean;
};

const CARD_STATEMENT_POLICIES: Record<CardBillingName, CardStatementPolicy> = {
  國泰: { closingDay: 28, closesInFollowingMonth: false },
  中信: { closingDay: 7, closesInFollowingMonth: true },
  玉山: { closingDay: 7, closesInFollowingMonth: true },
  台新: { closingDay: 2, closesInFollowingMonth: true },
  保費卡: { closingDay: 7, closesInFollowingMonth: true },
};
const CARD_NAMES = Object.keys(CARD_STATEMENT_POLICIES) as CardBillingName[];

export function shiftMonth(yyyymm: string, diff: number) {
  const [year, month] = yyyymm.split("-").map(Number);
  const date = new Date(year, month - 1 + diff, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthDiff(fromMonth: string, toMonth: string) {
  const [fromYear, fromMonthNumber] = fromMonth.split("-").map(Number);
  const [toYear, toMonthNumber] = toMonth.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonthNumber - fromMonthNumber);
}

export function monthLabel(yyyymm: string) {
  const [year, month] = yyyymm.split("-");
  return `${year} 年 ${Number(month)} 月`;
}

function dateString(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(yyyyMMdd: string, days: number) {
  const [year, month, day] = yyyyMMdd.split("-").map(Number);
  return dateString(year, month, day + days);
}

export function statementDateForCard(card: CardBillingName, billMonth: string) {
  const policy = CARD_STATEMENT_POLICIES[card];
  const statementMonth = policy.closesInFollowingMonth ? shiftMonth(billMonth, 1) : billMonth;
  const [year, month] = statementMonth.split("-").map(Number);
  return dateString(year, month, policy.closingDay);
}

export function statementRangeForCard(card: CardBillingName, billMonth: string) {
  const previousStatementDate = statementDateForCard(card, shiftMonth(billMonth, -1));
  return {
    startDate: addDays(previousStatementDate, 1),
    endDate: statementDateForCard(card, billMonth),
  };
}

export function isInCardStatement(recordDate: string, card: CardBillingName, billMonth: string) {
  const { startDate, endDate } = statementRangeForCard(card, billMonth);
  return recordDate >= startDate && recordDate <= endDate;
}

export function cardStatementLabel(card: CardBillingName, billMonth: string) {
  const { startDate, endDate } = statementRangeForCard(card, billMonth);
  return `${monthLabel(billMonth)}帳單｜${startDate.slice(5).replace("-", "/")} - ${endDate.slice(5).replace("-", "/")}｜${endDate} 結帳`;
}

export function cardPaymentDocumentId(owner: "chris" | "wife", card: CardBillingName, billMonth: string) {
  return `card-payment_${owner}_${card}_${billMonth}`;
}

export function nextLegacyInstallmentState(
  record: { totalInstallments: number; nextInstallmentNo: number; nextBillMonth: string },
  paidBillMonth: string,
) {
  const monthOffset = monthDiff(record.nextBillMonth, paidBillMonth);
  const paidInstallmentNo = record.nextInstallmentNo + Math.max(0, monthOffset);
  if (paidInstallmentNo >= record.totalInstallments) {
    return { isActive: false };
  }
  return {
    nextInstallmentNo: paidInstallmentNo + 1,
    nextBillMonth: shiftMonth(paidBillMonth, 1),
  };
}

export function cardActivityRange(billMonths: string[]) {
  const ranges = billMonths.flatMap((billMonth) =>
    CARD_NAMES.map((card) => statementRangeForCard(card, billMonth))
  );
  return {
    startDate: ranges.reduce((earliest, range) => range.startDate < earliest ? range.startDate : earliest, ranges[0].startDate),
    endDate: ranges.reduce((latest, range) => range.endDate > latest ? range.endDate : latest, ranges[0].endDate),
  };
}
