"use client";

import { useState } from "react";
import { EXPENSE_CATEGORIES, PAYMENT_METHOD_LABELS, TARGET_LABELS } from "@/lib/categories";
import { ExpenseCategory, PaymentMethod, PersonTarget } from "@/types/domain";

export function ExpenseQuickForm() {
  const [category, setCategory] = useState<ExpenseCategory>("餐飲");
  const [target, setTarget] = useState<PersonTarget>("family");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [isPrivate, setIsPrivate] = useState(false);

  return (
    <section className="card grid">
      <h2>新增支出</h2>
      <label className="field">
        <span>金額</span>
        <input className="input" type="number" inputMode="decimal" placeholder="例如 120" />
      </label>
      <label className="field">
        <span>類別</span>
        <select className="select" value={category} onChange={(event) => setCategory(event.target.value as ExpenseCategory)}>
          {EXPENSE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label className="field">
        <span>消費歸屬</span>
        <select className="select" value={target} onChange={(event) => setTarget(event.target.value as PersonTarget)}>
          {Object.entries(TARGET_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="field">
        <span>付款方式</span>
        <select className="select" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="row" style={{ justifyContent: "flex-start" }}>
        <input type="checkbox" checked={isPrivate} onChange={(event) => setIsPrivate(event.target.checked)} />
        <span>私人明細，共同帳本顯示「個人雜支」</span>
      </label>
      {isPrivate ? (
        <label className="field">
          <span>私人明細</span>
          <input className="input" placeholder="只有本人可見，例如陀螺" />
        </label>
      ) : null}
      <label className="field">
        <span>備註</span>
        <input className="input" placeholder="例如醫院訂飯、全聯、管理費" />
      </label>
      <button className="btn">儲存</button>
    </section>
  );
}
