"use client";

import { useMemo, useState } from "react";
import { calculatePrepaidWeeklyExpense } from "@/lib/calculations";

export function PrepaidSettlementForm() {
  const [previousBalance, setPreviousBalance] = useState(1000);
  const [topUpAmount, setTopUpAmount] = useState(0);
  const [currentBalance, setCurrentBalance] = useState(580);
  const [savedMessage, setSavedMessage] = useState("");

  const result = useMemo(() => {
    try {
      return calculatePrepaidWeeklyExpense({ previousBalance, topUpAmount, currentBalance });
    } catch {
      return null;
    }
  }, [previousBalance, topUpAmount, currentBalance]);

  function handleCreateExpense() {
    if (result === null) {
      setSavedMessage("金額有誤，請重新確認。");
      return;
    }
    setSavedMessage(`已建立展示紀錄：本週醫院午餐 $${result.toLocaleString("zh-TW")}`);
  }

  return (
    <section className="card grid">
      <h2>更新午餐餘額</h2>
      <p className="muted">書記每週告知剩餘金額後，輸入本次餘額，系統會自動反推本週醫院午餐支出。</p>
      <label className="field">
        <span>上次餘額</span>
        <input className="input" type="number" value={previousBalance} onChange={(event) => setPreviousBalance(Number(event.target.value))} />
      </label>
      <label className="field">
        <span>本週加值</span>
        <input className="input" type="number" value={topUpAmount} onChange={(event) => setTopUpAmount(Number(event.target.value))} />
      </label>
      <label className="field">
        <span>本次剩餘</span>
        <input className="input" type="number" value={currentBalance} onChange={(event) => setCurrentBalance(Number(event.target.value))} />
      </label>
      <div className="row">
        <span>本週醫院午餐</span>
        <strong>{result === null ? "請確認金額" : `$${result.toLocaleString("zh-TW")}`}</strong>
      </div>
      <button className="btn secondary" type="button" onClick={handleCreateExpense}>建立本週餐飲支出</button>
      {savedMessage ? <p className="muted">{savedMessage}</p> : null}
    </section>
  );
}
