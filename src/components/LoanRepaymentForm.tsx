"use client";

import { useState } from "react";
import { LOAN_REPAYMENT_MESSAGES, buildLoanRepayment, buildPendingRepayment, draftForExpense, repaymentStage } from "@/lib/loanRepayment";
import type { LoanExpenseLike } from "@/lib/loanRepayment";
import { LOAN_CONFIRMATION_LABELS, LOAN_KEYS, LOAN_KEY_LABELS, LOAN_REPAYMENT_CONFIRMATIONS, LOAN_REPAYMENT_STAGE_LABELS } from "@/types/loanRepayment";
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
 * 房貸／增貸還款明細（連結這筆既有支出，不新增支出），兩段式：
 * 1. 待銀行扣款：只選貸款與預定扣款日，Portfolio Steward 只顯示，不減少本金。
 * 2. 銀行已扣款：依銀行通知填實際扣款日、本金、利息、手續費；只有本金會減少貸款餘額。
 */
export function LoanRepaymentForm({ expense, existing, disabled, onSave, onSetStatus, onCancel }: Props) {
  const [draft, setDraft] = useState(() => draftForExpense(expense, existing));
  const [message, setMessage] = useState("");
  const isVoid = existing?.status === "VOID";
  const stage = existing ? repaymentStage(existing) : null;
  // A new detail starts as 待銀行扣款; the debit section opens on demand (or is the only view once debited).
  const [showDebit, setShowDebit] = useState(stage === "BANK_DEBITED");

  async function save(result: { ok: true; value: LoanRepaymentFields } | { ok: false; code: keyof typeof LOAN_REPAYMENT_MESSAGES }) {
    if (!result.ok) {
      setMessage(LOAN_REPAYMENT_MESSAGES[result.code]);
      return;
    }
    setMessage("");
    await onSave(result.value);
  }

  async function handleStatus(status: LoanRepaymentFields["status"]) {
    if (status === "VOID" && !window.confirm("確定要作廢這筆還款明細嗎？支出本身不會刪除。")) return;
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
    <div className="card grid compact-form" style={{ boxShadow: "none" }}>
      <p className="muted compact-form-title">
        還款明細（連結這筆 {expense.amount.toLocaleString("zh-TW")} 元支出）・{stage ? LOAN_REPAYMENT_STAGE_LABELS[stage] : "尚未建立"}{isVoid ? "・已作廢" : ""}
      </p>
      <div className="compact-form-fields">
        <label className="field field-pair">
          <span>貸款</span>
          <select className="select" value={draft.loanKey} disabled={isVoid} onChange={(event) => setDraft({ ...draft, loanKey: event.target.value })}>
            {LOAN_KEYS.map((key) => <option key={key} value={key}>{LOAN_KEY_LABELS[key]}</option>)}
          </select>
        </label>
        <label className="field field-pair">
          <span>預定扣款日（銀行通知上的應繳日）</span>
          <input className="input" type="date" value={draft.dueDate} disabled={isVoid} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} />
        </label>
        {showDebit ? <>
          <label className="field field-pair">
            <span>銀行實際扣款日</span>
            <input className="input" type="date" value={draft.paidDate} disabled={isVoid} onChange={(event) => setDraft({ ...draft, paidDate: event.target.value })} />
          </label>
          <label className="field field-pair">
            <span>確認方式</span>
            <select className="select" value={draft.confirmation} disabled={isVoid} onChange={(event) => setDraft({ ...draft, confirmation: event.target.value })}>
              {LOAN_REPAYMENT_CONFIRMATIONS.map((key) => <option key={key} value={key}>{LOAN_CONFIRMATION_LABELS[key]}</option>)}
            </select>
          </label>
          <div className="compact-form-amounts">
            {number("principal", "本金")}
            {number("interest", "利息")}
            {number("fee", "手續費")}
          </div>
        </> : null}
      </div>
      <div className="compact-form-actions">
        {isVoid ? null : !showDebit ? <>
          <button className="btn" type="button" disabled={disabled} onClick={() => save(buildPendingRepayment(expense, draft, existing))}>
            {stage === "PENDING_DEBIT" ? "儲存待扣款" : "設為待銀行扣款"}</button>
          <button className="btn secondary" type="button" disabled={disabled} onClick={() => setShowDebit(true)}>銀行已扣款…</button>
        </> : <>
          <button className="btn" type="button" disabled={disabled} onClick={() => save(buildLoanRepayment(expense, draft, existing))}>
            {stage === "BANK_DEBITED" ? "儲存修改" : "確認銀行已扣款"}</button>
          {stage !== "BANK_DEBITED" ? <button className="btn secondary" type="button" disabled={disabled} onClick={() => setShowDebit(false)}>返回</button> : null}
        </>}
        {existing && !isVoid ? <button className="btn secondary" type="button" disabled={disabled} onClick={() => handleStatus("VOID")}>作廢明細</button> : null}
        {isVoid ? <button className="btn" type="button" disabled={disabled} onClick={() => handleStatus("ACTIVE")}>還原明細</button> : null}
        <button className="btn secondary" type="button" disabled={disabled} onClick={onCancel}>取消</button>
      </div>
      {message ? <p className="muted">{message}</p> : null}
    </div>
  );
}
