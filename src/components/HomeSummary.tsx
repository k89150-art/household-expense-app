"use client";

import { useState } from "react";

type PersonSummary = {
  id: string;
  name: string;
  income?: number;
  expense: number;
  details?: { label: string; amount: number; paidBy?: string }[];
};

const personSummaries: PersonSummary[] = [
  {
    id: "chris",
    name: "我",
    income: 72000,
    expense: 18450,
    details: [
      { label: "醫院午餐", amount: 1680 },
      { label: "個人餐飲", amount: 3200 },
      { label: "醫療", amount: 850 },
      { label: "保險", amount: 4200 },
    ],
  },
  {
    id: "wife",
    name: "太太",
    income: 30000,
    expense: 12600,
    details: [
      { label: "生活費轉入", amount: 30000 },
      { label: "生活用品", amount: 4200 },
      { label: "個人餐飲", amount: 2500 },
    ],
  },
  {
    id: "junyao",
    name: "竣堯",
    expense: 15800,
    details: [
      { label: "學費", amount: 12000, paidBy: "太太" },
      { label: "保健食品", amount: 1800, paidBy: "我" },
      { label: "保險", amount: 1500, paidBy: "我" },
      { label: "其他用品", amount: 500, paidBy: "太太" },
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

function money(value = 0) {
  return `$${value.toLocaleString("zh-TW")}`;
}

export function HomeSummary() {
  const [openedId, setOpenedId] = useState<string | null>(null);
  const totalIncome = personSummaries.reduce((sum, item) => sum + (item.income ?? 0), 0);
  const totalExpense = personSummaries.reduce((sum, item) => sum + item.expense, 0);
  const balance = totalIncome - totalExpense;

  return (
    <section className="grid">
      {personSummaries.map((person) => {
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
        <p className="muted" style={{ margin: 0 }}>首頁只顯示收入與支出；需要細項時再展開。</p>
      </article>
    </section>
  );
}
