"use client";

import { useState } from "react";
import { LOAN_REPAYMENT_MESSAGES, buildLoanRepayment, draftForExpense } from "@/lib/loanRepayment";
import type { LoanExpenseLike } from "@/lib/loanRepayment";
import { LOAN_CONFIRMATION_LABELS, LOAN_KEYS, LOAN_KEY_LABELS, LOAN_REPAYMENT_CONFIRMATIONS } from "@/types/loanRepayment";
import type { LoanRepaymentFields, LoanRepaymentRecord } from "@/types/loanRepayment";

type Props = {
  expense: LoanExpenseLike;
  existing: LoanRepaymentRecord | null;
  disabled: boolean;
  onSave: (fields: LoanRepaymentFields) => Promise<void>;
  onSetStatus: (status: LoanRepaymentFields["status"]) => Promise<void>;
  onCancel: () => void;
};

/**
 * 房貸／增貸還款明細：連結這筆既有支出（不新增支出）。本金、利息、手續費依銀行通知填寫，
 * 三者合計必須等於支出金額。只有本金會在 Portfolio Steward 減少貸款餘額。
 */
export function LoanRepaymentForm({ expense, existing, disabled, onSave, onSetStatus, onCancel }: Props) {
  const [draft, setDraft] = useState(() => draftForExpense(expense, existing));
  const [message, setMessage] = useState("");
  const isVoid = existing?.status === "VOID";

  async function handleSave() {
    const result = buildLoanRepayment(expense, draft, existing);
    if (!result.ok) {
      setMessage(LOAN_REPAYMENT_MESSAGES[result.code]);
      return;
    }
    setMessage("");
    await onSave(result.value);
  }

  async function handleStatus(status: LoanRepaymentFields["status"]) {
    if (status === "VOID" && !window.confirm("確定要作廢這筆還款明細嗎？支出本身不會刪除。")) return;
    if (status === "ACTIVE") {
      // 還原前重新驗證：支出金額若已不同，必須先修正明細。
      const result = buildLoanRepayment(expense, draftForExpense(expense, existing), null);
      if (!result.ok) {
        setMessage(LOAN_REPAYMENT_MESSAGES[result.code]);
        return;
      }
    }
    setMessage("");
    await onSetStatus(status);
  }

  const number = (key: "principal" | "interest" | "fee", label: string) => (
    <label className="field">
      <span>{label}</span>
      <input className="input" type="number" inputMode="numeric" min="0" step="1" value={draft[key]} disabled={isVoid}
        onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
    </label>
  );

  return (
    <div className="card grid" style={{ boxShadow: "none" }}>
      <p className="muted">還款明細（連結這筆 {expense.amount.toLocaleString("zh-TW")} 元支出）{isVoid ? "・已作廢" : ""}</p>
      <label className="field">
        <span>貸款</span>
        <select className="select" value={draft.loanKey} disabled={isVoid} onChange={(event) => setDraft({ ...draft, loanKey: event.target.value })}>
          {LOAN_KEYS.map((key) => <option key={key} value={key}>{LOAN_KEY_LABELS[key]}</option>)}
        </select>
      </label>
      <label className="field">
        <span>應繳日（銀行通知上的期別）</span>
        <input className="input" type="date" value={draft.dueDate} disabled={isVoid} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} />
      </label>
      <label className="field">
        <span>實際扣款日</span>
        <input className="input" type="date" value={draft.paidDate} disabled={isVoid} onChange={(event) => setDraft({ ...draft, paidDate: event.target.value })} />
      </label>
      {number("principal", "本金")}
      {number("interest", "利息")}
      {number("fee", "手續費")}
      <label className="field">
        <span>確認方式</span>
        <select className="select" value={draft.confirmation} disabled={isVoid} onChange={(event) => setDraft({ ...draft, confirmation: event.target.value })}>
          {LOAN_REPAYMENT_CONFIRMATIONS.map((key) => <option key={key} value={key}>{LOAN_CONFIRMATION_LABELS[key]}</option>)}
        </select>
      </label>
      <div className="row">
        {isVoid ? null : <button className="btn" type="button" disabled={disabled} onClick={handleSave}>{existing ? "儲存修改" : "建立還款明細"}</button>}
        {existing && !isVoid ? <button className="btn secondary" type="button" disabled={disabled} onClick={() => handleStatus("VOID")}>作廢明細</button> : null}
        {isVoid ? <button className="btn" type="button" disabled={disabled} onClick={() => handleStatus("ACTIVE")}>還原明細</button> : null}
        <button className="btn secondary" type="button" disabled={disabled} onClick={onCancel}>取消</button>
      </div>
      {message ? <p className="muted">{message}</p> : null}
    </div>
  );
}
