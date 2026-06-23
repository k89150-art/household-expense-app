"use client";

import { useMemo, useState } from "react";

type Viewer = "chris" | "wife";
type Scope = "month" | "all";
type PersonId = "self" | "spouse" | "junyao" | "cat";
type CreditCardName = "玉山" | "國泰" | "中信" | "保費卡";

type ExpenseLine = {
  date: string;
  category: string;
  item: string;
  amount: number;
  note?: string;
  paidBy?: string;
  paymentMethod?: "現金" | "信用卡" | "轉帳" | "預付金";
  creditCard?: CreditCardName;
};

type PersonSummary = {
  id: PersonId;
  name: string;
  income?: number;
  expenses: ExpenseLine[];
};

function getBaseData(viewer: Viewer): PersonSummary[] {
  const spouseLabel = viewer === "chris" ? "太太" : "先生";
  const lunch = viewer === "chris" ? [{ date: "2026-06-21", category: "餐飲", item: "醫院午餐", amount: 420, note: "週結算", paymentMethod: "預付金" as const }] : [];

  return [
    {
      id: "self",
      name: "我",
      income: viewer === "chris" ? 72000 : 30000,
      expenses: [
        ...lunch,
        { date: "2026-06-03", category: "餐飲", item: "早餐", amount: 90, note: "早餐店", paymentMethod: "現金" },
        { date: "2026-06-07", category: "生活用品", item: "全聯", amount: 780, note: "衛生紙、洗碗精", paymentMethod: "信用卡", creditCard: "玉山" },
        { date: "2026-06-18", category: "醫療", item: "門診", amount: 850, note: "掛號費與藥費", paymentMethod: "信用卡", creditCard: "國泰" },
        { date: "2026-05-12", category: "餐飲", item: "晚餐", amount: 1800, note: "聚餐", paymentMethod: "信用卡", creditCard: "中信" },
      ],
    },
    {
      id: "spouse",
      name: spouseLabel,
      income: viewer === "chris" ? 30000 : 72000,
      expenses: [
        { date: "2026-06-02", category: "生活用品", item: "生活用品", amount: 1200, note: "清潔用品", paymentMethod: "信用卡", creditCard: "玉山" },
        { date: "2026-06-15", category: "餐飲", item: "餐飲", amount: viewer === "chris" ? 2500 : 3200, note: "外食", paymentMethod: "信用卡", creditCard: "中信" },
        { date: "2026-05-08", category: "衣物", item: "衣物", amount: 980, note: "衣服", paymentMethod: "信用卡", creditCard: "國泰" },
      ],
    },
    {
      id: "junyao",
      name: "竣堯",
      expenses: [
        { date: "2026-06-01", category: "學費", item: "學費", amount: 12000, note: "幼兒園月費", paidBy: viewer === "chris" ? "太太" : "我", paymentMethod: "轉帳" },
        { date: "2026-06-05", category: "保健食品", item: "保健食品", amount: 1800, note: "兒童益生菌", paidBy: viewer === "chris" ? "我" : "先生", paymentMethod: "信用卡", creditCard: "玉山" },
        { date: "2026-06-10", category: "保險", item: "保險", amount: 1500, note: "月平均", paidBy: viewer === "chris" ? "我" : "先生", paymentMethod: "信用卡", creditCard: "保費卡" },
        { date: "2026-06-20", category: "學費", item: "延托費", amount: 2500, note: "延托", paidBy: viewer === "chris" ? "太太" : "我", paymentMethod: "轉帳" },
        { date: "2026-05-03", category: "娛樂", item: "童書", amount: 600, note: "繪本", paidBy: viewer === "chris" ? "太太" : "我", paymentMethod: "信用卡", creditCard: "中信" },
      ],
    },
    {
      id: "cat",
      name: "貓",
      expenses: [
        { date: "2026-06-06", category: "寵物", item: "飼料", amount: 1400, note: "乾乾", paymentMethod: "信用卡", creditCard: "中信" },
        { date: "2026-06-19", category: "醫療", item: "動物醫院", amount: 1200, note: "回診", paymentMethod: "信用卡", creditCard: "國泰" },
        { date: "2026-05-20", category: "寵物", item: "貓砂", amount: 520, note: "貓砂", paymentMethod: "信用卡", creditCard: "玉山" },
      ],
    },
  ];
}

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

function groupByCategory(expenses: ExpenseLine[]) {
  return expenses.reduce<Record<string, ExpenseLine[]>>((groups, expense) => {
    groups[expense.category] = [...(groups[expense.category] ?? []), expense];
    return groups;
  }, {});
}

function groupByCreditCard(expenses: ExpenseLine[]) {
  return expenses.filter((line) => line.paymentMethod === "信用卡" && line.creditCard).reduce<Record<string, ExpenseLine[]>>((groups, expense) => {
    const card = expense.creditCard ?? "未指定";
    groups[card] = [...(groups[card] ?? []), expense];
    return groups;
  }, {});
}

