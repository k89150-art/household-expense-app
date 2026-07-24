"use client";

import { useEffect, useMemo, useState } from "react";
import { currentMonthString } from "@/lib/date";
import {
  getAdvanceRecordsByMonth,
  getCardPaymentRecordsByMonth,
  getExpenseRecordsByMonth,
  getIncomeRecordsByMonth,
  getInvestmentRecordsByMonth,
} from "@/lib/records";
import type { AdvanceRecord, CardPaymentRecord, ExpenseRecord, IncomeRecord, InvestmentRecord } from "@/lib/records";

type ReportLine = {
  label: string;
  amount: number;
};

type SearchKind = "all" | "expense" | "income" | "investment" | "advance" | "cardPayment";
type SearchOwner = "all" | "chris" | "wife";
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
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [investments, setInvestments] = useState<InvestmentRecord[]>([]);
  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);
  const [cardPayments, setCardPayments] = useState<CardPaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [keyword, setKeyword] = useState("");
  const [searchKind, setSearchKind] = useState<SearchKind>("all");
  const [searchOwner, setSearchOwner] = useState<SearchOwner>("all");

  useEffect(() => {
    async function loadReport() {
      setIsLoading(true);
      setMessage("");
      try {
        const [expenseData, incomeData, investmentData, advanceData, cardPaymentData] = await Promise.all([
          getExpenseRecordsByMonth(selectedMonth),
          getIncomeRecordsByMonth(selectedMonth),
          getInvestmentRecordsByMonth(selectedMonth),
          getAdvanceRecordsByMonth(selectedMonth),
          getCardPaymentRecordsByMonth(selectedMonth),
        ]);
        setExpenses(expenseData);
        setIncomes(incomeData);
        setInvestments(investmentData);
        setAdvances(advanceData);
        setCardPayments(cardPaymentData);
      } catch (error) {
        console.error(error);
        setMessage("讀取報表失敗，請稍後再試。");
      } finally {
        setIsLoading(false);
      }
    }

    loadReport();
  }, [selectedMonth]);

  const report = useMemo(() => {
    const livingExpense = sum(expenses.filter((record) => record.paymentMethod !== "credit_card"));
    const creditCardExpense = sum(expenses.filter((record) => record.paymentMethod === "credit_card"));
    const advanceTotal = sum(advances);
    const paidNowAdvance = sum(advances.filter((record) => record.paymentMethod !== "credit_card"));
    const reimbursedAdvance = sum(advances.filter((record) => record.status === "已收回"));
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
  }, [advances, cardPayments, expenses, incomes, investments]);

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

  return (
    <section className="report-page grid">
      <article className="report-hero">
        <div>
          <p className="report-kicker">MONTHLY REPORT</p>
          <h2>{monthTitle(selectedMonth)}</h2>
          <p>{isLoading ? "正在整理這個月的資料..." : "這裡只放統計與趨勢，首頁保留日常查看。"}</p>
        </div>
        <strong className={report.cashFlow >= 0 ? "positive" : "negative"}>{money(report.cashFlow)}</strong>
      </article>

      <article className="panel report-controls">
        <button className="btn secondary" type="button" onClick={() => setSelectedMonth((value) => shiftMonth(value, -1))}>上個月</button>
        <label className="month-field">
          <span>查詢月份</span>
          <input className="input month-input" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
        </label>
        <button className="btn secondary" type="button" onClick={() => setSelectedMonth((value) => shiftMonth(value, 1))}>下個月</button>
      </article>

      <section className="report-metrics">
        <article><span>收入</span><strong>{money(report.incomeTotal)}</strong></article>
        <article><span>本月現金流</span><strong className={report.cashFlow >= 0 ? "positive" : "negative"}>{money(report.cashFlow)}</strong></article>
        <article><span>生活支出</span><strong>{money(report.livingExpense)}</strong></article>
        <article><span>投資</span><strong>{money(report.investmentTotal)}</strong></article>
      </section>

      <article className="panel report-breakdown">
        <div className="journal-head compact">
          <div>
            <h2>收支結構</h2>
            <p>把這個月的錢分成真正流出的幾個方向。</p>
          </div>
        </div>
        <div className="report-stack">
          <div><span>生活</span><strong>{money(report.livingExpense)}</strong></div>
          <div><span>信用卡繳款</span><strong>{money(report.cardPaymentTotal)}</strong></div>
          <div><span>投資</span><strong>{money(report.investmentTotal)}</strong></div>
          <div><span>現付代墊</span><strong>{money(report.paidNowAdvance)}</strong></div>
        </div>
        <p className="muted">公式：收入 - 現付生活支出 - 現付代墊 - 信用卡繳款 - 投資 + 已收回代墊 = {money(report.cashFlow)}</p>
        <p className="muted">本月刷卡尚未繳款：{money(report.creditCardExpense)}；已收回代墊：{money(report.reimbursedAdvance)}</p>
      </article>

      <article className="panel report-list">
        <div className="journal-head compact">
          <div>
            <h2>支出分類</h2>
            <p>看這個月主要花在哪裡。</p>
          </div>
        </div>
        {report.categoryLines.length === 0 ? <p className="muted">這個月還沒有支出資料。</p> : null}
        {report.categoryLines.slice(0, 8).map((line) => (
          <div className="report-bar" key={line.label}>
            <div className="row"><span>{line.label}</span><strong>{money(line.amount)}</strong></div>
            <span style={{ width: `${Math.max(8, Math.round((line.amount / maxCategory) * 100))}%` }} />
          </div>
        ))}
      </article>

      <article className="panel report-list">
        <div className="journal-head compact">
          <div>
            <h2>付款分布</h2>
            <p>快速看這個月誰先付款比較多。</p>
          </div>
        </div>
        {report.payerLines.length === 0 ? <p className="muted">這個月還沒有付款資料。</p> : null}
        {report.payerLines.map((line) => (
          <div className="report-bar compact" key={line.label}>
            <div className="row"><span>{line.label}</span><strong>{money(line.amount)}</strong></div>
            <span style={{ width: `${Math.max(8, Math.round((line.amount / maxPayer) * 100))}%` }} />
          </div>
        ))}
      </article>

      <article className="panel report-list">
        <div className="journal-head compact">
          <div>
            <h2>信用卡分布</h2>
            <p>共同查帳用；首頁只顯示登入者自己的信用卡。</p>
          </div>
        </div>
        {report.creditCardLines.length === 0 ? <p className="muted">這個月還沒有信用卡消費。</p> : null}
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
            <p>搜尋目前月份的支出、收入、投資、代墊與信用卡繳款。</p>
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
