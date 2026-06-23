"use client";

import { useState } from "react";

type InvestmentType = "定期定額" | "單筆買入" | "股息再投入" | "其他";

const INVESTMENT_TYPES: InvestmentType[] = ["定期定額", "單筆買入", "股息再投入", "其他"];

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
    setMessage(`已建立展示投資紀錄：${type} ${name.trim()} $${parsedAmount.toLocaleString("zh-TW")}。這不會列入生活支出。`);
    setName("");
    setAmount("");
  }

  return (
    <section className="card grid">
      <h2>新增投資紀錄</h2>
      <p className="muted">定期定額屬於資產轉換，不列入生活支出；之後會另外統計本月投資與現金流出。</p>
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
