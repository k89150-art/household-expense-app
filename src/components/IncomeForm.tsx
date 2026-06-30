"use client";

import { useState } from "react";
import { useCurrentUser } from "@/components/AuthGate";
import { localDateString } from "@/lib/date";
import { Viewer, getViewerByEmail } from "@/lib/household";
import { addIncomeRecord } from "@/lib/records";

type IncomeType = "本薪" | "獎勵金" | "加班費" | "年終" | "生活費轉入" | "其他";

type Props = {
  viewer?: Viewer;
  onSaved?: () => void;
};

const INCOME_TYPES: IncomeType[] = ["本薪", "獎勵金", "加班費", "年終", "生活費轉入", "其他"];

export function IncomeForm({ viewer, onSaved }: Props) {
  const user = useCurrentUser();
  const owner = viewer ?? getViewerByEmail(user?.email);
  const [date, setDate] = useState(localDateString());
  const [incomeType, setIncomeType] = useState<IncomeType>("本薪");
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
    if (!parsedAmount || parsedAmount <= 0) {
      setMessage("請輸入正確收入金額。");
      return;
    }

    setIsSaving(true);
    setMessage("");
    try {
      await addIncomeRecord({
        date,
        amount: parsedAmount,
        owner,
        category: incomeType,
        note: note.trim() || undefined,
        createdBy: user.uid,
      });
      setAmount("");
      setNote("");
      setMessage("已儲存收入到資料庫。");
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
      <h2>新增收入</h2>
      <p className="muted">醫院薪資若分不同名目入帳，可以分開新增，首頁會合併成當月收入。</p>
      <label className="field">
        <span>日期</span>
        <input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
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
      <button className="btn" type="button" onClick={handleSave} disabled={isSaving}>{isSaving ? "儲存中..." : "儲存收入"}</button>
      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
