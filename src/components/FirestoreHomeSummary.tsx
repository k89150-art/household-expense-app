"use client";

import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/components/AuthGate";
import { currentMonthString, localDateString } from "@/lib/date";
import {
  addCardPaymentRecord,
  deleteAdvanceRecord,
  deleteCardPaymentRecord,
  deleteExpenseRecord,
  deleteIncomeRecord,
  deleteInvestmentRecord,
  getAllAdvanceRecords,
  getAllCardPaymentRecords,
  getAllExpenseRecords,
  getAllIncomeRecords,
  getAllInvestmentRecords,
  getAdvanceRecordsByMonth,
  getCardPaymentRecordsByBillMonth,
  getCardPaymentRecordsByMonth,
  getCreditCardExpenseRecords,
  getExpenseRecordsByMonth,
  getIncomeRecordsByMonth,
  getInvestmentRecordsByMonth,
  getLegacyInstallmentRecords,
  updateAdvanceRecord,
  updateExpenseRecord,
  updateLegacyInstallmentRecord,
} from "@/lib/records";
import type {
  AdvanceRecord,
  CardPaymentRecord,
  CreditCardName,
  ExpenseRecord,
  IncomeRecord,
  InstallmentInfo,
  InstallmentScheduleItem,
  InvestmentRecord,
  LegacyInstallmentRecord,
} from "@/lib/records";
import type { Viewer } from "@/lib/household";

type Scope = "month" | "all";
type CreditCardTab = "due" | "unbilled" | "paid";
type Props = { viewer: Viewer; refreshKey?: number };
type CardLine = { date: string; label: string; amount: number; kind: "expense" | "advance" | "installment" | "legacyInstallment"; sourceExpense?: ExpenseRecord };
type CardStatementPolicy = { closingDay: number; closesInFollowingMonth: boolean };

const CARD_STATEMENT_POLICIES: Record<CreditCardName, CardStatementPolicy> = {
  國泰: { closingDay: 28, closesInFollowingMonth: false },
  中信: { closingDay: 7, closesInFollowingMonth: true },
  玉山: { closingDay: 7, closesInFollowingMonth: true },
  台新: { closingDay: 2, closesInFollowingMonth: true },
  保費卡: { closingDay: 7, closesInFollowingMonth: true },
};
const CARD_PAYMENT_FEES: Partial<Record<CreditCardName, number>> = {
  中信: 10,
};

const TARGET_LABELS: Record<string, string> = { chris: "我", wife: "我", junyao: "竣堯", cat: "貓" };

function money(value = 0) {
  return `$${value.toLocaleString("zh-TW")}`;
}

function cardPaymentFee(card: CreditCardName) {
  return CARD_PAYMENT_FEES[card] ?? 0;
}

