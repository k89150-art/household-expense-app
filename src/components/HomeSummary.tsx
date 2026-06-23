"use client";

import { useMemo, useState } from "react";

type Viewer = "chris" | "wife";
type Scope = "month" | "all";
type PersonId = "self" | "spouse" | "junyao" | "cat";

type ExpenseLine = {
  date: string;
  item: string;
  amount: number;
  paidBy?: string;
};

type PersonSummary = {
  id: PersonId;
  name: string;
  income?: number;
  expenses: ExpenseLine[];
};

function getBaseData(viewer: Viewer): PersonSummary[] {
  const spouseLabel = viewer === "chris" ? "太太" : "先生";
  const lunch = viewer === "chris" ? [{ date: "2026-06-21", item: "醫院午餐", amount: 420 }] : [];

  return [
    {
      id: "self",
      name: "我",
      income: viewer === "chris" ? 72000 : 30000,
      expenses: [
        ...lunch,
        { date: "2026-06-03", item: "早餐", amount: 90 },
        { date: "2026-06-08", item: "保險", amount: viewer === "chris" ? 4200 : 3600 },
        { date: "2026-06-18", item: "醫療", amount: 850 },
        { date: "2026-05-12", item: "個人餐飲", amount: 1800 },
      ],
    },
    {
      id: "spouse",
      name: spouseLabel,
      income: viewer === "chris" ? 30000 : 72000,
      expenses: [
        { date: "2026-06-02", item: "生活用品", amount: 1200 },
        { date: "2026-06-15", item: "餐飲", amount: viewer === "chris" ? 2500 : 3200 },
        { date: "2026-05-08", item: "衣物", amount: 980 },
      ],
    },
    {
      id: "junyao",
      name: "竣堯",
      expenses: [
        { date: "2026-06-01", item: "學費", amount: 12000, paidBy: viewer === "chris" ? "太太" : "我" },
        { date: "2026-06-05", item: "保健食品", amount: 1800, paidBy: viewer === "chris" ? "我" : "先生" },
        { date: "2026-06-10", item: "保險", amount: 1500, paidBy: viewer === "chris" ? "我" : "先生" },
        { date: "2026-06-20", item: "延托費", amount: 2500, paidBy: viewer === "chris" ? "太太" : "我" },
        { date: "2026-05-03", item: "童書", amount: 600, paidBy: viewer === "chris" ? "太太" : "我" },
      ],
    },
    {
      id: "cat",
      name: "貓",
      expenses: [
        { date: "2026-06-06", item: "飼料", amount: 1400 },
        { date: "2026-06-19", item: "醫療", amount: 1200 },
        { date: "2026-05-20", item: "貓砂", amount: 520 },
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

export function HomeSummary({ viewer }: { viewer: Viewer }) {
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState("2026-06");
  const [scope, setScope] = useState<Scope>("month");
  const baseData = useMemo(() => getBaseData(viewer), [viewer]);

  const summaries = baseData.map((person) => {
    const expenses = scope === "all" ? person.expenses : person.expenses.filter((line) => line.date.startsWith(selectedMonth));
    return { ...person, expenses };
  });

  const totalIncome = summaries.reduce((sum, item) => sum + (item.income ?? 0), 0);
  const totalExpense = summaries.reduce((sum, item) => sum + item.expenses.reduce((subtotal, line) => subtotal + line.amount, 0), 0);
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
        const isOpen = openedId === person.id;
        const expenseTotal = person.expenses.reduce((sum, line) => sum + line.amount, 0);
        return (
          <article className="card grid" key={person.id}>
            <button
              className="row"
              type="button"
              onClick={() => setOpenedId(isOpen ? null : person.id)}
              style={{ border: 0, background: "transparent", padding: 0, textAlign: "left" }}
            >
              <div>
                <h2 style={{ margin: 0 }}>{person.name}</h2>
                <div className="muted">點一下看明細</div>
              </div>
              <span className="muted">{isOpen ? "收合" : "展開"}</span>
            </button>

            <div className="row"><span>收入</span><strong>{person.income === undefined ? "-" : money(person.income)}</strong></div>
            <div className="row"><span>支出</span><strong>{money(expenseTotal)}</strong></div>

            {isOpen ? (
              <div className="grid">
                {person.expenses.length === 0 ? <p className="muted">這個月份沒有資料</p> : null}
                {person.expenses.map((line) => (
                  <div className="row" key={`${person.id}-${line.date}-${line.item}`}>
                    <span>{line.date.slice(5)}　{line.item}</span>
                    <span className="muted">{money(line.amount)}{line.paidBy ? `・${line.paidBy}付` : ""}</span>
                  </div>
                ))}
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
    </section>
  );
}