export function HomeSummary({ viewer }: { viewer: Viewer }) {
  const [openedPersonId, setOpenedPersonId] = useState<string | null>(null);
  const [openedCategoryKey, setOpenedCategoryKey] = useState<string | null>(null);
  const [showCreditCard, setShowCreditCard] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("2026-06");
  const [scope, setScope] = useState<Scope>("month");
  const baseData = useMemo(() => getBaseData(viewer), [viewer]);

  const summaries = baseData.map((person) => {
    const expenses = scope === "all" ? person.expenses : person.expenses.filter((line) => line.date.startsWith(selectedMonth));
    return { ...person, expenses };
  });

  const allExpenses = summaries.flatMap((person) => person.expenses);
  const totalIncome = summaries.reduce((sum, item) => sum + (item.income ?? 0), 0);
  const totalExpense = allExpenses.reduce((sum, line) => sum + line.amount, 0);
  const creditCardGroups = groupByCreditCard(allExpenses);
  const creditCardTotal = Object.values(creditCardGroups).flat().reduce((sum, line) => sum + line.amount, 0);
  const balance = totalIncome - totalExpense;

  return (
    <section className="grid">
      <article className="card grid">
        <div className="row">
          <button className="btn secondary" type="button" onClick={() => setSelectedMonth((value) => shiftMonth(value, -1))}>上個月</button>
          <strong>{monthLabel(selectedMonth)}</strong>
          <button className="btn secondary" type="button" onClick={() => setSelectedMonth((value) => shiftMonth(value, 1))}>下個月</button>
        </div>
        <div className="row">
          <button className={scope === "month" ? "btn" : "btn secondary"} type="button" onClick={() => setScope("month")}>當月</button>
          <button className={scope === "all" ? "btn" : "btn secondary"} type="button" onClick={() => setScope("all")}>全部月份</button>
        </div>
      </article>

      {summaries.map((person) => {
        const isOpen = openedPersonId === person.id;
        const expenseTotal = person.expenses.reduce((sum, line) => sum + line.amount, 0);
        const grouped = groupByCategory(person.expenses);
        return (
          <article className="card grid" key={person.id}>
            <button
              className="row"
              type="button"
              onClick={() => {
                setOpenedPersonId(isOpen ? null : person.id);
                setOpenedCategoryKey(null);
              }}
              style={{ border: 0, background: "transparent", padding: 0, textAlign: "left" }}
            >
              <div>
                <h2 style={{ margin: 0 }}>{person.name}</h2>
                <div className="muted">點一下看分類</div>
              </div>
              <span className="muted">{isOpen ? "收合" : "展開"}</span>
            </button>

            <div className="row"><span>收入</span><strong>{person.income === undefined ? "-" : money(person.income)}</strong></div>
            <div className="row"><span>支出</span><strong>{money(expenseTotal)}</strong></div>

            {isOpen ? (
              <div className="grid">
                {person.expenses.length === 0 ? <p className="muted">這個月份沒有資料</p> : null}
                {Object.entries(grouped).map(([category, lines]) => {
                  const categoryKey = `${person.id}-${category}`;
                  const isCategoryOpen = openedCategoryKey === categoryKey;
                  const categoryTotal = lines.reduce((sum, line) => sum + line.amount, 0);
                  return (
                    <div className="card grid" style={{ boxShadow: "none" }} key={categoryKey}>
                      <button
                        className="row"
                        type="button"
                        onClick={() => setOpenedCategoryKey(isCategoryOpen ? null : categoryKey)}
                        style={{ border: 0, background: "transparent", padding: 0, textAlign: "left" }}
                      >
                        <strong>{category}</strong>
                        <span className="muted">{money(categoryTotal)}・{isCategoryOpen ? "收合" : "明細"}</span>
                      </button>
                      {isCategoryOpen ? (
                        <div className="grid">
                          {lines.map((line) => (
                            <div className="row" key={`${person.id}-${line.date}-${line.item}-${line.amount}`}>
                              <span>{line.date.slice(5)}　{line.item}</span>
                              <span className="muted">{money(line.amount)}{line.note ? `・${line.note}` : ""}{line.creditCard ? `・${line.creditCard}` : ""}{line.paidBy ? `・${line.paidBy}付` : ""}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </article>
        );
      })}

      <article className="card grid">
        <h2>{scope === "month" ? "當月總結" : "全部月份總結"}</h2>
        <div className="row"><span>總收入</span><strong>{money(totalIncome)}</strong></div>
        <div className="row"><span>總支出</span><strong>{money(totalExpense)}</strong></div>
        <div className="row"><span>結餘</span><strong>{money(balance)}</strong></div>
      </article>

      <article className="card grid">
        <button
          className="row"
          type="button"
          onClick={() => setShowCreditCard((value) => !value)}
          style={{ border: 0, background: "transparent", padding: 0, textAlign: "left" }}
        >
          <div>
            <h2 style={{ margin: 0 }}>信用卡核對</h2>
            <div className="muted">點一下看各卡消費</div>
          </div>
          <strong>{money(creditCardTotal)}</strong>
        </button>
        {showCreditCard ? (
          <div className="grid">
            {Object.entries(creditCardGroups).map(([cardName, lines]) => {
              const total = lines.reduce((sum, line) => sum + line.amount, 0);
              return (
                <div className="card grid" style={{ boxShadow: "none" }} key={cardName}>
                  <div className="row"><strong>{cardName}</strong><strong>{money(total)}</strong></div>
                  {lines.map((line) => (
                    <div className="row" key={`${cardName}-${line.date}-${line.item}`}>
                      <span>{line.date.slice(5)}　{line.item}</span>
                      <span className="muted">{money(line.amount)}・{line.note ?? line.category}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : null}
      </article>
    </section>
  );
}