function shiftMonth(yyyymm: string, diff: number) {
  const [year, month] = yyyymm.split("-").map(Number);
  const date = new Date(year, month - 1 + diff, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthDiff(fromMonth: string, toMonth: string) {
  const [fromYear, fromMonthNumber] = fromMonth.split("-").map(Number);
  const [toYear, toMonthNumber] = toMonth.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonthNumber - fromMonthNumber);
}

function monthLabel(yyyymm: string) {
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

function statementDateForCard(card: CreditCardName, billMonth: string) {
  const policy = CARD_STATEMENT_POLICIES[card] ?? CARD_STATEMENT_POLICIES.中信;
  const statementMonth = policy.closesInFollowingMonth ? shiftMonth(billMonth, 1) : billMonth;
  const [year, month] = statementMonth.split("-").map(Number);
  return dateString(year, month, policy.closingDay);
}

function statementRangeForCard(card: CreditCardName, billMonth: string) {
  const previousStatementDate = statementDateForCard(card, shiftMonth(billMonth, -1));
  return {
    startDate: addDays(previousStatementDate, 1),
    endDate: statementDateForCard(card, billMonth),
  };
}

function isInCardStatement(recordDate: string, card: CreditCardName, billMonth: string) {
  const { startDate, endDate } = statementRangeForCard(card, billMonth);
  return recordDate >= startDate && recordDate <= endDate;
}

function cardStatementLabel(card: CreditCardName, billMonth: string) {
  const { startDate, endDate } = statementRangeForCard(card, billMonth);
  return `${monthLabel(billMonth)}帳單｜${startDate.slice(5).replace("-", "/")} - ${endDate.slice(5).replace("-", "/")}｜${endDate} 結帳`;
}

function cardStatementStatusLabel(card: CreditCardName, billMonth: string) {
  const { endDate } = statementRangeForCard(card, billMonth);
  return localDateString() < endDate ? "未結帳，金額先預估" : "已結帳，可核對金額";
}

function isCardStatementClosed(card: CreditCardName, billMonth: string) {
  const { endDate } = statementRangeForCard(card, billMonth);
  return localDateString() >= endDate;
}

function legacyInstallmentLine(record: LegacyInstallmentRecord, billMonth: string): CardLine | null {
  if (!record.isActive) return null;
  const monthOffset = monthDiff(record.nextBillMonth, billMonth);
  if (monthOffset < 0) return null;
  const installmentNo = record.nextInstallmentNo + monthOffset;
  if (installmentNo > record.totalInstallments) return null;
  return {
    date: `${billMonth}-01`,
    label: `${record.name}・記帳前分期 ${installmentNo}/${record.totalInstallments}${record.note ? `・${record.note}` : ""}`,
    amount: record.amount,
    kind: "legacyInstallment",
  };
}

function legacyInstallmentDisplay(record: LegacyInstallmentRecord, billMonth: string) {
  const monthOffset = monthDiff(record.nextBillMonth, billMonth);
  if (monthOffset >= 0) {
    const installmentNo = record.nextInstallmentNo + monthOffset;
    if (installmentNo <= record.totalInstallments) {
      return {
        label: `本月應繳 ${installmentNo}/${record.totalInstallments}・${billMonth}`,
        isDue: true,
      };
    }
  }
  return {
    label: `下一期 ${record.nextInstallmentNo}/${record.totalInstallments}・${record.nextBillMonth}`,
    isDue: false,
  };
}

function nextLegacyInstallmentState(record: LegacyInstallmentRecord, paidBillMonth: string) {
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

function matchingPaidBillMonths(record: LegacyInstallmentRecord, payments: CardPaymentRecord[], viewer: Viewer) {
  return payments
    .filter((payment) =>
      payment.owner === viewer &&
      payment.card === record.card &&
      payment.billMonth >= record.nextBillMonth
    )
    .map((payment) => payment.billMonth)
    .sort();
}

function isValidMonth(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

function splitInstallmentAmount(totalPayable: number, totalInstallments: number, firstBillMonth: string): InstallmentScheduleItem[] {
  const baseAmount = Math.floor(totalPayable / totalInstallments);
  return Array.from({ length: totalInstallments }, (_, index) => {
    const installmentNo = index + 1;
    const amount = installmentNo === totalInstallments ? totalPayable - baseAmount * (totalInstallments - 1) : baseAmount;
    return { billMonth: shiftMonth(firstBillMonth, index), installmentNo, amount };
  });
}

function displayTarget(record: ExpenseRecord, viewer: Viewer) {
  if (record.target === "chris") return viewer === "chris" ? "我" : "先生";
  if (record.target === "wife") return viewer === "wife" ? "我" : "太太";
  return TARGET_LABELS[record.target] ?? record.target;
}

function displayPaidBy(record: ExpenseRecord, viewer: Viewer) {
  if (record.paidBy === "chris") return viewer === "chris" ? "我" : "先生";
  return viewer === "wife" ? "我" : "太太";
}

function groupByTarget(records: ExpenseRecord[]) {
  return records.reduce<Record<string, ExpenseRecord[]>>((groups, record) => {
    groups[record.target] = [...(groups[record.target] ?? []), record];
    return groups;
  }, {});
}

function groupByCategory(records: ExpenseRecord[]) {
  return records.reduce<Record<string, ExpenseRecord[]>>((groups, record) => {
    groups[record.category] = [...(groups[record.category] ?? []), record];
    return groups;
  }, {});
}

function groupByOwner<T extends { owner: "chris" | "wife" }>(records: T[]) {
  return records.reduce<Record<string, T[]>>((groups, record) => {
    groups[record.owner] = [...(groups[record.owner] ?? []), record];
    return groups;
  }, {});
}

function ownerLabel(owner: "chris" | "wife", viewer: Viewer) {
  if (owner === "chris") return viewer === "chris" ? "我" : "先生";
  return viewer === "wife" ? "我" : "太太";
}

function cardLineTitle(record: CardLine) {
  if (record.sourceExpense?.isPrivate) return "個人雜支";
  return record.label;
}

function cardLineMeta(record: CardLine, viewer: Viewer) {
  const tags: string[] = [];
  if (record.sourceExpense) tags.push(`${displayPaidBy(record.sourceExpense, viewer)}刷`);
  if (record.kind === "advance") tags.push("代墊");
  if (record.kind === "installment") tags.push("分期");
  if (record.kind === "legacyInstallment") tags.push("記帳前分期");
  return tags.join("・");
}

function addCardLine(groups: Record<string, CardLine[]>, card: string, line: CardLine) {
  groups[card] = [...(groups[card] ?? []), line];
}

function groupDueCreditCardBills(billAdvances: AdvanceRecord[], allCardRecords: ExpenseRecord[], legacyInstallments: LegacyInstallmentRecord[], billMonth: string) {
  const groups: Record<string, CardLine[]> = {};

  allCardRecords.forEach((record) => {
    if (record.paymentMethod !== "credit_card" || !record.creditCard || record.installment?.enabled) return;
    if (!isInCardStatement(record.date, record.creditCard, billMonth)) return;
    addCardLine(groups, record.creditCard, { date: record.date, label: record.note || record.category, amount: record.amount, kind: "expense", sourceExpense: record });
  });

  billAdvances.forEach((record) => {
    if (record.paymentMethod !== "credit_card" || !record.creditCard) return;
    if (!isInCardStatement(record.date, record.creditCard, billMonth)) return;
    addCardLine(groups, record.creditCard, { date: record.date, label: `代墊・${record.item}`, amount: record.amount, kind: "advance" });
  });

  allCardRecords.forEach((record) => {
    const installment: InstallmentInfo | undefined = record.installment;
    if (!record.creditCard || !installment?.enabled) return;
    const matched = installment.schedule.find((item) => item.billMonth === billMonth);
    if (!matched) return;
    addCardLine(groups, record.creditCard, {
      date: `${matched.billMonth}-01`,
      label: `${record.category}・分期 ${matched.installmentNo}/${installment.total}${record.note ? `・${record.note}` : ""}`,
      amount: matched.amount,
      kind: "installment",
      sourceExpense: record,
    });
  });

  legacyInstallments.forEach((record) => {
    const line = legacyInstallmentLine(record, billMonth);
    if (!line) return;
    addCardLine(groups, record.card, line);
  });

  return groups;
}

function statusBadge(state: "estimate" | "due" | "paid") {
  const colors = {
    estimate: "#8A5B2E",
    due: "#C53030",
    paid: "#16803C",
  };
  const labels = {
    estimate: "未結帳預估",
    due: "已結帳待繳",
    paid: "已繳款",
  };
  return <span style={{ color: colors[state], fontWeight: 800 }}>{labels[state]}</span>;
}

function getErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code?: unknown }).code);
  }
  return "unknown";
}

