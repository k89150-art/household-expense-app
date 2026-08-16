"use client";

import { useEffect, useMemo, useState } from "react";
import { advanceReimbursementDate, reimbursedAdvancesForPeriod } from "@/lib/advanceCashFlow";
import { currentMonthString } from "@/lib/date";
import {
  getAllAdvanceRecords,
  getCardPaymentRecordsByDateRange,
  getCardPaymentRecordsByMonth,
  getExpenseRecordsByDateRange,
  getExpenseRecordsByMonth,
  getIncomeRecordsByDateRange,
  getIncomeRecordsByMonth,
  getInvestmentRecordsByDateRange,
  getInvestmentRecordsByMonth,
  updateAdvanceRecord,
} from "@/lib/records";
import type { AdvanceRecord, CardPaymentRecord, ExpenseRecord, IncomeRecord, InvestmentRecord } from "@/lib/records";

type ReportLine = {
  label: string;
  amount: number;
};

type SearchKind = "all" | "expense" | "income" | "investment" | "advance" | "cardPayment";
type SearchOwner = "all" | "chris" | "wife";
type ReportScope = "month" | "year";
type SearchRecord = {
  id: string;
  kind: Exclude<SearchKind, "all">;
  date: string;
  title: string;
  detail: string;
  amount: number;
  owner: Exclude<SearchOwner, "all">;
  searchable: string;
};

const SEARCH_KIND_LABELS: Record<SearchRecord["kind"], string> = {
  expense: "支出",
  income: "收入",
  investment: "投資",
  advance: "代墊",
  cardPayment: "繳款",
};

function money(value = 0) {
  return `$${value.toLocaleString("zh-TW")}`;
}

