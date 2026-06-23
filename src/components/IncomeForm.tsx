"use client";

import { useState } from "react";

type IncomeType = "本薪" | "獎勵金" | "加班費" | "年終" | "生活費轉入" | "其他";

const INCOME_TYPES: IncomeType[] = ["本薪", "獎勵金", "加班費", "年終", "生活費轉入", "其他"];

export function IncomeForm() {
  const [incomeType, setIncomeType] = useState<IncomeType>("本薪");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  function handleSave() {
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setMessage("請輸入正確收入金額。");
      return;
    }
    setMessage(`已建立展示收入：${incomeType} $${parsedAmount.toLocaleString("zh-TW")}${note ? `，${note}` : ""}`);
    setAmount("");
    setNote("");
  }

  return (
    <section className="card grid">
      <h2>新增收入</h2>
      <p className="muted">醫院薪資若分不同名目入帳，可以分開新增，之後報表會合併成當月收入。</p>
      <label className="field">
        <span>收入名目</span>
        <select className="select" value={incomeType} onChange={(event) => setIncomeType(event.target.value as IncomeType)}>
          {INCOME_TYPES.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label className="field">
        <span>金額</span>
        <input className="input" type="number" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="例如 52000" />
      </label>
      <label className="field">
        <span>備註</span>
        <input className="input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如 6 月本薪、獎勵金、夜班費" />
      </label>
      <button className="btn" type="button" onClick={handleSave}>儲存收入</button>
      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
