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
  updateAdvanceRecord,
  updateExpenseRecord,
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
} from "@/lib/records";
import type { Viewer } from "@/lib/household";

type Scope = "month" | "all";
type Props = { viewer: Viewer; refreshKey?: number };
type CardLine = { date: string; label: string; amount: number; kind: "expense" | "advance" | "installment"; sourceExpense?: ExpenseRecord };
type CardStatementPolicy = { closingDay: number; closesInFollowingMonth: boolean };

const CARD_STATEMENT_POLICIES: Record<CreditCardName, CardStatementPolicy> = {
  國泰: { closingDay: 28, closesInFollowingMonth: false },
  中信: { closingDay: 7, closesInFollowingMonth: true },
  玉山: { closingDay: 7, closesInFollowingMonth: true },
  台新: { closingDay: 7, closesInFollowingMonth: true },
  保費卡: { closingDay: 7, closesInFollowingMonth: true },
};

const TARGET_LABELS: Record<string, string> = { chris: "我", wife: "我", junyao: "竣堯", cat: "貓" };

function money(value = 0) {
  return `$${value.toLocaleString("zh-TW")}`;
}

function shiftMonth(yyyymm: string, diff: number) {
  const [year, month] = yyyymm.split("-").map(Number);
  const date = new Date(year, month - 1 + diff, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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
  return `${billMonth} 帳單・${startDate} 到 ${endDate}・${endDate} 結帳`;
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

function addCardLine(groups: Record<string, CardLine[]>, card: string, line: CardLine) {
  groups[card] = [...(groups[card] ?? []), line];
}

function groupByCreditCard(records: ExpenseRecord[], advances: AdvanceRecord[]) {
  const groups: Record<string, CardLine[]> = {};
  records.filter((record) => record.paymentMethod === "credit_card" && record.creditCard).forEach((record) => {
    addCardLine(groups, record.creditCard ?? "未指定", { date: record.date, label: record.note || record.category, amount: record.amount, kind: "expense", sourceExpense: record });
  });
  advances.filter((record) => record.paymentMethod === "credit_card" && record.creditCard).forEach((record) => {
    addCardLine(groups, record.creditCard ?? "未指定", { date: record.date, label: `代墊・${record.item}`, amount: record.amount, kind: "advance" });
  });
  return groups;
}

function groupDueCreditCardBills(billAdvances: AdvanceRecord[], allCardRecords: ExpenseRecord[], billMonth: string) {
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

  return groups;
}

function statusBadge(isPaid: boolean) {
  return <span style={{ color: isPaid ? "#16803C" : "#C53030", fontWeight: 700 }}>{isPaid ? "已繳款" : "未繳款"}</span>;
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
  const [isLoading, setIsLoading] = useState(false);
  const [openedTarget, setOpenedTarget] = useState<string | null>(null);
  const [openedCategory, setOpenedCategory] = useState<string | null>(null);
  const [showIncomes, setShowIncomes] = useState(false);
  const [showInvestments, setShowInvestments] = useState(false);
  const [showAdvances, setShowAdvances] = useState(false);
  const [showCreditCards, setShowCreditCards] = useState(false);
  const [message, setMessage] = useState("");

  async function loadRecords() {
    setIsLoading(true);
    setMessage("");
    try {
      const dueBillMonth = shiftMonth(selectedMonth, -1);
      const [expenseData, incomeData, investmentData, advanceData, dueAdvanceData, allCardExpenseData, paymentData, duePaymentData] = await Promise.all([
        scope === "month" ? getExpenseRecordsByMonth(selectedMonth) : getAllExpenseRecords(),
        scope === "month" ? getIncomeRecordsByMonth(selectedMonth) : getAllIncomeRecords(),
        scope === "month" ? getInvestmentRecordsByMonth(selectedMonth) : getAllInvestmentRecords(),
        scope === "month" ? getAdvanceRecordsByMonth(selectedMonth) : getAllAdvanceRecords(),
        getAllAdvanceRecords(),
        getCreditCardExpenseRecords(),
        scope === "month" ? getCardPaymentRecordsByMonth(selectedMonth) : getAllCardPaymentRecords(),
        getCardPaymentRecordsByBillMonth(dueBillMonth),
      ]);
      setExpenses(expenseData);
      setIncomes(incomeData);
      setInvestments(investmentData);
      setAdvances(advanceData);
      setDueAdvances(dueAdvanceData);
      setAllCreditCardExpenses(allCardExpenseData);
      setCardPayments(paymentData);
      setDueBillPayments(duePaymentData);
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

  async function handleDeleteExpense(id: string) {
    if (!window.confirm("確定要刪除這筆支出嗎？")) return;
    await deleteExpenseRecord(id);
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
    if (!window.confirm(`確定要建立 ${card} ${billMonth} 帳單繳款 ${money(amount)} 嗎？`)) return;
    await addCardPaymentRecord({ date: localDateString(), amount, owner: viewer, card: card as CreditCardName, billMonth, status: "已繳款", paidDate: localDateString(), note: `${billMonth} ${card}帳單繳款`, createdBy: user.uid });
    await loadRecords();
  }

  async function handleDeleteCardPayment(id: string) {
    if (!window.confirm("確定要取消這筆信用卡繳款紀錄嗎？")) return;
    await deleteCardPaymentRecord(id);
    await loadRecords();
  }

  const dueBillMonth = shiftMonth(selectedMonth, -1);
  const totalIncome = incomes.reduce((sum, record) => sum + record.amount, 0);
  const paidNowExpense = expenses.filter((record) => record.paymentMethod !== "credit_card").reduce((sum, record) => sum + record.amount, 0);
  const totalInvestment = investments.reduce((sum, record) => sum + record.amount, 0);
  const pendingAdvanceRecords = advances.filter((record) => record.status !== "已收回");
  const paidNowAdvance = advances.filter((record) => record.paymentMethod !== "credit_card").reduce((sum, record) => sum + record.amount, 0);
  const pendingAdvance = pendingAdvanceRecords.reduce((sum, record) => sum + record.amount, 0);
  const reimbursedAdvance = advances.filter((record) => record.status === "已收回").reduce((sum, record) => sum + record.amount, 0);
  const cardPaymentTotal = cardPayments.reduce((sum, record) => sum + record.amount, 0);
  const advanceCashFlow = paidNowAdvance - reimbursedAdvance;
  const availableBalance = totalIncome - paidNowExpense - paidNowAdvance - cardPaymentTotal - totalInvestment + reimbursedAdvance;
  const groupedTargets = useMemo(() => groupByTarget(expenses), [expenses]);
  const groupedIncomes = useMemo(() => groupByOwner(incomes), [incomes]);
  const groupedInvestments = useMemo(() => groupByOwner(investments), [investments]);
  const creditCardGroups = useMemo(() => groupByCreditCard(expenses, advances), [expenses, advances]);
  const dueCreditCardGroups = useMemo(() => groupDueCreditCardBills(dueAdvances, allCreditCardExpenses, dueBillMonth), [dueAdvances, allCreditCardExpenses, dueBillMonth]);
  const dueCreditCardTotal = Object.values(dueCreditCardGroups).flat().reduce((sum, record) => sum + record.amount, 0);

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
          <button className={scope === "month" ? "btn" : "btn secondary"} type="button" onClick={() => setScope("month")}>當月</button>
          <button className={scope === "all" ? "btn" : "btn secondary"} type="button" onClick={() => setScope("all")}>全部月份</button>
        </div>
      </article>

      <article className="card grid">
        <h2>{scope === "month" ? "本月剩餘可用金額" : "目前月份剩餘可用金額"}</h2>
        <div className="row"><span>可用剩餘</span><strong>{money(availableBalance)}</strong></div>
        <div className="row"><span>本月收入</span><strong>{money(totalIncome)}</strong></div>
        <div className="row"><span>已付生活支出</span><strong>{money(paidNowExpense)}</strong></div>
        <div className="row"><span>信用卡繳款</span><strong>{money(cardPaymentTotal)}</strong></div>
        <div className="row"><span>投資</span><strong>{money(totalInvestment)}</strong></div>
        {advanceCashFlow !== 0 ? <div className="row"><span>代墊款現金流</span><strong>{money(advanceCashFlow)}</strong></div> : null}
        <p className="muted" style={{ margin: 0 }}>信用卡消費先在刷卡核對；實際繳款後才會扣可用剩餘。</p>
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
                <span className="record-actions"><span className="muted">{money(record.amount)}{record.creditCard ? `・${record.creditCard}` : ""}{record.target === "junyao" ? `・${displayPaidBy(record, viewer)}付` : ""}</span><button className="btn secondary delete-btn" type="button" onClick={() => handleDeleteExpense(record.id)}>刪除</button></span>
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
          <div><h2 style={{ margin: 0 }}>信用卡</h2><div className="muted">本月應繳帳單與本月刷卡核對分開顯示</div></div>
          <strong>{money(dueCreditCardTotal)}</strong>
        </button>
        {showCreditCards ? <div className="grid">
          <div className="card grid" style={{ boxShadow: "none" }}>
            <strong>本月應繳帳單（{monthLabel(dueBillMonth)}帳單）</strong>
            {Object.keys(dueCreditCardGroups).length === 0 ? <p className="muted">沒有上個月信用卡帳單資料</p> : null}
            {Object.entries(dueCreditCardGroups).map(([card, cardRecords]) => {
              const cardTotal = cardRecords.reduce((sum, record) => sum + record.amount, 0);
              const payment = dueBillPayments.find((item) => item.card === card);
              const isPaid = Boolean(payment);
              return <div className="card grid" style={{ boxShadow: "none" }} key={`due-${card}`}>
                <div className="row"><strong>{card}</strong><strong>{money(cardTotal)}</strong></div>
                <div className="muted">{cardStatementLabel(card as CreditCardName, dueBillMonth)}</div>
                <div className="row"><span>狀態</span>{statusBadge(isPaid)}</div>
                {payment ? <div className="muted">繳款日：{payment.paidDate}・{money(payment.amount)}</div> : null}
                {!isPaid ? <button className="btn" type="button" onClick={() => handleCreateCardPayment(card, cardTotal, dueBillMonth)}>建立繳款紀錄</button> : null}
                {payment ? <button className="btn secondary" type="button" onClick={() => handleDeleteCardPayment(payment.id)}>取消繳款紀錄</button> : null}
                {cardRecords.map((record, index) => <div className="row" key={`${card}-${record.date}-${index}`}>
                  <span>{record.date.slice(5)}　{record.label}</span>
                  <span className="muted">{money(record.amount)}{record.kind === "advance" ? "・代墊" : ""}{record.kind === "installment" ? "・分期" : ""}</span>
                  {record.sourceExpense?.installment?.enabled ? <button className="btn secondary" type="button" onClick={() => record.sourceExpense ? handleUpdateInstallmentFirstBillMonth(record.sourceExpense) : undefined}>修改分期月份</button> : null}
                </div>)}
              </div>;
            })}
          </div>

          <div className="card grid" style={{ boxShadow: "none" }}>
            <strong>本月刷卡核對（{monthLabel(selectedMonth)}消費）</strong>
            <div className="muted">這裡是本月刷卡明細；分期消費可在這裡修改第一期帳單月份。</div>
            {Object.keys(creditCardGroups).length === 0 ? <p className="muted">這個月份沒有信用卡消費</p> : null}
            {Object.entries(creditCardGroups).map(([card, cardRecords]) => {
              const cardTotal = cardRecords.reduce((sum, record) => sum + record.amount, 0);
              return <div className="card grid" style={{ boxShadow: "none" }} key={`current-${card}`}>
                <div className="row"><strong>{card}</strong><strong>{money(cardTotal)}</strong></div>
                {cardRecords.map((record, index) => <div className="row" key={`${card}-${record.date}-${index}`}>
                  <span>{record.date.slice(5)}　{record.label}</span>
                  <span className="muted">{money(record.amount)}{record.kind === "advance" ? "・代墊" : ""}{record.sourceExpense?.installment?.enabled ? "・分期" : ""}</span>
                  {record.sourceExpense?.installment?.enabled ? <button className="btn secondary" type="button" onClick={() => record.sourceExpense ? handleUpdateInstallmentFirstBillMonth(record.sourceExpense) : undefined}>修改分期月份</button> : null}
                </div>)}
              </div>;
            })}
          </div>

          {cardPayments.length > 0 ? <div className="card grid" style={{ boxShadow: "none" }}>
            <strong>本月已繳信用卡</strong>
            {cardPayments.map((payment) => <div className="row" key={payment.id}><span>{payment.date.slice(5)}　{payment.card}・{payment.billMonth}帳單</span><span className="muted">{money(payment.amount)}</span></div>)}
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
