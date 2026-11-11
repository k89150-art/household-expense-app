"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCurrentUser } from "@/components/AuthGate";
import { IncomeEditForm } from "@/components/IncomeEditForm";
import { LoanRepaymentForm } from "@/components/LoanRepaymentForm";
import { reimbursedAdvancesForPeriod } from "@/lib/advanceCashFlow";
import { cardActivityRange, cardStatementLabel, isInCardStatement, monthDiff, monthLabel, nextLegacyInstallmentState, shiftMonth, statementRangeForCard } from "@/lib/cardBilling";
import { categoryLabel } from "@/lib/categories";
import { currentMonthString, localDateString } from "@/lib/date";
import {
  addCardPaymentRecord,
  deleteAdvanceRecord,
  deleteCardPaymentRecord,
  deleteExpenseRecord,
  deleteIncomeRecord,
  getAllAdvanceRecords,
  getAllCardPaymentRecords,
  getAllExpenseRecords,
  getAllIncomeRecords,
  getAllLoanRepayments,
  getCardPaymentRecordsByBillMonth,
  getCardPaymentRecordsFromBillMonth,
  getCardPaymentRecordsByMonth,
  getCreditCardExpenseRecords,
  getExpenseRecordsByMonth,
  getIncomeRecordsByMonth,
  getLegacyInstallmentRecords,
  updateAdvanceRecord,
  updateExpenseRecord,
  updateIncomeRecord,
  updateLegacyInstallmentRecord,
  saveLoanRepayment,
  setLoanRepaymentStatus,
} from "@/lib/records";
import type {
  AdvanceRecord,
  CardPaymentRecord,
  CreditCardName,
  ExpenseRecord,
  IncomeRecord,
  InstallmentInfo,
  InstallmentScheduleItem,
  LegacyInstallmentRecord,
} from "@/lib/records";
import type { Viewer } from "@/lib/household";
import type { IncomeRecordChanges } from "@/lib/incomeEdit";
import { isLoanExpenseCandidate } from "@/lib/loanRepayment";
import { LOAN_KEY_LABELS } from "@/types/loanRepayment";
import type { LoanRepaymentFields, LoanRepaymentRecord } from "@/types/loanRepayment";

type Scope = "month" | "all";
type CreditCardTab = "due" | "unbilled" | "paid";
type RecordFilter = "all" | "expense" | "income";
const RECORD_FILTERS: [RecordFilter, string][] = [["all", "全部"], ["expense", "支出"], ["income", "收入"]];
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
type RecordItemBase = { key: string; date: string; amount: number; badge: string; title: string; meta: string; status: string; statusTone: "" | "warn" | "ok" | "void"; searchable: string };
type RecordItem = (RecordItemBase & { kind: "expense"; expense: ExpenseRecord; canRepay: boolean }) | (RecordItemBase & { kind: "income"; income: IncomeRecord });

type Props = { viewer: Viewer; refreshKey?: number; view?: "home" | "records"; onOpenRecords?: () => void };
type CardLine = { date: string; label: string; amount: number; kind: "expense" | "advance" | "installment" | "legacyInstallment"; sourceExpense?: ExpenseRecord };
const CARD_PAYMENT_FEES: Partial<Record<CreditCardName, number>> = {
  中信: 10,
};

const TARGET_LABELS: Record<string, string> = { chris: "我", wife: "我", junyao: "竣堯", cat: "貓" };

function paymentLabel(record: ExpenseRecord) {
  if (record.paymentMethod === "credit_card") return record.creditCard ? `信用卡 ${record.creditCard}` : "信用卡";
  if (record.paymentMethod === "cash") return "現金";
  if (record.paymentMethod === "bank_transfer") return "扣款／轉帳";
  return "其他";
}

function money(value = 0) {
  return `$${value.toLocaleString("zh-TW")}`;
}

