"use client";

import { useState } from "react";
import { useCurrentUser } from "@/components/AuthGate";
import { localDateString } from "@/lib/date";
import { Viewer, getViewerByEmail } from "@/lib/household";
import { addInvestmentRecord } from "@/lib/records";

type InvestmentType = "定期定額" | "單筆買入" | "股息再投入" | "其他";

type Props = {
  viewer?: Viewer;
  onSaved?: () => void;
};

const INVESTMENT_TYPES: InvestmentType[] = ["定期定額", "單筆買入", "股息再投入", "其他"];

export function InvestmentForm({ viewer, onSaved }: Props) {
  const user = useCurrentUser();
  const owner = viewer ?? getViewerByEmail(user?.email);
  const [date, setDate] = useState(localDateString());
  const [type, setType] = useState<InvestmentType>("定期定額");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    const parsedAmount = Number(amount);
    if (!user) {
      setMessage("請先登入。");
      return;
    }
    if (!name.trim() || !parsedAmount || parsedAmount <= 0) {
      setMessage("請輸入投資名稱與正確金額。");
      return;
    }

    setIsSaving(true);
    setMessage("");
    try {
      await addInvestmentRecord({
        date,
        type,
        name: name.trim(),
        amount: parsedAmount,
        owner,
        note: note.trim() || undefined,
        createdBy: user.uid,
      });
      setMessage(`已儲存投資紀錄：${type} ${name.trim()} $${parsedAmount.toLocaleString("zh-TW")}。`);
      setName("");
      setAmount("");
      setNote("");
      onSaved?.();
    } catch (error) {
      console.error(error);
      setMessage("儲存失敗，請稍後再試或確認 Firestore rules。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="card grid">
      <h2>新增投資紀錄</h2>
      <p className="muted">定期定額屬於資產轉換，不列入生活支出；會在首頁的「投資紀錄」另外統計。</p>
      <label className="field">
        <span>日期</span>
        <input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
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
        <input className="input" type="number" inputMode="decimal" pattern="[0-9]*" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="例如 5000" />
      </label>
      <label className="field">
        <span>備註</span>
        <input className="input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如每月定期定額、券商扣款" />
      </label>
      <button className="btn" type="button" onClick={handleSave} disabled={isSaving}>{isSaving ? "儲存中..." : "儲存投資紀錄"}</button>
      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
