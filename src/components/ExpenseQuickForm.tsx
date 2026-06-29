"use client";

import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/components/AuthGate";
import { EXPENSE_CATEGORIES, HOME_FEE_ITEMS, PAYMENT_METHOD_LABELS, TAX_ITEMS } from "@/lib/categories";
import { addExpenseRecord } from "@/lib/records";
import { ExpenseCategory, PaymentMethod, PersonTarget } from "@/types/domain";

type Props = {
  viewer: "chris" | "wife";
  onSaved?: () => void;
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function ExpenseQuickForm({ viewer, onSaved }: Props) {
  const user = useCurrentUser();
  const selfTarget: PersonTarget = viewer === "chris" ? "chris" : "wife";
  const creditCards = useMemo(() => getCreditCards(viewer), [viewer]);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [category, setCategory] = useState<ExpenseCategory>("餐飲");
  const [homeFeeItem, setHomeFeeItem] = useState<(typeof HOME_FEE_ITEMS)[number]>("水費");
  const [taxItem, setTaxItem] = useState<(typeof TAX_ITEMS)[number]>("牌照稅");
  const [target, setTarget] = useState<PersonTarget>(selfTarget);
  const [childPaidBy, setChildPaidBy] = useState<"self" | "spouse">("self");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [creditCard, setCreditCard] = useState<CreditCardName>(creditCards[0]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [privateNote, setPrivateNote] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
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

  function getSubItem() {
    if (category === "居家固定費") return homeFeeItem;
    if (category === "稅金") return taxItem;
    return "";
  }

  async function handleSave() {
    const parsedAmount = Number(amount);
    if (!user) {
      setMessage("請先登入。");
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      setMessage("請輸入正確金額。");
      return;
    }

    const paidBy = target === "junyao" && childPaidBy === "spouse"
      ? (viewer === "chris" ? "wife" : "chris")
      : viewer;
    const subItem = getSubItem();
    const finalNote = [subItem, note.trim()].filter(Boolean).join("・") || undefined;

    setIsSaving(true);
    setMessage("");
    try {
      await addExpenseRecord({
        date,
        amount: parsedAmount,
        category: isPrivate ? "個人雜支" : category,
        target,
        paidBy,
        paymentMethod,
        creditCard: paymentMethod === "credit_card" ? creditCard : undefined,
        note: finalNote,
        isPrivate,
        privateNote: isPrivate ? privateNote.trim() || undefined : undefined,
        createdBy: user.uid,
      });
      setAmount("");
      setNote("");
      setPrivateNote("");
      setMessage("已儲存到資料庫。");
      onSaved?.();
    } catch (error) {
      console.error(error);
      setMessage("儲存失敗，請確認 Firestore Database 已建立，並且安全規則已允許登入使用者讀寫。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="card grid">
      <h2>新增支出</h2>
      <p className="muted">一般支出預設就是目前登入者支付；只有竣堯的支出需要標記由誰付。</p>
      <label className="field">
        <span>日期</span>
        <input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <label className="field">
        <span>金額</span>
        <input className="input" type="number" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="例如 120" />
      </label>
      <label className="field">
        <span>類別</span>
        <select className="select" value={category} onChange={(event) => setCategory(event.target.value as ExpenseCategory)}>
          {EXPENSE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      {category === "居家固定費" ? (
        <label className="field">
          <span>居家固定費細項</span>
          <select className="select" value={homeFeeItem} onChange={(event) => setHomeFeeItem(event.target.value as (typeof HOME_FEE_ITEMS)[number])}>
            {HOME_FEE_ITEMS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      ) : null}
      {category === "稅金" ? (
        <label className="field">
          <span>稅金細項</span>
          <select className="select" value={taxItem} onChange={(event) => setTaxItem(event.target.value as (typeof TAX_ITEMS)[number])}>
            {TAX_ITEMS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      ) : null}
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
          <input className="input" value={privateNote} onChange={(event) => setPrivateNote(event.target.value)} placeholder="僅本人可見的品項或備註" />
        </label>
      ) : null}
      <label className="field">
        <span>備註</span>
        <input className="input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="可空白，或輸入補充說明" />
      </label>
      <button className="btn" type="button" onClick={handleSave} disabled={isSaving}>{isSaving ? "儲存中..." : "儲存"}</button>
      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