function cardPaymentFee(card: CreditCardName) {
  return CARD_PAYMENT_FEES[card] ?? 0;
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

function paidLegacyInstallments(payment: CardPaymentRecord, records: LegacyInstallmentRecord[]) {
  return (payment.legacyInstallmentAdjustments ?? []).flatMap((adjustment) => {
    const record = records.find((item) => item.id === adjustment.id);
    if (!record) return [];
    return [{
      id: record.id,
      name: record.name,
      amount: record.amount,
      installmentNo: adjustment.nextInstallmentNo,
      totalInstallments: record.totalInstallments,
      isFinal: adjustment.nextInstallmentNo >= record.totalInstallments,
    }];
  });
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

export function FirestoreHomeSummary({ viewer, refreshKey = 0, view = "home", onOpenRecords }: Props) {
  const user = useCurrentUser();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthString());
  const [scope, setScope] = useState<Scope>("month");
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);
  const [allAdvances, setAllAdvances] = useState<AdvanceRecord[]>([]);
  const [dueAdvances, setDueAdvances] = useState<AdvanceRecord[]>([]);
  const [allCreditCardExpenses, setAllCreditCardExpenses] = useState<ExpenseRecord[]>([]);
  const [cardPayments, setCardPayments] = useState<CardPaymentRecord[]>([]);
  const [dueBillPayments, setDueBillPayments] = useState<CardPaymentRecord[]>([]);
  const [legacyInstallments, setLegacyInstallments] = useState<LegacyInstallmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recordFilter, setRecordFilter] = useState<RecordFilter>("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [showAdvances, setShowAdvances] = useState(false);
  const [showCreditCards, setShowCreditCards] = useState(false);
  const [creditCardTab, setCreditCardTab] = useState<CreditCardTab>("unbilled");
  const [openedCardDetails, setOpenedCardDetails] = useState<Record<string, boolean>>({});
  const [statementAmountDrafts, setStatementAmountDrafts] = useState<Record<string, string>>({});
  const [editingInstallmentId, setEditingInstallmentId] = useState<string | null>(null);
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  // 房貸／增貸還款明細（依支出 ID）；null 表示目前讀不到（例如 Rules 尚未部署），不影響其他功能。
  const [loanRepayments, setLoanRepayments] = useState<Record<string, LoanRepaymentRecord> | null>({});
  const [editingRepaymentId, setEditingRepaymentId] = useState<string | null>(null);
  const [installmentMonthDraft, setInstallmentMonthDraft] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const mutationLockRef = useRef(false);
  const [message, setMessage] = useState("");

  async function loadRecords() {
    setIsLoading(true);
    setMessage("");
    try {
      const dueBillMonth = shiftMonth(selectedMonth, -1);
      const activityRange = cardActivityRange([dueBillMonth, selectedMonth]);
      const [expenseData, incomeData, allAdvanceData, allCardExpenseData, paymentData, duePaymentData, legacyInstallmentData] = await Promise.all([
        scope === "month" ? getExpenseRecordsByMonth(selectedMonth) : getAllExpenseRecords(),
        scope === "month" ? getIncomeRecordsByMonth(selectedMonth) : getAllIncomeRecords(),
        getAllAdvanceRecords(),
        getCreditCardExpenseRecords(),
        scope === "month" ? getCardPaymentRecordsByMonth(selectedMonth) : getAllCardPaymentRecords(),
        getCardPaymentRecordsByBillMonth(dueBillMonth),
        getLegacyInstallmentRecords(),
      ]);
      const activeViewerInstallments = legacyInstallmentData.filter((record) =>
        record.isActive && (record.owner ?? "chris") === viewer
      );
      const earliestInstallmentMonth = activeViewerInstallments
        .map((record) => record.nextBillMonth)
        .sort()[0];
      const allPaymentData = earliestInstallmentMonth
        ? await getCardPaymentRecordsFromBillMonth(earliestInstallmentMonth)
        : [];
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
      setAdvances(scope === "month" ? allAdvanceData.filter((record) => record.date.startsWith(selectedMonth)) : allAdvanceData);
      setAllAdvances(allAdvanceData);
      setDueAdvances(allAdvanceData.filter((record) => record.date >= activityRange.startDate && record.date <= activityRange.endDate));
      setAllCreditCardExpenses(allCardExpenseData);
      setCardPayments(paymentData);
      setDueBillPayments(duePaymentData);
      setLegacyInstallments(syncedLegacyInstallments);
      const repaymentData = await getAllLoanRepayments().catch((error: unknown) => { console.error(error); return null; });
      setLoanRepayments(repaymentData ? Object.fromEntries(repaymentData.map((item) => [item.id, item])) : null);
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

  async function runMutation(actionName: string, action: () => Promise<void>) {
    if (mutationLockRef.current) return;
    mutationLockRef.current = true;
    setPendingAction(actionName);
    setMessage("");
    try {
      await action();
      await loadRecords();
    } catch (error) {
      console.error(error);
      setMessage(`${actionName}失敗，請稍後再試。錯誤：${getErrorCode(error)}`);
    } finally {
      mutationLockRef.current = false;
      setPendingAction(null);
    }
  }

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
    await runMutation("刪除支出", () => deleteExpenseRecord(record.id, user.uid));
  }

  async function handleSaveRepayment(record: ExpenseRecord, fields: LoanRepaymentFields) {
    if (!user) {
      setMessage("請先登入。");
      return;
    }
    await runMutation("儲存還款明細", async () => {
      await saveLoanRepayment(record.id, fields, loanRepayments?.[record.id] ?? null, user.uid);
      setEditingRepaymentId(null);
    });
  }

  async function handleRepaymentStatus(record: ExpenseRecord, status: LoanRepaymentFields["status"]) {
    await runMutation(status === "VOID" ? "作廢還款明細" : "還原還款明細", async () => {
      await setLoanRepaymentStatus(record.id, status);
      setEditingRepaymentId(null);
    });
  }

  async function handleUpdateIncome(id: string, changes: IncomeRecordChanges) {
    await runMutation("修改收入", async () => {
      await updateIncomeRecord(id, changes);
      setEditingIncomeId(null);
    });
  }

  async function handleDeleteIncome(id: string) {
    if (!window.confirm("確定要刪除這筆收入嗎？")) return;
    await runMutation("刪除收入", () => deleteIncomeRecord(id));
  }

  async function handleDeleteAdvance(id: string) {
    if (!window.confirm("確定要刪除這筆代墊款嗎？")) return;
    await runMutation("刪除代墊款", () => deleteAdvanceRecord(id));
  }

  async function handleAdvanceStatus(record: AdvanceRecord, status: AdvanceRecord["status"]) {
    if (!window.confirm(`確定要把「${record.item}」改成${status}嗎？`)) return;
    await runMutation("更新代墊款狀態", () => updateAdvanceRecord(record.id, {
      status,
      reimbursedDate: status === "已收回" ? localDateString() : null,
    }));
  }

  async function handleUpdateInstallmentFirstBillMonth(record: ExpenseRecord, nextMonth: string) {
    const installment = record.installment;
    if (!installment?.enabled) return;
    if (!isValidMonth(nextMonth)) {
      setMessage("月份格式錯誤，請輸入例如 2026-09。");
      return;
    }
    await runMutation("更新分期月份", () => updateExpenseRecord(record.id, {
      installment: {
        ...installment,
        firstBillMonth: nextMonth,
        schedule: splitInstallmentAmount(installment.totalPayable, installment.total, nextMonth),
      },
    }));
    setEditingInstallmentId(null);
    setInstallmentMonthDraft("");
  }

  function installmentMonthEditor(record: ExpenseRecord) {
    const installment = record.installment;
    if (!installment?.enabled) return null;
    if (editingInstallmentId !== record.id) {
      return <button className="btn secondary delete-btn" type="button" disabled={pendingAction !== null} onClick={() => {
        setEditingInstallmentId(record.id);
        setInstallmentMonthDraft(installment.firstBillMonth);
      }}>修改</button>;
    }
    return <div className="installment-month-editor">
      <input className="input" type="month" aria-label="第一期帳單月份" value={installmentMonthDraft} onChange={(event) => setInstallmentMonthDraft(event.target.value)} />
      <button className="btn secondary compact-btn" type="button" disabled={pendingAction !== null || !isValidMonth(installmentMonthDraft)} onClick={() => handleUpdateInstallmentFirstBillMonth(record, installmentMonthDraft)}>儲存</button>
      <button className="btn secondary compact-btn" type="button" disabled={pendingAction !== null} onClick={() => {
        setEditingInstallmentId(null);
        setInstallmentMonthDraft("");
      }}>取消</button>
    </div>;
  }

  async function handleCreateCardPayment(card: string, statementAmount: number, systemAmount: number, billMonth: string) {
    if (!user) {
      setMessage("請先登入。");
      return;
    }
    const typedCard = card as CreditCardName;
    if (dueBillPayments.some((payment) =>
      payment.owner === viewer &&
      payment.card === typedCard &&
      payment.billMonth === billMonth
    )) {
      setMessage(`${card} ${billMonth} 已有繳款紀錄，不會重複建立。`);
      return;
    }
    const fee = cardPaymentFee(typedCard);
    const paymentAmount = statementAmount + fee;
    const difference = statementAmount - systemAmount;
    const feeText = fee > 0 ? `（含他行扣款手續費 ${money(fee)}）` : "";
    const differenceText = difference === 0 ? "與系統明細相符" : `與系統明細相差 ${money(difference)}`;
    if (!window.confirm(`確定要建立 ${card} ${billMonth} 帳單繳款 ${money(paymentAmount)} ${feeText}嗎？\n實際帳單 ${money(statementAmount)}，${differenceText}。`)) return;
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
    await runMutation("建立信用卡繳款", () => addCardPaymentRecord({
      date: localDateString(),
      amount: paymentAmount,
      owner: viewer,
      card: typedCard,
      billMonth,
      status: "已繳款",
      paidDate: localDateString(),
      note: `${billMonth} ${card}帳單繳款；系統明細 ${systemAmount} 元，實際帳單 ${statementAmount} 元，差額 ${difference} 元${fee > 0 ? `，另含他行扣款手續費 ${fee} 元` : ""}`,
      legacyInstallmentAdjustments,
      createdBy: user.uid,
    }, legacyInstallmentUpdates));
  }

  async function handleDeleteCardPayment(payment: CardPaymentRecord) {
    if (!window.confirm("確定要取消這筆信用卡繳款紀錄嗎？")) return;
    await runMutation("取消信用卡繳款", () => deleteCardPaymentRecord(payment.id, payment.legacyInstallmentAdjustments ?? []));
  }

  function toggleCardDetails(key: string) {
    setOpenedCardDetails((current) => ({ ...current, [key]: !current[key] }));
  }

  const dueBillMonth = shiftMonth(selectedMonth, -1);
  const totalIncome = incomes.reduce((sum, record) => sum + record.amount, 0);
  const paidNowExpense = expenses.filter((record) => record.paymentMethod !== "credit_card").reduce((sum, record) => sum + record.amount, 0);
  const pendingAdvanceRecords = advances.filter((record) => record.status !== "已收回");
  const paidNowAdvance = advances.filter((record) => record.paymentMethod !== "credit_card").reduce((sum, record) => sum + record.amount, 0);
  const pendingAdvance = pendingAdvanceRecords.reduce((sum, record) => sum + record.amount, 0);
  const reimbursementRecords = scope === "month"
    ? reimbursedAdvancesForPeriod(allAdvances, `${selectedMonth}-01`, `${selectedMonth}-31`)
    : allAdvances.filter((record) => record.status === "已收回");
  const reimbursedAdvance = reimbursementRecords.reduce((sum, record) => sum + record.amount, 0);
  const totalCardPayment = cardPayments.reduce((sum, record) => sum + record.amount, 0);
  const ownCardPayments = useMemo(() => cardPayments.filter((record) => record.owner === viewer), [cardPayments, viewer]);
  const ownDueBillPayments = useMemo(() => dueBillPayments.filter((record) => record.owner === viewer), [dueBillPayments, viewer]);
  const ownDueAdvances = useMemo(() => dueAdvances.filter((record) => record.owner === viewer), [dueAdvances, viewer]);
  const ownCreditCardExpenses = useMemo(() => allCreditCardExpenses.filter((record) => record.paidBy === viewer), [allCreditCardExpenses, viewer]);
  const ownIncome = incomes.filter((record) => record.owner === viewer).reduce((sum, record) => sum + record.amount, 0);
  const ownPaidNowExpense = expenses.filter((record) => record.paymentMethod !== "credit_card" && record.paidBy === viewer).reduce((sum, record) => sum + record.amount, 0);
  const ownPaidNowAdvance = advances.filter((record) => record.paymentMethod !== "credit_card" && record.owner === viewer).reduce((sum, record) => sum + record.amount, 0);
  const ownReimbursedAdvance = reimbursementRecords.filter((record) => record.owner === viewer).reduce((sum, record) => sum + record.amount, 0);
  const cardPaymentTotal = ownCardPayments.reduce((sum, record) => sum + record.amount, 0);
  const familyAvailableBalance = totalIncome - paidNowExpense - paidNowAdvance - totalCardPayment + reimbursedAdvance;
  const personalCashFlow = ownIncome - ownPaidNowExpense - ownPaidNowAdvance - cardPaymentTotal + ownReimbursedAdvance;
  // 首頁：環形圖（本月已付出佔收入比例）、前三名分類、最近紀錄
  const familyOutflow = Math.max(0, totalIncome - familyAvailableBalance);
  const spentPercent = totalIncome > 0 ? Math.min(100, Math.round((familyOutflow / totalIncome) * 100)) : familyOutflow > 0 ? 100 : 0;
  const categoryTotals = expenses.reduce<Record<string, number>>((totals, record) => {
    totals[record.category] = (totals[record.category] ?? 0) + record.amount;
    return totals;
  }, {});
  const topCategoryEntries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topCategoryMax = topCategoryEntries[0]?.[1] ?? 0;
  const topCategories = topCategoryEntries.map(([category, amount]) => ({
    category,
    label: categoryLabel(category),
    amount,
    percent: topCategoryMax > 0 ? Math.max(4, Math.round((amount / topCategoryMax) * 100)) : 0,
  }));
  const recentRecords = [
    ...expenses.map((record) => ({
      key: `e-${record.id}`,
      kind: "expense" as const,
      date: record.date,
      amount: record.amount,
      badge: categoryLabel(record.category).slice(0, 2),
      title: record.note || categoryLabel(record.category),
      meta: [record.date.slice(5).replace("-", "/"), categoryLabel(record.category), paymentLabel(record)].join(" · "),
    })),
    ...incomes.map((record) => ({
      key: `i-${record.id}`,
      kind: "income" as const,
      date: record.date,
      amount: record.amount,
      badge: "收入",
      title: record.note || record.category,
      meta: [record.date.slice(5).replace("-", "/"), record.category, ownerLabel(record.owner, viewer)].join(" · "),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  // 紀錄頁：篩選、搜尋、依日期分組（只做畫面整理，不改變任何計算）
  const normalizedKeyword = keyword.trim().toLocaleLowerCase("zh-TW");
  const recordItems: RecordItem[] = [
    ...(recordFilter === "income" ? [] : expenses.filter((record) => !mineOnly || record.paidBy === viewer).map((record): RecordItem => {
      const repayment = loanRepayments?.[record.id];
      const title = record.isPrivate ? "個人雜支" : record.note || categoryLabel(record.category);
      const meta = [
        categoryLabel(record.category),
        paymentLabel(record),
        displayTarget(record, viewer),
        record.target === "junyao" ? `${displayPaidBy(record, viewer)}付` : "",
      ].filter(Boolean).join(" · ");
      const status = repayment
        ? `${LOAN_KEY_LABELS[repayment.loanKey]}${repayment.status === "VOID" ? "明細已作廢" : repayment.stage === "PENDING_DEBIT" ? `待銀行扣款・預定 ${repayment.dueDate.slice(5)}` : `銀行已扣款・本金 ${money(repayment.principal)}`}`
        : "";
      const statusTone = !repayment ? "" : repayment.status === "VOID" ? "void" : repayment.stage === "PENDING_DEBIT" ? "warn" : "ok";
      return {
        key: `e-${record.id}`, kind: "expense", expense: record, date: record.date, amount: record.amount,
        badge: record.isPrivate ? "個人" : categoryLabel(record.category).slice(0, 2), title, meta, status, statusTone,
        canRepay: Boolean(loanRepayments && (repayment || isLoanExpenseCandidate(record))),
        searchable: [title, record.isPrivate ? "" : record.note, record.category, meta, status, String(record.amount), record.date].filter(Boolean).join(" ").toLocaleLowerCase("zh-TW"),
      };
    })),
    ...(recordFilter === "expense" ? [] : incomes.filter((record) => !mineOnly || record.owner === viewer).map((record): RecordItem => {
      const title = record.note || record.category;
      const meta = [record.category, ownerLabel(record.owner, viewer)].join(" · ");
      return {
        key: `i-${record.id}`, kind: "income", income: record, date: record.date, amount: record.amount,
        badge: "收入", title, meta, status: "", statusTone: "",
        searchable: [title, record.category, record.note, meta, String(record.amount), record.date].filter(Boolean).join(" ").toLocaleLowerCase("zh-TW"),
      };
    })),
  ].filter((item) => !normalizedKeyword || item.searchable.includes(normalizedKeyword))
    .sort((a, b) => b.date.localeCompare(a.date));
  const listExpenseTotal = recordItems.reduce((sum, item) => sum + (item.kind === "expense" ? item.amount : 0), 0);
  const listIncomeTotal = recordItems.reduce((sum, item) => sum + (item.kind === "income" ? item.amount : 0), 0);
  const recordGroups = recordItems.reduce<{ date: string; label: string; items: RecordItem[] }[]>((groups, item) => {
    const last = groups.at(-1);
    if (last && last.date === item.date) {
      last.items.push(item);
    } else {
      const weekday = WEEKDAYS[new Date(`${item.date}T00:00:00`).getDay()];
      const label = scope === "all" ? `${item.date.replace(/-/g, "/")} 週${weekday}` : `${item.date.slice(5).replace("-", "/")} 週${weekday}`;
      groups.push({ date: item.date, label, items: [item] });
    }
    return groups;
  }, []);
  const activeLegacyInstallments = useMemo(() => legacyInstallments.filter((record) => record.isActive && (record.owner ?? "chris") === viewer), [legacyInstallments, viewer]);
  const creditCardGroups = useMemo(() => groupDueCreditCardBills(ownDueAdvances, ownCreditCardExpenses, activeLegacyInstallments, selectedMonth), [ownDueAdvances, ownCreditCardExpenses, activeLegacyInstallments, selectedMonth]);
  const dueCreditCardGroups = useMemo(() => groupDueCreditCardBills(ownDueAdvances, ownCreditCardExpenses, activeLegacyInstallments, dueBillMonth), [ownDueAdvances, ownCreditCardExpenses, activeLegacyInstallments, dueBillMonth]);
  const dueCardSummaries = useMemo(() => {
    const cards = Array.from(new Set([
      ...Object.keys(dueCreditCardGroups),
      ...ownDueBillPayments.map((payment) => payment.card),
    ]));
    return cards.map((card) => {
    const typedCard = card as CreditCardName;
    const currentCardRecords = dueCreditCardGroups[card] ?? [];
    const payment = ownDueBillPayments.find((item) => item.card === typedCard);
    const isPaid = Boolean(payment);
    const isClosed = isCardStatementClosed(typedCard, dueBillMonth);
    const historicalInstallments: CardLine[] = payment ? paidLegacyInstallments(payment, legacyInstallments).map((record) => ({
      date: `${dueBillMonth}-01`,
      label: `${record.name}・記帳前分期 ${record.installmentNo}/${record.totalInstallments}`,
      amount: record.amount,
      kind: "legacyInstallment",
    })) : [];
    const recordedCardRecords = [...currentCardRecords, ...historicalInstallments];
    const recordedTotal = recordedCardRecords.reduce((sum, record) => sum + record.amount, 0);
    const paymentFee = cardPaymentFee(typedCard);
    const adjustment = payment ? payment.amount - recordedTotal - paymentFee : 0;
    const cardRecords: CardLine[] = adjustment !== 0 ? [
      ...recordedCardRecords,
      {
        date: payment?.paidDate ?? `${dueBillMonth}-01`,
        label: "實際帳單調整差額",
        amount: adjustment,
        kind: "expense",
      },
    ] : recordedCardRecords;
    return {
      card: typedCard,
      cardRecords,
      cardTotal: cardRecords.reduce((sum, record) => sum + record.amount, 0),
      payment,
      state: isPaid ? "paid" as const : isClosed ? "due" as const : "estimate" as const,
    };
  });
  }, [dueCreditCardGroups, ownDueBillPayments, dueBillMonth, legacyInstallments]);
  const dueCreditCardTotal = dueCardSummaries
    .filter((item) => item.state !== "paid")
    .reduce((sum, item) => {
      const draftAmount = Number(statementAmountDrafts[`due-${item.card}`]);
      const reconciledAmount = item.state === "due" && Number.isInteger(draftAmount) && draftAmount > 0
        ? draftAmount
        : item.cardTotal;
      return sum + reconciledAmount + cardPaymentFee(item.card);
    }, 0);
  const dueCardCount = dueCardSummaries.filter((item) => item.state === "due").length;
  const estimatedCardCount = dueCardSummaries.filter((item) => item.state === "estimate").length;

  return (
    <section className="home-summary grid">
      {/* 首頁固定顯示本月；查其他月份請到「紀錄」頁 */}
      {view === "records" ? <>
      <div className="month-bar">
        <button className="icon-btn" type="button" aria-label="上個月" onClick={() => { setScope("month"); setSelectedMonth((value) => shiftMonth(value, -1)); }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <input className="month-bar-input" type="month" aria-label="月份" value={selectedMonth} onChange={(event) => { setSelectedMonth(event.target.value); setScope("month"); }} />
        <button className="icon-btn" type="button" aria-label="下個月" onClick={() => { setScope("month"); setSelectedMonth((value) => shiftMonth(value, 1)); }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>
      </> : null}

      {view === "home" ? <>
      <article className="card summary-hero home-hero">
        <div className="home-ring" role="img" aria-label={`本月已付出 ${spentPercent}%`} style={{ background: `conic-gradient(var(--accent) 0 ${spentPercent}%, var(--paper-warm) ${spentPercent}% 100%)` }}>
          <div className="home-ring-inner">
            <span>本月剩餘</span>
            <strong>{money(familyAvailableBalance)}</strong>
            <span>已付出 {spentPercent}%</span>
          </div>
        </div>
        <div className="home-hero-stats">
          <div><span>收入</span><strong className="positive">{money(totalIncome)}</strong></div>
          <div><span>已付出</span><strong>{money(familyOutflow)}</strong></div>
          <div><span>我的現金流</span><strong>{money(personalCashFlow)}</strong></div>
        </div>
        {isLoading ? <p className="muted home-hero-note">讀取中...</p> : null}
        {message ? <p className="muted home-hero-note">{message}</p> : null}
      </article>

      {topCategories.length > 0 ? <div className="home-top-categories">
        {topCategories.map((item) => <div className="home-top-category" key={item.category}>
          <span>{item.label}</span>
          <strong>{money(item.amount)}</strong>
          <div className="home-bar"><span style={{ width: `${item.percent}%` }} /></div>
        </div>)}
      </div> : null}

      <article className="card home-recent">
        <div className="home-recent-head">
          <h2>最近紀錄</h2>
          {onOpenRecords ? <button className="link-btn" type="button" onClick={onOpenRecords}>全部</button> : null}
        </div>
        {recentRecords.length === 0 && !isLoading ? <p className="muted" style={{ margin: 0 }}>這個月還沒有紀錄</p> : null}
        {recentRecords.map((item) => <div className="home-recent-row" key={item.key}>
          <span className={item.kind === "income" ? "home-recent-icon income" : "home-recent-icon"}>{item.badge}</span>
          <span className="home-recent-main"><span>{item.title}</span><span className="muted">{item.meta}</span></span>
          <strong className={item.kind === "income" ? "positive" : undefined}>{item.kind === "income" ? "+" : "−"}{money(item.amount)}</strong>
        </div>)}
      </article>
      </> : null}

      {view === "records" ? <>
      {isLoading || message ? <p className="muted records-note">{isLoading ? "讀取中..." : message}</p> : null}
      <div className="records-toolbar">
        <input className="input" type="search" aria-label="搜尋紀錄" placeholder="搜尋備註、分類、金額" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        <div className="filter-chips" role="group" aria-label="篩選紀錄">
          {RECORD_FILTERS.map(([value, label]) => <button key={value} className={recordFilter === value ? "chip active" : "chip"} type="button" aria-pressed={recordFilter === value} onClick={() => setRecordFilter(value)}>{label}</button>)}
          <button className={mineOnly ? "chip active" : "chip"} type="button" aria-pressed={mineOnly} onClick={() => setMineOnly((value) => !value)}>只看我的</button>
          {scope === "month" && selectedMonth !== currentMonthString() ? <button className="chip" type="button" onClick={() => setSelectedMonth(currentMonthString())}>回本月</button> : null}
          <button className={scope === "all" ? "chip active" : "chip"} type="button" aria-pressed={scope === "all"} onClick={() => setScope(scope === "all" ? "month" : "all")}>全部月份</button>
        </div>
        <div className="records-totals">
          <span>支出 <strong>{money(listExpenseTotal)}</strong></span>
          <span>收入 <strong className="positive">{money(listIncomeTotal)}</strong></span>
        </div>
      </div>

      {recordGroups.length === 0 && !isLoading ? <article className="card"><p className="muted" style={{ margin: 0 }}>{expenses.length === 0 && incomes.length === 0 ? "這段期間還沒有紀錄。按下方「＋」新增第一筆。" : "沒有符合條件的紀錄。"}</p></article> : null}

      {recordGroups.map((group) => {
        const dayExpense = group.items.reduce((sum, item) => sum + (item.kind === "expense" ? item.amount : 0), 0);
        const dayIncome = group.items.reduce((sum, item) => sum + (item.kind === "income" ? item.amount : 0), 0);
        return <section className="records-day" key={group.date}>
          <div className="records-day-head">
            <span>{group.label}</span>
            <span>{[dayExpense > 0 ? `支出 ${money(dayExpense)}` : "", dayIncome > 0 ? `收入 ${money(dayIncome)}` : ""].filter(Boolean).join("・")}</span>
          </div>
          <div className="card records-list">
            {group.items.map((item) => {
              const isOpen = expandedKey === item.key;
              return <div className="records-item" key={item.key}>
                <button className="records-row" type="button" aria-expanded={isOpen} onClick={() => setExpandedKey(isOpen ? null : item.key)}>
                  <span className={item.kind === "income" ? "home-recent-icon income" : "home-recent-icon"}>{item.badge}</span>
                  <span className="home-recent-main">
                    <span>{item.title}</span>
                    <span className="muted">{item.meta}</span>
                    {item.status ? <span className={`status-tag ${item.statusTone}`}>{item.status}</span> : null}
                  </span>
                  <strong className={item.kind === "income" ? "positive" : undefined}>{item.kind === "income" ? "+" : "−"}{money(item.amount)}</strong>
                </button>
                {isOpen ? <div className="records-actions">
                  {item.kind === "income" ? <>
                    <button className="btn secondary" type="button" disabled={pendingAction !== null} onClick={() => setEditingIncomeId(editingIncomeId === item.income.id ? null : item.income.id)}>{editingIncomeId === item.income.id ? "收合" : "修改"}</button>
                    <button className="btn secondary danger-text" type="button" disabled={pendingAction !== null} onClick={() => handleDeleteIncome(item.income.id)}>刪除</button>
                  </> : <>
                    {item.canRepay ? <button className="btn secondary" type="button" disabled={pendingAction !== null} onClick={() => setEditingRepaymentId(editingRepaymentId === item.expense.id ? null : item.expense.id)}>{editingRepaymentId === item.expense.id ? "收合" : "還款明細"}</button> : null}
                    <button className="btn secondary danger-text" type="button" disabled={pendingAction !== null} onClick={() => handleDeleteExpense(item.expense)}>刪除</button>
                  </>}
                </div> : null}
                {isOpen && item.kind === "income" && editingIncomeId === item.income.id ? <IncomeEditForm record={item.income} disabled={pendingAction !== null} onSave={(changes) => handleUpdateIncome(item.income.id, changes)} onCancel={() => setEditingIncomeId(null)} /> : null}
                {isOpen && item.kind === "expense" && editingRepaymentId === item.expense.id ? <LoanRepaymentForm expense={item.expense} existing={loanRepayments?.[item.expense.id] ?? null} disabled={pendingAction !== null} onSave={(fields) => handleSaveRepayment(item.expense, fields)} onSetStatus={(status) => handleRepaymentStatus(item.expense, status)} onCancel={() => setEditingRepaymentId(null)} /> : null}
              </div>;
            })}
          </div>
        </section>;
      })}
      </> : null}

      {view === "home" ? <>
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
              const statementAmountDraft = statementAmountDrafts[detailKey] ?? String(cardTotal);
              const statementAmount = Number(statementAmountDraft);
              const hasValidStatementAmount = Number.isInteger(statementAmount) && statementAmount > 0;
              const statementDifference = hasValidStatementAmount ? statementAmount - cardTotal : 0;
              const payableTotal = (state === "due" && hasValidStatementAmount ? statementAmount : cardTotal) + paymentFee;
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
                {state === "due" ? <label className="field statement-amount-field">
                  <span>實際帳單金額</span>
                  <input
                    aria-label={`${card}實際帳單金額`}
                    className="input"
                    inputMode="numeric"
                    min="1"
                    pattern="[0-9]*"
                    step="1"
                    type="number"
                    value={statementAmountDraft}
                    onChange={(event) => setStatementAmountDrafts((current) => ({ ...current, [detailKey]: event.target.value }))}
                  />
                  <small className={statementDifference === 0 ? "muted" : "statement-difference"}>
                    系統明細 {money(cardTotal)}{hasValidStatementAmount ? statementDifference === 0 ? "・金額相符" : `・差額 ${money(statementDifference)}` : "・請輸入有效金額"}
                  </small>
                </label> : null}
                {state === "due" ? <button className="btn" type="button" disabled={pendingAction !== null || !hasValidStatementAmount} onClick={() => handleCreateCardPayment(card, statementAmount, cardTotal, dueBillMonth)}>{pendingAction === "建立信用卡繳款" ? "建立中..." : "建立繳款紀錄"}</button> : null}
                {state === "estimate" ? <button className="btn secondary" type="button" disabled>未結帳，先核對明細</button> : null}
                {payment ? <button className="btn secondary" type="button" disabled={pendingAction !== null} onClick={() => handleDeleteCardPayment(payment)}>取消繳款紀錄</button> : null}
                <button className="btn secondary compact-btn" type="button" onClick={() => toggleCardDetails(detailKey)}>{isOpen ? "收合明細" : "查看明細"}</button>
                {isOpen ? <div className="credit-card-lines">
                  {cardRecords.map((record, index) => <div className="credit-card-line" key={`${card}-${record.date}-${index}`}>
                    <div>
                      <strong>{record.date.slice(5)}　{cardLineTitle(record)}</strong>
                      <div className="muted">{cardLineMeta(record, viewer)}</div>
                    </div>
                    <div className="credit-card-line-side">
                      <span>{money(record.amount)}</span>
                      {record.sourceExpense ? installmentMonthEditor(record.sourceExpense) : null}
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
                      {record.sourceExpense ? installmentMonthEditor(record.sourceExpense) : null}
                    </div>
                  </div>)}
                </div> : null}
              </div>;
            })}
          </div> : null}

          {creditCardTab === "paid" ? <div className="card grid" style={{ boxShadow: "none" }}>
            <strong>本月已繳信用卡</strong>
            {ownCardPayments.length === 0 ? <p className="muted">這個月份還沒有你的信用卡繳款紀錄</p> : null}
            {ownCardPayments.map((payment) => {
              const includedInstallments = paidLegacyInstallments(payment, legacyInstallments);
              return <div className="card grid" style={{ boxShadow: "none" }} key={payment.id}>
                <div className="row"><span>{payment.date.slice(5)}　{payment.card}・{payment.billMonth}帳單</span><span className="muted">{money(payment.amount)}</span></div>
                {includedInstallments.length > 0 ? <div className="credit-card-lines">
                  <strong>本期包含的記帳前分期</strong>
                  {includedInstallments.map((installment) => <div className="credit-card-line" key={`${payment.id}-${installment.id}`}>
                    <div>
                      <strong>{installment.name}・第 {installment.installmentNo}/{installment.totalInstallments} 期</strong>
                      <div className="muted">{installment.isFinal ? "本期已繳完" : "已隨本期帳單繳款"}</div>
                    </div>
                    <span>{money(installment.amount)}</span>
                  </div>)}
                </div> : null}
              </div>;
            })}
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
            <button className="btn secondary" type="button" disabled={pendingAction !== null} onClick={() => handleAdvanceStatus(record, "已送件")}>已送件</button>
            <button className="btn secondary" type="button" disabled={pendingAction !== null} onClick={() => handleAdvanceStatus(record, "已收回")}>已收回</button>
            <button className="btn secondary" type="button" disabled={pendingAction !== null} onClick={() => handleDeleteAdvance(record.id)}>刪除</button>
          </div>
        </div>)}</div> : null}
      </article> : null}
      </> : null}
    </section>
  );
}

