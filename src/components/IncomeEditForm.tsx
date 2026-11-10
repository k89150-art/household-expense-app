"use client";

import { useState } from "react";
import { INCOME_EDIT_MESSAGES, buildIncomeChanges, draftFromIncome, editableIncomeCategories } from "@/lib/incomeEdit";
import type { IncomeRecordChanges } from "@/lib/incomeEdit";
import type { IncomeRecord } from "@/types/income";

type Props = {
  record: IncomeRecord;
  disabled: boolean;
  onSave: (changes: IncomeRecordChanges) => Promise<void>;
  onCancel: () => void;
};

/** 收入原地修改：只改日期、名目、金額與備註；成員（owner）與文件 ID 不變。 */
export function IncomeEditForm({ record, disabled, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState(() => draftFromIncome(record));
  const [message, setMessage] = useState("");
  const categories = editableIncomeCategories(record.category);

  async function handleSave() {
    const result = buildIncomeChanges(record, draft);
    if (!result.ok) {
      setMessage(INCOME_EDIT_MESSAGES[result.code]);
      return;
    }
    setMessage("");
    await onSave(result.changes);
  }

  return (
    <div className="card grid" style={{ boxShadow: "none" }}>
      <label className="field">
        <span>日期</span>
        <input className="input" type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
      </label>
      <label className="field">
        <span>收入名目</span>
        <select className="select" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
          {categories.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label className="field">
        <span>金額</span>
        <input className="input" type="number" inputMode="decimal" step="1" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} />
      </label>
      <label className="field">
        <span>備註</span>
        <input className="input" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
      </label>
      <div className="row">
        <button className="btn" type="button" disabled={disabled} onClick={handleSave}>儲存修改</button>
        <button className="btn secondary" type="button" disabled={disabled} onClick={onCancel}>取消</button>
      </div>
      {message ? <p className="muted">{message}</p> : null}
    </div>
  );
}
