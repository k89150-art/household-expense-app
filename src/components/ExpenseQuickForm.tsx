"use client";

import { useEffect, useMemo, useState } from "react";
import { EXPENSE_CATEGORIES, PAYMENT_METHOD_LABELS } from "@/lib/categories";
import { ExpenseCategory, PaymentMethod, PersonTarget } from "@/types/domain";

type Props = {
  viewer: "chris" | "wife";
};

type CreditCardName = "玉山" | "台新" | "國泰" | "中信";

const VIEWER_LABEL = {
  chris: "我",
  wife: "我",
} as const;

const CHILD_PAYER_LABEL = {
  chris: { self: "我", spouse: "太太" },
  wife: { self: "我", spouse: "先生" },
} as const;

function getCreditCards(viewer: Props["viewer"]): CreditCardName[] {
  return viewer === "chris" ? ["玉山", "國泰", "中信"] : ["台新", "國泰", "中信"];
}

export function ExpenseQuickForm({ viewer }: Props) {
  const selfTarget: PersonTarget = viewer === "chris" ? "chris" : "wife";
  const creditCards = useMemo(() => getCreditCards(viewer), [viewer]);
  const [category, setCategory] = useState<ExpenseCategory>("餐飲");
  const [target, setTarget] = useState<PersonTarget>(selfTarget);
  const [childPaidBy, setChildPaidBy] = useState<"self" | "spouse">("self");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [creditCard, setCreditCard] = useState<CreditCardName>(creditCards[0]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setTarget(selfTarget);
    setCreditCard(creditCards[0]);
  }, [selfTarget, creditCards]);

  const targetLabels: { value: PersonTarget; label: string }[] = [
    { value: selfTarget, label: VIEWER_LABEL[viewer] },
    { value: "junyao", label: "竣堯" },
    { value: "cat", label: "貓" },
  ];

  function handleSave() {
    const targetLabel = targetLabels.find((item) => item.value === target)?.label ?? "我";
    const cardText = paymentMethod === "credit_card" ? `，信用卡：${creditCard}` : "";
    const base = `已建立展示紀錄：${isPrivate ? "個人雜支" : category}，歸屬：${targetLabel}${cardText}`;
    const payerLabel = CHILD_PAYER_LABEL[viewer][childPaidBy];
    setMessage(target === "junyao" ? `${base}，${payerLabel}付` : base);
  }

  return (
    <section className="card grid">
      <h2>新增支出</h2>
      <p className="muted">一般支出預設就是目前登入者支付；只有竣堯的支出需要標記由誰付。</p>
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
          {targetLabels.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      {target === "junyao" ? (
        <label className="field">
          <span>竣堯支出由誰付</span>
          <select className="select" value={childPaidBy} onChange={(event) => setChildPaidBy(event.target.value as "self" | "spouse")}>
            <option value="self">{CHILD_PAYER_LABEL[viewer].self}</option>
            <option value="spouse">{CHILD_PAYER_LABEL[viewer].spouse}</option>
          </select>
        </label>
      ) : null}
      <label className="field">
        <span>付款方式</span>
        <select className="select" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {paymentMethod === "credit_card" ? (
        <label className="field">
          <span>選擇信用卡</span>
          <select className="select" value={creditCard} onChange={(event) => setCreditCard(event.target.value as CreditCardName)}>
            {creditCards.map((card) => <option key={card}>{card}</option>)}
          </select>
        </label>
      ) : null}
      <label className="row" style={{ justifyContent: "flex-start" }}>
        <input type="checkbox" checked={isPrivate} onChange={(event) => setIsPrivate(event.target.checked)} />
        <span>私人明細，共同帳本顯示「個人雜支」</span>
      </label>
      {isPrivate ? (
        <label className="field">
          <span>私人明細</span>
          <input className="input" placeholder="僅本人可見的品項或備註" />
        </label>
      ) : null}
      <label className="field">
        <span>備註</span>
        <input className="input" placeholder="例如醫院訂飯、全聯、管理費" />
      </label>
      <button className="btn" type="button" onClick={handleSave}>儲存</button>
      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
