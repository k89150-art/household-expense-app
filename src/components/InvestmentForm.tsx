"use client";

import { useState } from "react";

type InvestmentType = "定期定額" | "單筆買入" | "股息再投入" | "其他";

type InvestmentRecord = {
  id: string;
  date: string;
  type: InvestmentType;
  name: string;
  amount: number;
};

const INVESTMENT_TYPES: InvestmentType[] = ["定期定額", "單筆買入", "股息再投入", "其他"];
const STORAGE_KEY = "household-expense-demo-investments";

function loadRecords() {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as InvestmentRecord[];
  } catch {
    return [];
  }
}

export function InvestmentForm() {
  const [type, setType] = useState<InvestmentType>("定期定額");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");

  function handleSave() {
    const parsedAmount = Number(amount);
    if (!name.trim() || !parsedAmount || parsedAmount <= 0) {
      setMessage("請輸入投資名稱與正確金額。");
      return;
    }

    const record: InvestmentRecord = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      type,
      name: name.trim(),
      amount: parsedAmount,
    };

    const records = [...loadRecords(), record];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new Event("investment-records-updated"));

    setMessage(`已建立投資紀錄：${type} ${record.name} $${parsedAmount.toLocaleString("zh-TW")}。首頁會出現在「投資紀錄」。`);
    setName("");
    setAmount("");
  }

  return (
    <section className="card grid">
      <h2>新增投資紀錄</h2>
      <p className="muted">定期定額屬於資產轉換，不列入生活支出；會在首頁的「投資紀錄」另外統計。</p>
      <label className="field">
        <span>類型</span>
        <select className="select" value={type} onChange={(event) => setType(event.target.value as InvestmentType)}>
          {INVESTMENT_TYPES.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label className="field">
        <span>投資名稱</span>
        <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="例如 0050、VT、基金名稱" />
      </label>
      <label className="field">
        <span>金額</span>
        <input className="input" type="number" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="例如 5000" />
      </label>
      <button className="btn" type="button" onClick={handleSave}>儲存投資紀錄</button>
      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
