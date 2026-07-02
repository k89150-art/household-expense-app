"use client";

import { useMemo, useState } from "react";
import { useCurrentUser } from "@/components/AuthGate";
import { localDateString } from "@/lib/date";
import { Viewer, getViewerByEmail } from "@/lib/household";
import { addAdvanceRecord, CreditCardName } from "@/lib/records";
import { PaymentMethod } from "@/types/domain";

type Props = { viewer?: Viewer; onSaved?: () => void };
type AdvanceStatus = "待處理" | "已送件" | "已收回";

function getCards(viewer: Viewer): CreditCardName[] {
  return viewer === "chris" ? ["玉山", "國泰", "中信"] : ["台新", "國泰", "中信"];
}

export function AdvanceForm({ viewer, onSaved }: Props) {
  const user = useCurrentUser();
  const owner = viewer ?? getViewerByEmail(user?.email);
  const cards = useMemo(() => getCards(owner), [owner]);
  const [date, setDate] = useState(localDateString());
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<AdvanceStatus>("待處理");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credit_card");
  const [creditCard, setCreditCard] = useState<CreditCardName>(cards[0]);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    const parsedAmount = Number(amount);
    if (!user) {
      setMessage("請先登入。");
      return;
    }
    if (!item.trim() || !parsedAmount || parsedAmount <= 0) {
      setMessage("請輸入項目與正確金額。");
      return;
    }
    setIsSaving(true);
    setMessage("");
    try {
      await addAdvanceRecord({
        date,
        amount: parsedAmount,
        owner,
        item: item.trim(),
        target: "醫院",
        status: status === "待處理" ? "待核銷" : status,
        paymentMethod,
        creditCard: paymentMethod === "credit_card" ? creditCard : undefined,
        note: note.trim() || undefined,
        createdBy: user.uid,
      });
      setItem("");
      setAmount("");
      setNote("");
      setMessage("已儲存代墊款，這筆不列入生活支出。");
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
      <h2>新增代墊款</h2>
      <p className="muted">例如課程、報名、差旅等先付款後補回的款項；會進信用卡核對，但不算生活支出。</p>
      <label className="field"><span>日期</span><input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <label className="field"><span>項目</span><input className="input" value={item} onChange={(event) => setItem(event.target.value)} placeholder="例如課程報名" /></label>
      <label className="field"><span>金額</span><input className="input" type="number" inputMode="decimal" pattern="[0-9]*" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="例如 3000" /></label>
      <label className="field"><span>狀態</span><select className="select" value={status} onChange={(event) => setStatus(event.target.value as AdvanceStatus)}><option>待處理</option><option>已送件</option><option>已收回</option></select></label>
      <label className="field"><span>付款方式</span><select className="select" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}><option value="cash">現金</option><option value="credit_card">信用卡</option><option value="other">其他</option></select></label>
      {paymentMethod === "credit_card" ? <label className="field"><span>信用卡</span><select className="select" value={creditCard} onChange={(event) => setCreditCard(event.target.value as CreditCardName)}>{cards.map((card) => <option key={card}>{card}</option>)}</select></label> : null}
      <label className="field"><span>備註</span><input className="input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如課程名稱或單號" /></label>
      <button className="btn" type="button" onClick={handleSave} disabled={isSaving}>{isSaving ? "儲存中..." : "儲存代墊款"}</button>
      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
