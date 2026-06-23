"use client";

import { useState } from "react";

type RecurringItem = {
  id: string;
  name: string;
  category: string;
  amount: number;
  target: string;
  payer: string;
  paymentMethod: string;
  note: string;
};

const DEFAULT_ITEMS: RecurringItem[] = [
  {
    id: "mortgage",
    name: "房貸",
    category: "房貸",
    amount: 25000,
    target: "家庭",
    payer: "Chris",
    paymentMethod: "銀行扣款",
    note: "每月固定帶入，可依利率調整",
  },
  {
    id: "insurance-chris-son",
    name: "保險：Chris 與兒子",
    category: "保險",
    amount: 6000,
    target: "Chris / 兒子",
    payer: "Chris",
    paymentMethod: "信用卡或轉帳",
    note: "一次繳清後分 12 期，每月帶入",
  },
  {
    id: "management-fee",
    name: "管理費",
    category: "管理費",
    amount: 2500,
    target: "家庭",
    payer: "家庭",
    paymentMethod: "轉帳",
    note: "社區管理費",
  },
  {
    id: "internet",
    name: "網路費",
    category: "網路費",
    amount: 999,
    target: "家庭",
    payer: "家庭",
    paymentMethod: "信用卡",
    note: "每月固定扣款",
  },
  {
    id: "subscription",
    name: "訂閱服務",
    category: "訂閱",
    amount: 390,
    target: "家庭",
    payer: "Chris",
    paymentMethod: "信用卡",
    note: "Netflix、iCloud 或其他訂閱可新增在這裡",
  },
];

export function RecurringExpensePanel() {
  const [items, setItems] = useState(DEFAULT_ITEMS);
  const [message, setMessage] = useState("");

  function updateAmount(id: string, amount: number) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, amount } : item));
  }

  function importThisMonth(item: RecurringItem) {
    setMessage(`已帶入展示紀錄：${item.name} $${item.amount.toLocaleString("zh-TW")}`);
  }

  return (
    <section className="card grid">
      <h2>固定支出模板</h2>
      <p className="muted">這裡之後會存成模板。每月只要按「本月帶入」，就會自動新增成當月支出。</p>
      {items.map((item) => (
        <article key={item.id} className="card grid" style={{ boxShadow: "none" }}>
          <div className="row">
            <div>
              <strong>{item.name}</strong>
              <div className="muted">{item.category}・{item.target}・{item.paymentMethod}</div>
            </div>
            <strong>${item.amount.toLocaleString("zh-TW")}</strong>
          </div>
          <label className="field">
            <span>金額</span>
            <input className="input" type="number" value={item.amount} onChange={(event) => updateAmount(item.id, Number(event.target.value))} />
          </label>
          <p className="muted" style={{ margin: 0 }}>{item.note}</p>
          <button className="btn secondary" type="button" onClick={() => importThisMonth(item)}>本月帶入</button>
        </article>
      ))}
      <button className="btn" type="button" onClick={() => setMessage("之後會開啟新增固定支出模板")}>新增固定支出模板</button>
      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
