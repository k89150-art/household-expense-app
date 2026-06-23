"use client";

import { useState } from "react";

type Viewer = "chris" | "wife";

type PersonSummary = {
  id: "self" | "spouse" | "junyao" | "cat";
  name: string;
  income?: number;
  expense: number;
  details?: { label: string; amount: number; paidBy?: string }[];
};

function getSummaries(viewer: Viewer): PersonSummary[] {
  const spouseLabel = viewer === "chris" ? "太太" : "先生";
  const myLunch = viewer === "chris" ? [{ label: "醫院午餐", amount: 1680 }] : [];

  return [
    {
      id: "self",
      name: "我",
      income: viewer === "chris" ? 72000 : 30000,
      expense: viewer === "chris" ? 18450 : 12600,
      details: [
        ...myLunch,
        { label: "個人餐飲", amount: viewer === "chris" ? 3200 : 2500 },
        { label: "醫療", amount: 850 },
        { label: "保險", amount: viewer === "chris" ? 4200 : 3600 },
      ],
    },
    {
      id: "spouse",
      name: spouseLabel,
      income: viewer === "chris" ? 30000 : 72000,
      expense: viewer === "chris" ? 12600 : 18450,
      details: [
        { label: "生活費轉入", amount: 30000 },
        { label: "生活用品", amount: 4200 },
        { label: "個人餐飲", amount: viewer === "chris" ? 2500 : 3200 },
      ],
    },
    {
      id: "junyao",
      name: "竣堯",
      expense: 15800,
      details: [
        { label: "學費", amount: 12000, paidBy: viewer === "chris" ? "太太" : "我" },
        { label: "保健食品", amount: 1800, paidBy: viewer === "chris" ? "我" : "先生" },
        { label: "保險", amount: 1500, paidBy: viewer === "chris" ? "我" : "先生" },
        { label: "其他用品", amount: 500, paidBy: viewer === "chris" ? "太太" : "我" },
      ],
    },
    {
      id: "cat",
      name: "貓",
      expense: 2600,
      details: [
        { label: "飼料", amount: 1400 },
        { label: "醫療", amount: 1200 },
      ],
    },
  ];
}

function money(value = 0) {
  return `$${value.toLocaleString("zh-TW")}`;
}

export function HomeSummary({ viewer }: { viewer: Viewer }) {
  const [openedId, setOpenedId] = useState<string | null>(null);
  const summaries = getSummaries(viewer);
  const totalIncome = summaries.reduce((sum, item) => sum + (item.income ?? 0), 0);
  const totalExpense = summaries.reduce((sum, item) => sum + item.expense, 0);
  const balance = totalIncome - totalExpense;

  return (
    <section className="grid">
      {summaries.map((person) => {
        const isOpen = openedId === person.id;
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
                <div className="muted">點一下看細項</div>
              </div>
              <span className="muted">{isOpen ? "收合" : "展開"}</span>
            </button>

            <div className="row">
              <span>收入</span>
              <strong>{person.income === undefined ? "-" : money(person.income)}</strong>
            </div>
            <div className="row">
              <span>支出</span>
              <strong>{money(person.expense)}</strong>
            </div>

            {isOpen && person.details ? (
              <div className="grid">
                {person.details.map((detail) => (
                  <div className="row" key={`${person.id}-${detail.label}`}>
                    <span>{detail.label}</span>
                    <span className="muted">
                      {money(detail.amount)}{detail.paidBy ? `・${detail.paidBy}付` : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}

      <article className="card grid">
        <h2>總結</h2>
        <div className="row"><span>總收入</span><strong>{money(totalIncome)}</strong></div>
        <div className="row"><span>總支出</span><strong>{money(totalExpense)}</strong></div>
        <div className="row"><span>本月結餘</span><strong>{money(balance)}</strong></div>
        <p className="muted" style={{ margin: 0 }}>正式登入後，每支手機都會顯示「我」與「配偶」，不會固定寫死人名。</p>
      </article>
    </section>
  );
}