export function FirestoreHomeSummary({ viewer, refreshKey = 0 }: Props) {
  const user = useCurrentUser();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthString());
  const [scope, setScope] = useState<Scope>("month");
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [investments, setInvestments] = useState<InvestmentRecord[]>([]);
  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);
  const [dueAdvances, setDueAdvances] = useState<AdvanceRecord[]>([]);
  const [allCreditCardExpenses, setAllCreditCardExpenses] = useState<ExpenseRecord[]>([]);
  const [cardPayments, setCardPayments] = useState<CardPaymentRecord[]>([]);
  const [dueBillPayments, setDueBillPayments] = useState<CardPaymentRecord[]>([]);
  const [legacyInstallments, setLegacyInstallments] = useState<LegacyInstallmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [openedTarget, setOpenedTarget] = useState<string | null>(null);
  const [openedCategory, setOpenedCategory] = useState<string | null>(null);
  const [showIncomes, setShowIncomes] = useState(false);
  const [showInvestments, setShowInvestments] = useState(false);
  const [showAdvances, setShowAdvances] = useState(false);
  const [showCreditCards, setShowCreditCards] = useState(false);
  const [creditCardTab, setCreditCardTab] = useState<CreditCardTab>("unbilled");
  const [openedCardDetails, setOpenedCardDetails] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");

  async function loadRecords() {
    setIsLoading(true);
    setMessage("");
    try {
      const dueBillMonth = shiftMonth(selectedMonth, -1);
      const [expenseData, incomeData, investmentData, advanceData, dueAdvanceData, allCardExpenseData, paymentData, duePaymentData, allPaymentData, legacyInstallmentData] = await Promise.all([
        scope === "month" ? getExpenseRecordsByMonth(selectedMonth) : getAllExpenseRecords(),
        scope === "month" ? getIncomeRecordsByMonth(selectedMonth) : getAllIncomeRecords(),
        scope === "month" ? getInvestmentRecordsByMonth(selectedMonth) : getAllInvestmentRecords(),
        scope === "month" ? getAdvanceRecordsByMonth(selectedMonth) : getAllAdvanceRecords(),
        getAllAdvanceRecords(),
        getCreditCardExpenseRecords(),
        scope === "month" ? getCardPaymentRecordsByMonth(selectedMonth) : getAllCardPaymentRecords(),
        getCardPaymentRecordsByBillMonth(dueBillMonth),
        getAllCardPaymentRecords(),
        getLegacyInstallmentRecords(),
      ]);
      const syncedLegacyInstallments = await Promise.all(legacyInstallmentData.map(async (record) => {
        if (!record.isActive || (record.owner ?? "chris") !== viewer) return record;
        const paidBillMonths = matchingPaidBillMonths(record, allPaymentData, viewer);
        const latestPaidBillMonth = paidBillMonths.at(-1);
        if (!latestPaidBillMonth) return record;
        const nextState = nextLegacyInstallmentState(record, latestPaidBillMonth);
        await updateLegacyInstallmentRecord(record.id, nextState);
        return { ...record, ...nextState };
      }));
      setExpenses(expenseData);
      setIncomes(incomeData);
      setInvestments(investmentData);
      setAdvances(advanceData);
      setDueAdvances(dueAdvanceData);
      setAllCreditCardExpenses(allCardExpenseData);
      setCardPayments(paymentData);
      setDueBillPayments(duePaymentData);
      setLegacyInstallments(syncedLegacyInstallments);
    } catch (error) {
      console.error(error);
      setMessage(`讀取資料失敗，請稍後再試或確認 Firebase 設定。錯誤：${getErrorCode(error)}`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, scope, refreshKey]);

  async function handleDeleteExpense(record: ExpenseRecord) {
    if (!user) {
      setMessage("請先登入。");
      return;
    }
    if (record.isPrivate && record.createdBy !== user.uid) {
      setMessage("私人支出只能由建立這筆資料的人刪除。");
      return;
    }
    if (!window.confirm("確定要刪除這筆支出嗎？")) return;
    await deleteExpenseRecord(record.id, user.uid);
    await loadRecords();
  }

  async function handleDeleteIncome(id: string) {
    if (!window.confirm("確定要刪除這筆收入嗎？")) return;
    await deleteIncomeRecord(id);
    await loadRecords();
  }

  async function handleDeleteInvestment(id: string) {
    if (!window.confirm("確定要刪除這筆投資紀錄嗎？")) return;
    await deleteInvestmentRecord(id);
    await loadRecords();
  }

  async function handleDeleteAdvance(id: string) {
    if (!window.confirm("確定要刪除這筆代墊款嗎？")) return;
    await deleteAdvanceRecord(id);
    await loadRecords();
  }

  async function handleAdvanceStatus(record: AdvanceRecord, status: AdvanceRecord["status"]) {
    if (!window.confirm(`確定要把「${record.item}」改成${status}嗎？`)) return;
    await updateAdvanceRecord(record.id, { status, reimbursedDate: status === "已收回" ? localDateString() : undefined });
    await loadRecords();
  }

  async function handleUpdateInstallmentFirstBillMonth(record: ExpenseRecord) {
    const installment = record.installment;
    if (!installment?.enabled) return;
    const nextMonth = window.prompt("請輸入第一期帳單月份，例如 2026-09", installment.firstBillMonth);
    if (!nextMonth) return;
    if (!isValidMonth(nextMonth)) {
      setMessage("月份格式錯誤，請輸入例如 2026-09。");
      return;
    }
    if (!window.confirm(`確定將這筆分期的第一期帳單月份改成 ${nextMonth} 嗎？`)) return;
    await updateExpenseRecord(record.id, {
      installment: {
        ...installment,
        firstBillMonth: nextMonth,
        schedule: splitInstallmentAmount(installment.totalPayable, installment.total, nextMonth),
      },
    });
    await loadRecords();
  }

  async function handleCreateCardPayment(card: string, amount: number, billMonth: string) {
    if (!user) {
      setMessage("請先登入。");
      return;
    }
    const typedCard = card as CreditCardName;
    const fee = cardPaymentFee(typedCard);
    const paymentAmount = amount + fee;
    const feeText = fee > 0 ? `（含他行扣款手續費 ${money(fee)}）` : "";
    if (!window.confirm(`確定要建立 ${card} ${billMonth} 帳單繳款 ${money(paymentAmount)} ${feeText}嗎？`)) return;
    const dueLegacyInstallments = legacyInstallments.filter((record) =>
      record.isActive &&
      (record.owner ?? "chris") === viewer &&
      record.card === typedCard &&
      legacyInstallmentLine(record, billMonth)
    );
    const legacyInstallmentAdjustments = dueLegacyInstallments.map((record) => ({
      id: record.id,
      nextInstallmentNo: record.nextInstallmentNo,
      nextBillMonth: record.nextBillMonth,
      isActive: record.isActive,
    }));
    const legacyInstallmentUpdates = dueLegacyInstallments.map((record) => ({
      id: record.id,
      ...nextLegacyInstallmentState(record, billMonth),
    }));
    await addCardPaymentRecord({
      date: localDateString(),
      amount: paymentAmount,
      owner: viewer,
      card: typedCard,
      billMonth,
      status: "已繳款",
      paidDate: localDateString(),
      note: `${billMonth} ${card}帳單繳款${fee > 0 ? `，含他行扣款手續費 ${fee} 元` : ""}`,
      legacyInstallmentAdjustments,
      createdBy: user.uid,
    }, legacyInstallmentUpdates);
    await loadRecords();
  }

  async function handleDeleteCardPayment(payment: CardPaymentRecord) {
    if (!window.confirm("確定要取消這筆信用卡繳款紀錄嗎？")) return;
    await deleteCardPaymentRecord(payment.id, payment.legacyInstallmentAdjustments ?? []);
    await loadRecords();
  }

  function toggleCardDetails(key: string) {
    setOpenedCardDetails((current) => ({ ...current, [key]: !current[key] }));
  }

  const dueBillMonth = shiftMonth(selectedMonth, -1);
  const totalIncome = incomes.reduce((sum, record) => sum + record.amount, 0);
  const paidNowExpense = expenses.filter((record) => record.paymentMethod !== "credit_card").reduce((sum, record) => sum + record.amount, 0);
  const totalInvestment = investments.reduce((sum, record) => sum + record.amount, 0);
  const pendingAdvanceRecords = advances.filter((record) => record.status !== "已收回");
  const paidNowAdvance = advances.filter((record) => record.paymentMethod !== "credit_card").reduce((sum, record) => sum + record.amount, 0);
  const pendingAdvance = pendingAdvanceRecords.reduce((sum, record) => sum + record.amount, 0);
  const reimbursedAdvance = advances.filter((record) => record.status === "已收回").reduce((sum, record) => sum + record.amount, 0);
  const totalCardPayment = cardPayments.reduce((sum, record) => sum + record.amount, 0);
  const ownCardPayments = useMemo(() => cardPayments.filter((record) => record.owner === viewer), [cardPayments, viewer]);
  const ownDueBillPayments = useMemo(() => dueBillPayments.filter((record) => record.owner === viewer), [dueBillPayments, viewer]);
  const ownDueAdvances = useMemo(() => dueAdvances.filter((record) => record.owner === viewer), [dueAdvances, viewer]);
  const ownCreditCardExpenses = useMemo(() => allCreditCardExpenses.filter((record) => record.paidBy === viewer), [allCreditCardExpenses, viewer]);
  const ownIncome = incomes.filter((record) => record.owner === viewer).reduce((sum, record) => sum + record.amount, 0);
  const ownPaidNowExpense = expenses.filter((record) => record.paymentMethod !== "credit_card" && record.paidBy === viewer).reduce((sum, record) => sum + record.amount, 0);
  const ownInvestment = investments.filter((record) => record.owner === viewer).reduce((sum, record) => sum + record.amount, 0);
  const ownPaidNowAdvance = advances.filter((record) => record.paymentMethod !== "credit_card" && record.owner === viewer).reduce((sum, record) => sum + record.amount, 0);
  const ownReimbursedAdvance = advances.filter((record) => record.owner === viewer && record.status === "已收回").reduce((sum, record) => sum + record.amount, 0);
  const cardPaymentTotal = ownCardPayments.reduce((sum, record) => sum + record.amount, 0);
  const advanceCashFlow = paidNowAdvance - reimbursedAdvance;
  const familyAvailableBalance = totalIncome - paidNowExpense - paidNowAdvance - totalCardPayment - totalInvestment + reimbursedAdvance;
  const personalCashFlow = ownIncome - ownPaidNowExpense - ownPaidNowAdvance - cardPaymentTotal - ownInvestment + ownReimbursedAdvance;
  const groupedTargets = useMemo(() => groupByTarget(expenses), [expenses]);
  const groupedIncomes = useMemo(() => groupByOwner(incomes), [incomes]);
  const groupedInvestments = useMemo(() => groupByOwner(investments), [investments]);
  const creditCardGroups = useMemo(() => groupDueCreditCardBills(ownDueAdvances, ownCreditCardExpenses, [], selectedMonth), [ownDueAdvances, ownCreditCardExpenses, selectedMonth]);
  const activeLegacyInstallments = useMemo(() => legacyInstallments.filter((record) => record.isActive && (record.owner ?? "chris") === viewer), [legacyInstallments, viewer]);
  const dueCreditCardGroups = useMemo(() => groupDueCreditCardBills(ownDueAdvances, ownCreditCardExpenses, activeLegacyInstallments, dueBillMonth), [ownDueAdvances, ownCreditCardExpenses, activeLegacyInstallments, dueBillMonth]);
  const dueCardSummaries = useMemo(() => Object.entries(dueCreditCardGroups).map(([card, cardRecords]) => {
    const typedCard = card as CreditCardName;
    const payment = ownDueBillPayments.find((item) => item.card === typedCard);
    const isPaid = Boolean(payment);
    const isClosed = isCardStatementClosed(typedCard, dueBillMonth);
    return {
      card: typedCard,
      cardRecords,
      cardTotal: cardRecords.reduce((sum, record) => sum + record.amount, 0),
      payment,
      state: isPaid ? "paid" as const : isClosed ? "due" as const : "estimate" as const,
    };
  }), [dueCreditCardGroups, ownDueBillPayments, dueBillMonth]);
  const dueCreditCardTotal = dueCardSummaries
    .filter((item) => item.state !== "paid")
    .reduce((sum, item) => sum + item.cardTotal + cardPaymentFee(item.card), 0);
  const dueCardCount = dueCardSummaries.filter((item) => item.state === "due").length;
  const estimatedCardCount = dueCardSummaries.filter((item) => item.state === "estimate").length;

  return (
    <section className="home-summary grid">
      <article className="card grid">
        <div className="month-picker">
          <button className="btn secondary" type="button" onClick={() => setSelectedMonth((value) => shiftMonth(value, -1))}>上個月</button>
          <label className="month-field">
            <span>月份</span>
            <input className="input month-input" type="month" value={selectedMonth} onChange={(event) => {
              setSelectedMonth(event.target.value);
              setScope("month");
            }} />
          </label>
          <button className="btn secondary" type="button" onClick={() => setSelectedMonth((value) => shiftMonth(value, 1))}>下個月</button>
        </div>
        <div className="scope-toggle">
          <button className={scope === "month" ? "btn" : "btn secondary"} type="button" onClick={() => {
            setSelectedMonth(currentMonthString());
            setScope("month");
          }}>當月</button>
          <button className={scope === "all" ? "btn" : "btn secondary"} type="button" onClick={() => setScope("all")}>全部月份</button>
        </div>
      </article>

      <article className="card grid">
        <h2>{scope === "month" ? "本月剩餘可用金額" : "目前月份剩餘可用金額"}</h2>
        <div className="row"><span>家庭剩餘</span><strong>{money(familyAvailableBalance)}</strong></div>
        <div className="cashflow-pair">
          <div>
            <span>我的現金流</span>
            <strong>{money(personalCashFlow)}</strong>
          </div>
          <div>
            <span>個人信用卡繳款</span>
            <strong>{money(cardPaymentTotal)}</strong>
          </div>
        </div>
        <div className="row"><span>本月收入</span><strong>{money(totalIncome)}</strong></div>
        <div className="row"><span>已付生活支出</span><strong>{money(paidNowExpense)}</strong></div>
        <div className="row"><span>家庭信用卡繳款</span><strong>{money(totalCardPayment)}</strong></div>
        <div className="row"><span>投資</span><strong>{money(totalInvestment)}</strong></div>
        {advanceCashFlow !== 0 ? <div className="row"><span>代墊款現金流</span><strong>{money(advanceCashFlow)}</strong></div> : null}
        <p className="muted" style={{ margin: 0 }}>家庭剩餘用共同帳本計算；我的現金流只看本人收入、本人付款與本人信用卡繳款。</p>
        {isLoading ? <p className="muted">讀取中...</p> : null}
        {message ? <p className="muted">{message}</p> : null}
      </article>

      <article className="card grid">
        <button className="row" type="button" onClick={() => setShowIncomes((value) => !value)} style={{ border: 0, background: "transparent", padding: 0, textAlign: "left" }}>
          <div><h2 style={{ margin: 0 }}>收入紀錄</h2><div className="muted">點一下看收入明細</div></div>
          <strong>{money(totalIncome)}</strong>
        </button>
        {showIncomes ? <div className="grid">
          {incomes.length === 0 ? <p className="muted">這個月份沒有收入資料</p> : null}
          {Object.entries(groupedIncomes).map(([owner, ownerRecords]) => <div className="card grid" style={{ boxShadow: "none" }} key={owner}>
            <div className="row"><strong>{ownerLabel(owner as "chris" | "wife", viewer)}</strong><strong>{money(ownerRecords.reduce((sum, record) => sum + record.amount, 0))}</strong></div>
            {ownerRecords.map((record) => <div className="record-row" key={record.id}>
              <span className="record-title">{record.date.slice(5)}　{record.category}{record.note ? `・${record.note}` : ""}</span>
              <span className="record-actions"><span className="muted">{money(record.amount)}</span><button className="btn secondary delete-btn" type="button" onClick={() => handleDeleteIncome(record.id)}>刪除</button></span>
            </div>)}
          </div>)}
        </div> : null}
      </article>

      {expenses.length === 0 && !isLoading ? <article className="card grid"><h2>尚無支出</h2><p className="muted" style={{ margin: 0 }}>到「新增」頁儲存第一筆支出後，這裡就會出現正式資料。</p></article> : null}

      {Object.entries(groupedTargets).map(([target, targetRecords]) => {
        const isOpen = openedTarget === target;
        const targetTotal = targetRecords.reduce((sum, record) => sum + record.amount, 0);
        const groupedCategories = groupByCategory(targetRecords);
        const sample = targetRecords[0];
        return <article className="card grid" key={target}>
          <button className="row" type="button" onClick={() => { setOpenedTarget(isOpen ? null : target); setOpenedCategory(null); }} style={{ border: 0, background: "transparent", padding: 0, textAlign: "left" }}>
            <div><h2 style={{ margin: 0 }}>{sample ? displayTarget(sample, viewer) : target}</h2><div className="muted">點一下看分類</div></div>
            <strong>{money(targetTotal)}</strong>
          </button>
          {isOpen ? <div className="grid">{Object.entries(groupedCategories).map(([category, categoryRecords]) => {
            const categoryKey = `${target}-${category}`;
            const isCategoryOpen = openedCategory === categoryKey;
            const categoryTotal = categoryRecords.reduce((sum, record) => sum + record.amount, 0);
            return <div className="card grid" style={{ boxShadow: "none" }} key={categoryKey}>
              <button className="row" type="button" onClick={() => setOpenedCategory(isCategoryOpen ? null : categoryKey)} style={{ border: 0, background: "transparent", padding: 0, textAlign: "left" }}>
                <strong>{category}</strong><span className="muted">{money(categoryTotal)}・{isCategoryOpen ? "收合" : "明細"}</span>
              </button>
              {isCategoryOpen ? <div className="grid">{categoryRecords.map((record) => <div className="record-row" key={record.id}>
                <span className="record-title">{record.date.slice(5)}　{record.isPrivate ? "個人雜支" : record.note || record.category}</span>
                <span className="record-actions"><span className="muted">{money(record.amount)}{record.creditCard ? `・${record.creditCard}` : ""}{record.target === "junyao" ? `・${displayPaidBy(record, viewer)}付` : ""}</span><button className="btn secondary delete-btn" type="button" onClick={() => handleDeleteExpense(record)}>刪除</button></span>
              </div>)}</div> : null}
            </div>;
          })}</div> : null}
        </article>;
      })}

      <article className="card grid">
        <button className="row" type="button" onClick={() => setShowInvestments((value) => !value)} style={{ border: 0, background: "transparent", padding: 0, textAlign: "left" }}>
          <div><h2 style={{ margin: 0 }}>投資紀錄</h2><div className="muted">不列入生活支出，點一下看明細</div></div>
          <strong>{money(totalInvestment)}</strong>
        </button>
        {showInvestments ? <div className="grid">
          {investments.length === 0 ? <p className="muted">這個月份沒有投資紀錄</p> : null}
          {Object.entries(groupedInvestments).map(([owner, ownerRecords]) => <div className="card grid" style={{ boxShadow: "none" }} key={owner}>
            <div className="row"><strong>{ownerLabel(owner as "chris" | "wife", viewer)}</strong><strong>{money(ownerRecords.reduce((sum, record) => sum + record.amount, 0))}</strong></div>
            {ownerRecords.map((record) => <div className="record-row" key={record.id}>
              <span className="record-title">{record.date.slice(5)}　{record.type}・{record.name}{record.note ? `・${record.note}` : ""}</span>
              <span className="record-actions"><span className="muted">{money(record.amount)}</span><button className="btn secondary delete-btn" type="button" onClick={() => handleDeleteInvestment(record.id)}>刪除</button></span>
            </div>)}
          </div>)}
        </div> : null}
      </article>

      <article className="card grid">
        <button className="row" type="button" onClick={() => setShowCreditCards((value) => !value)} style={{ border: 0, background: "transparent", padding: 0, textAlign: "left" }}>
          <div><h2 style={{ margin: 0 }}>信用卡</h2><div className="muted">{dueCardCount > 0 ? `${dueCardCount} 張待繳` : estimatedCardCount > 0 ? `${estimatedCardCount} 張未結帳預估` : "帳單已整理"}</div></div>
          <strong>{money(dueCreditCardTotal)}</strong>
        </button>
        {showCreditCards ? <div className="grid">
          <div className="scope-toggle three-tabs">
            <button className={creditCardTab === "unbilled" ? "btn" : "btn secondary"} type="button" onClick={() => setCreditCardTab("unbilled")}>未出帳</button>
            <button className={creditCardTab === "due" ? "btn" : "btn secondary"} type="button" onClick={() => setCreditCardTab("due")}>待繳帳單</button>
            <button className={creditCardTab === "paid" ? "btn" : "btn secondary"} type="button" onClick={() => setCreditCardTab("paid")}>已繳</button>
          </div>

          {creditCardTab === "due" ? <div className="card grid" style={{ boxShadow: "none" }}>
            <strong>本月預計應繳信用卡（{monthLabel(dueBillMonth)}帳單）</strong>
            <p className="muted" style={{ margin: 0 }}>刷卡日照實填，系統會依各卡結帳日自動歸帳；實際區間會顯示在每張卡的明細中。</p>
            {dueCardSummaries.length === 0 ? <p className="muted">這個繳款月份目前沒有信用卡帳單資料</p> : null}
            {dueCardSummaries.map(({ card, cardRecords, cardTotal, payment, state }) => {
              const detailKey = `due-${card}`;
              const isOpen = Boolean(openedCardDetails[detailKey]);
              const paymentFee = cardPaymentFee(card);
              const payableTotal = cardTotal + paymentFee;
              return <div className="card credit-card-summary grid" style={{ boxShadow: "none" }} key={detailKey}>
                <div className="row">
                  <div><strong>{card}</strong><div className="muted">{cardRecords.length} 筆明細</div></div>
                  <strong>{money(payableTotal)}</strong>
                </div>
                <div className="credit-card-meta">
                  <span>{cardStatementLabel(card as CreditCardName, dueBillMonth)}</span>
                  <span>{cardStatementStatusLabel(card as CreditCardName, dueBillMonth)}</span>
                  {statusBadge(state)}
                </div>
                {paymentFee > 0 ? <div className="muted">刷卡合計 {money(cardTotal)}，他行扣款手續費 {money(paymentFee)}</div> : null}
                {payment ? <div className="muted">繳款日：{payment.paidDate}・{money(payment.amount)}</div> : null}
                {state === "due" ? <button className="btn" type="button" onClick={() => handleCreateCardPayment(card, cardTotal, dueBillMonth)}>建立繳款紀錄</button> : null}
                {state === "estimate" ? <button className="btn secondary" type="button" disabled>未結帳，先核對明細</button> : null}
                {payment ? <button className="btn secondary" type="button" onClick={() => handleDeleteCardPayment(payment)}>取消繳款紀錄</button> : null}
                <button className="btn secondary compact-btn" type="button" onClick={() => toggleCardDetails(detailKey)}>{isOpen ? "收合明細" : "查看明細"}</button>
                {isOpen ? <div className="credit-card-lines">
                  {cardRecords.map((record, index) => <div className="credit-card-line" key={`${card}-${record.date}-${index}`}>
                    <div>
                      <strong>{record.date.slice(5)}　{cardLineTitle(record)}</strong>
                      <div className="muted">{cardLineMeta(record, viewer)}</div>
                    </div>
                    <div className="credit-card-line-side">
                      <span>{money(record.amount)}</span>
                      {record.sourceExpense?.installment?.enabled ? <button className="btn secondary delete-btn" type="button" onClick={() => record.sourceExpense ? handleUpdateInstallmentFirstBillMonth(record.sourceExpense) : undefined}>修改</button> : null}
                    </div>
                  </div>)}
                </div> : null}
              </div>;
            })}
            {activeLegacyInstallments.length > 0 ? <div className="card grid" style={{ boxShadow: "none" }}>
              <strong>啟用中的記帳前分期</strong>
              <p className="muted" style={{ margin: 0 }}>這些會自動併入對應月份的待繳帳單。</p>
              {activeLegacyInstallments.map((record) => {
                const display = legacyInstallmentDisplay(record, dueBillMonth);
                return <div className="record-row" key={record.id}>
                  <span className="record-title">{record.card}・{record.name}・{display.label}</span>
                  <span className="muted">{money(record.amount)}{display.isDue ? "・本月應繳" : ""}</span>
                </div>;
              })}
            </div> : null}
          </div> : null}

          {creditCardTab === "unbilled" ? <div className="card grid" style={{ boxShadow: "none" }}>
            <strong>未出帳明細（{monthLabel(selectedMonth)}帳單）</strong>
            <div className="muted">已刷卡但尚未繳款前可先在這裡核對；實際是否出帳依各卡結帳日為準。</div>
            {Object.keys(creditCardGroups).length === 0 ? <p className="muted">目前沒有未出帳信用卡明細</p> : null}
            {Object.entries(creditCardGroups).map(([card, cardRecords]) => {
              const cardTotal = cardRecords.reduce((sum, record) => sum + record.amount, 0);
              const detailKey = `unbilled-${card}`;
              const isOpen = Boolean(openedCardDetails[detailKey]);
              return <div className="card credit-card-summary grid" style={{ boxShadow: "none" }} key={detailKey}>
                <div className="row">
                  <div><strong>{card}</strong><div className="muted">{cardRecords.length} 筆明細</div></div>
                  <strong>{money(cardTotal)}</strong>
                </div>
                <div className="credit-card-meta">
                  <span>{cardStatementLabel(card as CreditCardName, selectedMonth)}</span>
                  <span>{cardStatementStatusLabel(card as CreditCardName, selectedMonth)}</span>
                </div>
                <button className="btn secondary compact-btn" type="button" onClick={() => toggleCardDetails(detailKey)}>{isOpen ? "收合明細" : "查看明細"}</button>
                {isOpen ? <div className="credit-card-lines">
                  {cardRecords.map((record, index) => <div className="credit-card-line" key={`${card}-${record.date}-${index}`}>
                    <div>
                      <strong>{record.date.slice(5)}　{cardLineTitle(record)}</strong>
                      <div className="muted">{cardLineMeta(record, viewer)}</div>
                    </div>
                    <div className="credit-card-line-side">
                      <span>{money(record.amount)}</span>
                      {record.sourceExpense?.installment?.enabled ? <button className="btn secondary delete-btn" type="button" onClick={() => record.sourceExpense ? handleUpdateInstallmentFirstBillMonth(record.sourceExpense) : undefined}>修改</button> : null}
                    </div>
                  </div>)}
                </div> : null}
              </div>;
            })}
          </div> : null}

          {creditCardTab === "paid" ? <div className="card grid" style={{ boxShadow: "none" }}>
            <strong>本月已繳信用卡</strong>
            {ownCardPayments.length === 0 ? <p className="muted">這個月份還沒有你的信用卡繳款紀錄</p> : null}
            {ownCardPayments.map((payment) => <div className="row" key={payment.id}><span>{payment.date.slice(5)}　{payment.card}・{payment.billMonth}帳單</span><span className="muted">{money(payment.amount)}</span></div>)}
          </div> : null}
        </div> : null}
      </article>

      {pendingAdvance > 0 ? <article className="card grid">
        <button className="row" type="button" onClick={() => setShowAdvances((value) => !value)} style={{ border: 0, background: "transparent", padding: 0, textAlign: "left" }}>
          <div><h2 style={{ margin: 0 }}>代墊款</h2><div className="muted">尚未銷帳時才顯示，點一下看明細</div></div>
          <strong>{money(pendingAdvance)}</strong>
        </button>
        {showAdvances ? <div className="grid">{pendingAdvanceRecords.map((record) => <div className="card grid" style={{ boxShadow: "none" }} key={record.id}>
          <div className="row"><span>{record.date.slice(5)}　{record.item}{record.note ? `・${record.note}` : ""}</span><strong>{money(record.amount)}</strong></div>
          <div className="muted">{record.status}{record.creditCard ? `・${record.creditCard}` : ""}</div>
          <div className="row">
            <button className="btn secondary" type="button" onClick={() => handleAdvanceStatus(record, "已送件")}>已送件</button>
            <button className="btn secondary" type="button" onClick={() => handleAdvanceStatus(record, "已收回")}>已收回</button>
            <button className="btn secondary" type="button" onClick={() => handleDeleteAdvance(record.id)}>刪除</button>
          </div>
        </div>)}</div> : null}
      </article> : null}
    </section>
  );
}