function shiftMonth(yyyymm: string, diff: number) {
  const [year, month] = yyyymm.split("-").map(Number);
  const date = new Date(year, month - 1 + diff, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthTitle(yyyymm: string) {
  const [year, month] = yyyymm.split("-");
  return `${year}年${Number(month)}月`;
}

function sum(records: Array<{ amount: number }>) {
  return records.reduce((total, record) => total + record.amount, 0);
}

function groupTotal<T extends { amount: number }>(records: T[], getKey: (record: T) => string) {
  return records.reduce<Record<string, number>>((groups, record) => {
    const key = getKey(record);
    groups[key] = (groups[key] ?? 0) + record.amount;
    return groups;
  }, {});
}

function toLines(groups: Record<string, number>) {
  return Object.entries(groups)
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function largestAmount(lines: ReportLine[]) {
  return Math.max(1, ...lines.map((line) => line.amount));
}

export function HouseholdReport() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonthString());
  const [reportScope, setReportScope] = useState<ReportScope>("month");
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [investments, setInvestments] = useState<InvestmentRecord[]>([]);
  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);
  const [reimbursements, setReimbursements] = useState<AdvanceRecord[]>([]);
  const [cardPayments, setCardPayments] = useState<CardPaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [keyword, setKeyword] = useState("");
  const [searchKind, setSearchKind] = useState<SearchKind>("all");
  const [searchOwner, setSearchOwner] = useState<SearchOwner>("all");
  const [reportRefreshKey, setReportRefreshKey] = useState(0);
  const [updatingAdvanceId, setUpdatingAdvanceId] = useState<string | null>(null);

  useEffect(() => {
    async function loadReport() {
      setIsLoading(true);
      setMessage("");
      try {
        const selectedYear = selectedMonth.slice(0, 4);
        const startDate = `${selectedYear}-01-01`;
        const endDate = `${selectedYear}-12-31`;
        const [expenseData, incomeData, investmentData, allAdvanceData, cardPaymentData] = await Promise.all([
          reportScope === "month" ? getExpenseRecordsByMonth(selectedMonth) : getExpenseRecordsByDateRange(startDate, endDate),
          reportScope === "month" ? getIncomeRecordsByMonth(selectedMonth) : getIncomeRecordsByDateRange(startDate, endDate),
          reportScope === "month" ? getInvestmentRecordsByMonth(selectedMonth) : getInvestmentRecordsByDateRange(startDate, endDate),
          getAllAdvanceRecords(),
          reportScope === "month" ? getCardPaymentRecordsByMonth(selectedMonth) : getCardPaymentRecordsByDateRange(startDate, endDate),
        ]);
        setExpenses(expenseData);
        setIncomes(incomeData);
        setInvestments(investmentData);
        setAdvances(allAdvanceData.filter((record) => record.date >= (reportScope === "month" ? `${selectedMonth}-01` : startDate) && record.date <= (reportScope === "month" ? `${selectedMonth}-31` : endDate)));
        setReimbursements(reimbursedAdvancesForPeriod(allAdvanceData, reportScope === "month" ? `${selectedMonth}-01` : startDate, reportScope === "month" ? `${selectedMonth}-31` : endDate));
        setCardPayments(cardPaymentData);
      } catch (error) {
        console.error(error);
        setMessage("讀取報表失敗，請稍後再試。");
      } finally {
        setIsLoading(false);
      }
    }

    loadReport();
  }, [reportRefreshKey, reportScope, selectedMonth]);

  const report = useMemo(() => {
    const livingExpense = sum(expenses.filter((record) => record.paymentMethod !== "credit_card"));
    const creditCardExpense = sum(expenses.filter((record) => record.paymentMethod === "credit_card"));
    const advanceTotal = sum(advances);
    const paidNowAdvance = sum(advances.filter((record) => record.paymentMethod !== "credit_card"));
    const reimbursedAdvance = sum(reimbursements);
    const cardPaymentTotal = sum(cardPayments);
    const incomeTotal = sum(incomes);
    const investmentTotal = sum(investments);
    const totalOutflow = livingExpense + paidNowAdvance + cardPaymentTotal + investmentTotal;
    const cashFlow = incomeTotal - totalOutflow + reimbursedAdvance;
    const categoryLines = toLines(groupTotal(expenses, (record) => record.category));
    const payerLines = toLines(groupTotal(expenses, (record) => record.paidBy === "chris" ? "我付款" : "太太付款"));
    const creditCardLines = toLines(groupTotal(
      expenses.filter((record) => record.paymentMethod === "credit_card"),
      (record) => `${record.paidBy === "chris" ? "先生" : "太太"}・${record.creditCard ?? "未指定信用卡"}`,
    ));
    return {
      incomeTotal,
      livingExpense,
      creditCardExpense,
      cardPaymentTotal,
      investmentTotal,
      advanceTotal,
      paidNowAdvance,
      reimbursedAdvance,
      totalOutflow,
      cashFlow,
      categoryLines,
      payerLines,
      creditCardLines,
    };
  }, [advances, cardPayments, expenses, incomes, investments, reimbursements]);

  async function handleUndoAdvanceReimbursement(record: AdvanceRecord) {
    if (!window.confirm(`確定要把「${record.item}」改回已送件，並取消這筆收回款嗎？`)) return;
    setUpdatingAdvanceId(record.id);
    setMessage("");
    try {
      await updateAdvanceRecord(record.id, { status: "已送件", reimbursedDate: null });
      setReportRefreshKey((value) => value + 1);
    } catch (error) {
      console.error(error);
      setMessage("取消代墊款收回失敗，請稍後再試。");
    } finally {
      setUpdatingAdvanceId(null);
    }
  }

  const searchRecords = useMemo<SearchRecord[]>(() => {
    const expenseRecords: SearchRecord[] = expenses.map((record) => {
      const title = record.isPrivate ? "私人明細" : record.note || record.category;
      const detail = [
        record.category,
        record.paymentMethod === "credit_card" ? record.creditCard : null,
        record.paidBy === "chris" ? "先生" : "太太",
      ].filter(Boolean).join("・");
      return {
        id: `expense-${record.id}`,
        kind: "expense",
        date: record.date,
        title,
        detail,
        amount: record.amount,
        owner: record.paidBy,
        searchable: [record.date, title, detail, record.isPrivate ? "" : record.note].filter(Boolean).join(" ").toLocaleLowerCase("zh-TW"),
      };
    });
    const incomeRecords: SearchRecord[] = incomes.map((record) => ({
      id: `income-${record.id}`,
      kind: "income",
      date: record.date,
      title: record.note || record.category,
      detail: `${record.category}・${record.owner === "chris" ? "先生" : "太太"}`,
      amount: record.amount,
      owner: record.owner,
      searchable: [record.date, record.category, record.note, record.owner === "chris" ? "先生" : "太太"].filter(Boolean).join(" ").toLocaleLowerCase("zh-TW"),
    }));
    const investmentRecords: SearchRecord[] = investments.map((record) => ({
      id: `investment-${record.id}`,
      kind: "investment",
      date: record.date,
      title: record.name,
      detail: `${record.type}・${record.owner === "chris" ? "先生" : "太太"}`,
      amount: record.amount,
      owner: record.owner,
      searchable: [record.date, record.type, record.name, record.note, record.owner === "chris" ? "先生" : "太太"].filter(Boolean).join(" ").toLocaleLowerCase("zh-TW"),
    }));
    const advanceRecords: SearchRecord[] = advances.map((record) => ({
      id: `advance-${record.id}`,
      kind: "advance",
      date: record.date,
      title: record.item,
      detail: `${record.status}・${record.owner === "chris" ? "先生" : "太太"}`,
      amount: record.amount,
      owner: record.owner,
      searchable: [record.date, record.item, record.target, record.status, record.note, record.creditCard, record.owner === "chris" ? "先生" : "太太"].filter(Boolean).join(" ").toLocaleLowerCase("zh-TW"),
    }));
    const paymentRecords: SearchRecord[] = cardPayments.map((record) => ({
      id: `cardPayment-${record.id}`,
      kind: "cardPayment",
      date: record.date,
      title: `${record.card}信用卡繳款`,
      detail: `${record.billMonth}帳單・${record.owner === "chris" ? "先生" : "太太"}`,
      amount: record.amount,
      owner: record.owner,
      searchable: [record.date, record.card, "信用卡 繳款", record.billMonth, record.note, record.owner === "chris" ? "先生" : "太太"].filter(Boolean).join(" ").toLocaleLowerCase("zh-TW"),
    }));
    return [...expenseRecords, ...incomeRecords, ...investmentRecords, ...advanceRecords, ...paymentRecords]
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [advances, cardPayments, expenses, incomes, investments]);

  const filteredSearchRecords = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase("zh-TW");
    return searchRecords.filter((record) =>
      (searchKind === "all" || record.kind === searchKind) &&
      (searchOwner === "all" || record.owner === searchOwner) &&
      (!normalizedKeyword || record.searchable.includes(normalizedKeyword))
    );
  }, [keyword, searchKind, searchOwner, searchRecords]);

  const maxCategory = largestAmount(report.categoryLines);
  const maxPayer = largestAmount(report.payerLines);
  const maxCreditCard = largestAmount(report.creditCardLines);
  const selectedYear = selectedMonth.slice(0, 4);
  const periodTitle = reportScope === "month" ? monthTitle(selectedMonth) : `${selectedYear}年度`;
  const periodNoun = reportScope === "month" ? "這個月" : "這一年";
  const periodSearchLabel = reportScope === "month" ? "目前月份" : `${selectedYear}年度`;
  const yearOptions = Array.from({ length: 11 }, (_, index) => Number(selectedYear) + 5 - index);
  const advanceMonthGroups = Object.entries(advances.reduce<Record<string, AdvanceRecord[]>>((groups, record) => {
    const month = record.date.slice(0, 7);
    groups[month] = [...(groups[month] ?? []), record];
    return groups;
  }, {})).sort(([monthA], [monthB]) => monthB.localeCompare(monthA));

  return (
    <section className="report-page grid">
      <article className="report-hero">
        <div>
          <p className="report-kicker">{reportScope === "month" ? "MONTHLY REPORT" : "YEARLY REPORT"}</p>
          <h2>{periodTitle}</h2>
          <p>{isLoading ? `正在整理${periodNoun}的資料...` : "這裡只放統計與趨勢，首頁保留日常查看。"}</p>
        </div>
        <strong className={report.cashFlow >= 0 ? "positive" : "negative"}>{money(report.cashFlow)}</strong>
      </article>

      <article className="panel report-controls">
        <div className="scope-toggle report-period-toggle">
          <button className={reportScope === "month" ? "btn" : "btn secondary"} type="button" onClick={() => setReportScope("month")}>月報</button>
          <button className={reportScope === "year" ? "btn" : "btn secondary"} type="button" onClick={() => setReportScope("year")}>年報</button>
        </div>
        <button className="btn secondary" type="button" onClick={() => setSelectedMonth((value) => shiftMonth(value, reportScope === "month" ? -1 : -12))}>{reportScope === "month" ? "上個月" : "上一年"}</button>
        {reportScope === "month" ? <label className="month-field">
          <span>查詢月份</span>
          <input className="input month-input" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
        </label> : <label className="month-field">
          <span>查詢年份</span>
          <select className="select month-input" value={selectedYear} onChange={(event) => setSelectedMonth(`${event.target.value}-${selectedMonth.slice(5, 7)}`)}>
            {yearOptions.map((year) => <option value={year} key={year}>{year}年</option>)}
          </select>
        </label>}
        <button className="btn secondary" type="button" onClick={() => setSelectedMonth((value) => shiftMonth(value, reportScope === "month" ? 1 : 12))}>{reportScope === "month" ? "下個月" : "下一年"}</button>
      </article>

      <section className="report-metrics">
        <article><span>收入</span><strong>{money(report.incomeTotal)}</strong></article>
        <article><span>{reportScope === "month" ? "本月現金流" : "年度現金流"}</span><strong className={report.cashFlow >= 0 ? "positive" : "negative"}>{money(report.cashFlow)}</strong></article>
        <article><span>生活支出</span><strong>{money(report.livingExpense)}</strong></article>
        <article><span>投資</span><strong>{money(report.investmentTotal)}</strong></article>
      </section>

      <article className="panel report-breakdown">
        <div className="journal-head compact">
          <div>
            <h2>收支結構</h2>
            <p>把{periodNoun}的錢分成真正流出的幾個方向。</p>
          </div>
        </div>
        <div className="report-stack">
          <div><span>生活</span><strong>{money(report.livingExpense)}</strong></div>
          <div><span>信用卡繳款</span><strong>{money(report.cardPaymentTotal)}</strong></div>
          <div><span>投資</span><strong>{money(report.investmentTotal)}</strong></div>
          <div><span>現付代墊</span><strong>{money(report.paidNowAdvance)}</strong></div>
        </div>
        <p className="muted">公式：收入 - 現付生活支出 - 現付代墊 - 信用卡繳款 - 投資 + 已收回代墊 = {money(report.cashFlow)}</p>
        <p className="muted">{reportScope === "month" ? "本月" : "本年度"}刷卡消費：{money(report.creditCardExpense)}；已收回代墊：{money(report.reimbursedAdvance)}</p>
      </article>

      <article className="panel report-list">
        <div className="journal-head compact">
          <div>
            <h2>支出分類</h2>
            <p>看{periodNoun}主要花在哪裡。</p>
          </div>
        </div>
        {report.categoryLines.length === 0 ? <p className="muted">{periodNoun}還沒有支出資料。</p> : null}
        {report.categoryLines.slice(0, 8).map((line) => (
          <div className="report-bar" key={line.label}>
            <div className="row"><span>{line.label}</span><strong>{money(line.amount)}</strong></div>
            <span style={{ width: `${Math.max(8, Math.round((line.amount / maxCategory) * 100))}%` }} />
          </div>
        ))}
      </article>

      <article className="panel report-list advance-history">
        <div className="journal-head compact">
          <div>
            <h2>代墊款紀錄</h2>
            <p>依代墊月份保留完整紀錄；收回款只計入實際收回月份的現金流。</p>
          </div>
        </div>
        {advanceMonthGroups.length === 0 ? <p className="muted">{periodNoun}還沒有代墊款紀錄。</p> : null}
        {advanceMonthGroups.map(([month, monthRecords], index) => (
          <details className="advance-month-group" key={month} open={reportScope === "month" || index === 0}>
            <summary>
              <strong>{monthTitle(month)}</strong>
              <span>{monthRecords.length} 筆・{money(sum(monthRecords))}</span>
            </summary>
            <div className="advance-history-list">
              {monthRecords.map((record) => {
                const reimbursementDate = advanceReimbursementDate(record);
                return <div className="advance-history-row" key={record.id}>
                  <div>
                    <strong>{record.item}</strong>
                    <span>{record.date}・{record.owner === "chris" ? "先生" : "太太"}・{record.paymentMethod}{record.creditCard ? `・${record.creditCard}` : ""}</span>
                    {record.note ? <span>{record.note}</span> : null}
                    <span>{record.status}{reimbursementDate ? `・${reimbursementDate} 收回` : ""}</span>
                  </div>
                  <div className="advance-history-side">
                    <strong>{money(record.amount)}</strong>
                    {record.status === "已收回" ? <button className="btn secondary compact-btn" type="button" disabled={updatingAdvanceId !== null} onClick={() => handleUndoAdvanceReimbursement(record)}>{updatingAdvanceId === record.id ? "處理中..." : "改回已送件"}</button> : null}
                  </div>
                </div>;
              })}
            </div>
          </details>
        ))}
      </article>

      <article className="panel report-list report-payer">
        <div className="journal-head compact">
          <div>
            <h2>付款分布</h2>
            <p>快速看{periodNoun}誰先付款比較多。</p>
          </div>
        </div>
        {report.payerLines.length === 0 ? <p className="muted">{periodNoun}還沒有付款資料。</p> : null}
        {report.payerLines.map((line) => (
          <div className="report-bar compact" key={line.label}>
            <div className="row"><span>{line.label}</span><strong>{money(line.amount)}</strong></div>
            <span style={{ width: `${Math.max(8, Math.round((line.amount / maxPayer) * 100))}%` }} />
          </div>
        ))}
      </article>

      <article className="panel report-list report-credit-card">
        <div className="journal-head compact">
          <div>
            <h2>信用卡分布</h2>
            <p>共同查帳用；首頁只顯示登入者自己的信用卡。</p>
          </div>
        </div>
        {report.creditCardLines.length === 0 ? <p className="muted">{periodNoun}還沒有信用卡消費。</p> : null}
        {report.creditCardLines.map((line) => (
          <div className="report-bar compact" key={line.label}>
            <div className="row"><span>{line.label}</span><strong>{money(line.amount)}</strong></div>
            <span style={{ width: `${Math.max(8, Math.round((line.amount / maxCreditCard) * 100))}%` }} />
          </div>
        ))}
      </article>

      <article className="panel report-list">
        <div className="journal-head compact">
          <div>
            <h2>明細搜尋</h2>
            <p>搜尋{periodSearchLabel}的支出、收入、投資、代墊與信用卡繳款。</p>
          </div>
        </div>
        <div className="report-search-controls">
          <label className="field report-search-keyword">
            <span>關鍵字</span>
            <input className="input" type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="項目、分類、信用卡或備註" />
          </label>
          <label className="field">
            <span>類型</span>
            <select className="select" value={searchKind} onChange={(event) => setSearchKind(event.target.value as SearchKind)}>
              <option value="all">全部類型</option>
              <option value="expense">支出</option>
              <option value="income">收入</option>
              <option value="investment">投資</option>
              <option value="advance">代墊</option>
              <option value="cardPayment">信用卡繳款</option>
            </select>
          </label>
          <label className="field">
            <span>成員</span>
            <select className="select" value={searchOwner} onChange={(event) => setSearchOwner(event.target.value as SearchOwner)}>
              <option value="all">全部成員</option>
              <option value="chris">先生</option>
              <option value="wife">太太</option>
            </select>
          </label>
        </div>
        <div className="row report-search-summary">
          <span className="muted">找到 {filteredSearchRecords.length} 筆</span>
          {(keyword || searchKind !== "all" || searchOwner !== "all") ? (
            <button className="btn secondary compact-btn" type="button" onClick={() => {
              setKeyword("");
              setSearchKind("all");
              setSearchOwner("all");
            }}>清除條件</button>
          ) : null}
        </div>
        <div className="report-search-results">
          {filteredSearchRecords.length === 0 ? <p className="muted">沒有符合條件的紀錄。</p> : null}
          {filteredSearchRecords.slice(0, 80).map((record) => (
            <div className="report-search-row" key={record.id}>
              <span className={`record-kind-badge ${record.kind}`}>{SEARCH_KIND_LABELS[record.kind]}</span>
              <div>
                <strong>{record.title}</strong>
                <span>{record.date}・{record.detail}</span>
              </div>
              <em>{money(record.amount)}</em>
            </div>
          ))}
          {filteredSearchRecords.length > 80 ? <p className="muted">目前顯示最新 80 筆，請增加搜尋條件縮小範圍。</p> : null}
        </div>
        {message ? <p className="muted">{message}</p> : null}
      </article>
    </section>
  );
}
