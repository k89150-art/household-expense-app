"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/components/AuthGate";
import { addExpenseRecord, deleteRecurringExpenseTemplate, getExpenseRecordsByMonth, getRecurringExpenseTemplates, upsertRecurringExpenseTemplate } from "@/lib/records";
import type { CreditCardName, OwnerKey, RecurringExpenseTemplateRecord } from "@/lib/records";
import type { ExpenseCategory, PaymentMethod, PersonTarget } from "@/types/domain";

type Viewer = "chris" | "wife";
type Owner = "self" | "spouse" | "junyao" | "cat";

type RecurringItem = Omit<RecurringExpenseTemplateRecord, "householdId" | "createdBy" | "createdAt" | "updatedAt">;

function today() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNormalCreditCards(viewer: Viewer): CreditCardName[] {
  return viewer === "chris" ? ["玉山", "國泰", "中信"] : ["台新", "國泰", "中信"];
}

function labelForOwner(owner: Owner, viewer: Viewer) {
  if (owner === "self") return "我";
  if (owner === "spouse") return viewer === "chris" ? "太太" : "先生";
  if (owner === "junyao") return "竣堯";
  return "貓";
}

function toTarget(owner: Owner, viewer: Viewer): PersonTarget {
  if (owner === "self") return viewer;
  if (owner === "spouse") return viewer === "chris" ? "wife" : "chris";
  if (owner === "junyao") return "junyao";
  return "cat";
}

function toPaymentMethod(item: RecurringItem): PaymentMethod {
  if (item.paymentMethod === "信用卡") return "credit_card";
  if (item.paymentMethod === "現金") return "cash";
  if (item.paymentMethod === "轉帳" || item.paymentMethod === "銀行扣款") return "bank_transfer";
  return "other";
}

function toExpenseCategory(item: RecurringItem): ExpenseCategory {
  if (item.name.includes("手機") || item.category.includes("電話")) return "手機門號費";
  if (item.name.includes("網路") || item.category.includes("網路")) return "網路費";
  if (item.name.includes("保險") || item.category.includes("保險")) return "保險";
  if (item.name.includes("學費") || item.name.includes("延托") || item.category.includes("學費")) return "學費";
  if (item.name.includes("管理費") || item.category.includes("管理費") || item.name.includes("房貸")) return "居家固定費";
  return "其他";
}

function isSubscriptionItem(item: RecurringItem) {
  return item.category === "訂閱" || item.name.startsWith("訂閱：");
}

const DEFAULT_ITEMS: RecurringItem[] = [
  { id: "mortgage", name: "房貸", category: "房貸", amount: 25000, target: "self", paymentMethod: "銀行扣款", visibleFor: ["chris"] },
  { id: "mobile-chris", name: "手機門號費", category: "手機門號費", amount: 699, target: "self", paymentMethod: "銀行扣款", visibleFor: ["chris"] },
  { id: "mobile-wife", name: "手機門號費", category: "手機門號費", amount: 699, target: "self", paymentMethod: "銀行扣款", visibleFor: ["wife"] },
  { id: "insurance-self-chris", name: "保險：我", category: "保險", amount: 4200, target: "self", paymentMethod: "信用卡", creditCard: "台新", visibleFor: ["chris"] },
  { id: "insurance-self-wife", name: "保險：我", category: "保險", amount: 3600, target: "self", paymentMethod: "信用卡", creditCard: "保費卡", visibleFor: ["wife"] },
  { id: "insurance-junyao", name: "保險：竣堯", category: "保險", amount: 1500, target: "junyao", paymentMethod: "信用卡", creditCard: "台新", visibleFor: ["chris"] },
  { id: "school-fee", name: "竣堯學費", category: "學費", amount: 12000, target: "junyao", paymentMethod: "轉帳", visibleFor: ["chris", "wife"] },
  { id: "after-school-care", name: "竣堯延托費", category: "學費", amount: 2500, target: "junyao", paymentMethod: "轉帳", visibleFor: ["wife"] },
  { id: "management-fee", name: "管理費", category: "管理費", amount: 2500, target: "self", paymentMethod: "現金", visibleFor: ["chris"] },
  { id: "internet", name: "網路費", category: "網路費", amount: 999, target: "self", paymentMethod: "銀行扣款", visibleFor: ["chris"] },
];

const STORAGE_KEY = "household-expense-recurring-items";

function normalizeRecurringItem(item: RecurringItem): RecurringItem {
  if (item.id === "mobile-chris" || item.id === "mobile-wife") {
    return { ...item, name: "手機門號費", category: "手機門號費", paymentMethod: "銀行扣款", creditCard: undefined };
  }
  if (item.id === "internet") {
    return { ...item, category: "網路費", paymentMethod: "銀行扣款", creditCard: undefined };
  }
  if (item.id === "management-fee") {
    return { ...item, paymentMethod: "現金", creditCard: undefined };
  }
  if (item.id === "insurance-self-chris" || item.id === "insurance-junyao") {
    return { ...item, category: "保險", paymentMethod: "信用卡", creditCard: "台新" };
  }
  return item;
}

function mergeDefaultItems(storedItems: RecurringItem[]) {
  const normalizedItems = storedItems.map(normalizeRecurringItem);
  const existingIds = new Set(normalizedItems.map((item) => item.id));
  const missingDefaults = DEFAULT_ITEMS.filter((item) => !existingIds.has(item.id));
  return [...normalizedItems, ...missingDefaults];
}

function loadStoredItems() {
  if (typeof window === "undefined") return DEFAULT_ITEMS;
  const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem("household-expense-demo-recurring-items");
  if (!raw) return DEFAULT_ITEMS;
  try {
    return mergeDefaultItems(JSON.parse(raw) as RecurringItem[]);
  } catch {
    return DEFAULT_ITEMS;
  }
}

function templateSnapshot(item: RecurringItem) {
  return {
    name: item.name,
    category: item.category,
    amount: item.amount,
    target: item.target,
    paymentMethod: item.paymentMethod,
    creditCard: item.creditCard,
    visibleFor: item.visibleFor,
  };
}

async function saveTemplateToCloud(item: RecurringItem, userId: string) {
  await upsertRecurringExpenseTemplate({ ...item, createdBy: userId });
}

export function RecurringExpensePanel({ viewer }: { viewer: Viewer }) {
  const user = useCurrentUser();
  const [items, setItems] = useState<RecurringItem[]>(loadStoredItems);
  const visibleItems = useMemo(() => items.filter((item) => item.visibleFor.includes(viewer)), [items, viewer]);
  const creditCards = useMemo(() => getNormalCreditCards(viewer), [viewer]);
  const [selectedId, setSelectedId] = useState("");
  const [amountDraft, setAmountDraft] = useState("");
  const [expenseDate, setExpenseDate] = useState(today());
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);
  const [subscriptionName, setSubscriptionName] = useState("");
  const [subscriptionAmount, setSubscriptionAmount] = useState("");
  const [subscriptionCard, setSubscriptionCard] = useState<CreditCardName>(creditCards[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [isTemplateLoading, setIsTemplateLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    setSubscriptionCard(creditCards[0]);
  }, [creditCards]);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    const userId = user.uid;

    async function loadCloudTemplates() {
      setIsTemplateLoading(true);
      try {
        const cloudItems = await getRecurringExpenseTemplates();
        const normalizedCloudItems = cloudItems.map(normalizeRecurringItem);
        const seedItems = normalizedCloudItems.length > 0 ? mergeDefaultItems(normalizedCloudItems) : mergeDefaultItems(loadStoredItems());
        const cloudById = new Map(normalizedCloudItems.map((item) => [item.id, item]));
        const templatesToSave = normalizedCloudItems.length === 0
          ? seedItems
          : seedItems.filter((item) => {
            const cloudItem = cloudById.get(item.id);
            return !cloudItem || JSON.stringify(templateSnapshot(cloudItem)) !== JSON.stringify(templateSnapshot(item));
          });

        await Promise.all(templatesToSave.map((item) => saveTemplateToCloud(item, userId)));
        if (isMounted) {
          setItems(seedItems);
          setMessage(normalizedCloudItems.length > 0 ? "" : "固定支出模板已同步到雲端。");
        }
      } catch (error) {
        console.error(error);
        if (isMounted) setMessage("固定支出雲端同步失敗，暫時使用本機模板。");
      } finally {
        if (isMounted) setIsTemplateLoading(false);
      }
    }

    loadCloudTemplates();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const selectedItem = useMemo(() => visibleItems.find((item) => item.id === selectedId) ?? visibleItems[0], [selectedId, visibleItems]);

  useEffect(() => {
    if (selectedItem) {
      setSelectedId(selectedItem.id);
      setAmountDraft(String(selectedItem.amount));
    }
  }, [viewer, selectedItem]);

  async function updateSelectedAmount(value: string) {
    setAmountDraft(value);
    if (!selectedItem) return;
    if (value.trim() === "") return;
    const amount = Number(value);
    if (!Number.isFinite(amount)) return;
    const updatedItem = { ...selectedItem, amount };
    setItems((current) => current.map((item) => item.id === selectedItem.id ? updatedItem : item));
    if (user) await saveTemplateToCloud(updatedItem, user.uid);
  }

  async function updateSelectedCreditCard(card: CreditCardName) {
    if (!selectedItem) return;
    const updatedItem = { ...selectedItem, creditCard: card };
    setItems((current) => current.map((item) => item.id === selectedItem.id ? updatedItem : item));
    if (user) await saveTemplateToCloud(updatedItem, user.uid);
  }

  async function deleteSelectedSubscription() {
    if (!selectedItem || !isSubscriptionItem(selectedItem)) return;
    const ok = window.confirm(`確定要刪除「${selectedItem.name}」這個訂閱模板嗎？`);
    if (!ok) return;

    const remainingVisibleItems = visibleItems.filter((item) => item.id !== selectedItem.id);
    setItems((current) => current.filter((item) => item.id !== selectedItem.id));
    setSelectedId(remainingVisibleItems[0]?.id ?? "");
    try {
      if (user) await deleteRecurringExpenseTemplate(selectedItem.id);
      setMessage(`已刪除訂閱模板：${selectedItem.name}`);
    } catch (error) {
      console.error(error);
      setMessage("刪除雲端訂閱模板失敗，請稍後再試。");
    }
  }

  async function importThisMonth() {
    if (!selectedItem) return;
    if (!user) {
      setMessage("請先登入。");
      return;
    }
    if (!selectedItem.amount || selectedItem.amount <= 0) {
      setMessage("請輸入正確金額。");
      return;
    }
    const ok = window.confirm(`確定新增固定支出「${selectedItem.name}」${selectedItem.amount.toLocaleString("zh-TW")} 元嗎？`);
    if (!ok) return;
    const paymentMethod = toPaymentMethod(selectedItem);
    const category = toExpenseCategory(selectedItem);
    const target = toTarget(selectedItem.target, viewer);
    setIsSaving(true);
    setMessage("");
    try {
      const existingExpenses = await getExpenseRecordsByMonth(expenseDate.slice(0, 7));
      const duplicate = existingExpenses.find((record) =>
        record.note === selectedItem.name &&
        record.category === category &&
        record.target === target &&
        record.paidBy === viewer &&
        record.paymentMethod === paymentMethod &&
        (record.creditCard ?? "") === (paymentMethod === "credit_card" ? selectedItem.creditCard ?? "" : "")
      );
      if (duplicate) {
        const duplicateOk = window.confirm(`這個月已經新增過「${selectedItem.name}」。仍然要再新增一次嗎？`);
        if (!duplicateOk) return;
      }
      await addExpenseRecord({
        date: expenseDate,
        amount: selectedItem.amount,
        category,
        target,
        paidBy: viewer as OwnerKey,
        paymentMethod,
        creditCard: paymentMethod === "credit_card" ? selectedItem.creditCard : undefined,
        note: selectedItem.name,
        isPrivate: false,
        createdBy: user.uid,
      });
      setMessage(`已新增：${selectedItem.name}｜${category}｜${selectedItem.paymentMethod}${selectedItem.creditCard ? `・${selectedItem.creditCard}` : ""}｜$${selectedItem.amount.toLocaleString("zh-TW")}`);
    } catch (error) {
      console.error(error);
      setMessage("新增失敗，請確認 Firestore rules 或稍後再試。");
    } finally {
      setIsSaving(false);
    }
  }

  async function addSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(subscriptionAmount);
    if (!subscriptionName.trim() || !amount || amount <= 0) {
      setMessage("請輸入訂閱名稱與正確金額。");
      return;
    }
    if (!user) {
      setMessage("請先登入。");
      return;
    }
    const item: RecurringItem = {
      id: `subscription-${viewer}-${Date.now()}`,
      name: `訂閱：${subscriptionName.trim()}`,
      category: "訂閱",
      amount,
      target: "self",
      paymentMethod: "信用卡",
      creditCard: subscriptionCard,
      visibleFor: [viewer],
    };
    try {
      await saveTemplateToCloud(item, user.uid);
      setItems((current) => [...current, item]);
      setSelectedId(item.id);
      setSubscriptionName("");
      setSubscriptionAmount("");
      setSubscriptionCard(creditCards[0]);
      setShowSubscriptionForm(false);
      setMessage(`已新增訂閱模板：${item.name}`);
    } catch (error) {
      console.error(error);
      setMessage("新增雲端訂閱模板失敗，請稍後再試。");
    }
  }

  return (
    <section className="card grid">
      <h2>固定支出</h2>
      <p className="muted" style={{ margin: 0 }}>選擇固定支出後按「新增支出」，會正式寫入本月帳本。</p>
      {isTemplateLoading ? <p className="muted" style={{ margin: 0 }}>正在同步固定支出模板...</p> : null}

      <label className="field">
        <span>支出日期</span>
        <input className="input" type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} />
      </label>

      <label className="field">
        <span>選擇固定支出</span>
        <select className="select" value={selectedItem?.id ?? ""} onChange={(event) => setSelectedId(event.target.value)}>
          {visibleItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>

      {selectedItem ? (
        <article className="card grid" style={{ boxShadow: "none" }}>
          <div className="row">
            <div>
              <strong>{selectedItem.name}</strong>
              <div className="muted">{selectedItem.category}・{labelForOwner(selectedItem.target, viewer)}・{selectedItem.paymentMethod}{selectedItem.creditCard ? `・${selectedItem.creditCard}` : ""}</div>
            </div>
            <strong>${selectedItem.amount.toLocaleString("zh-TW")}</strong>
          </div>
          <label className="field">
            <span>金額</span>
            <input className="input" type="number" inputMode="decimal" pattern="[0-9]*" step="1" value={amountDraft} onChange={(event) => updateSelectedAmount(event.target.value)} />
          </label>
          {selectedItem.paymentMethod === "信用卡" && selectedItem.creditCard !== "保費卡" ? (
            <label className="field">
              <span>信用卡</span>
              <select className="select" value={selectedItem.creditCard ?? creditCards[0]} onChange={(event) => updateSelectedCreditCard(event.target.value as CreditCardName)}>
                {creditCards.map((card) => <option key={card}>{card}</option>)}
              </select>
            </label>
          ) : null}
          {isSubscriptionItem(selectedItem) ? <button className="btn secondary" type="button" onClick={deleteSelectedSubscription}>刪除這個訂閱</button> : null}
          <button className="btn secondary" type="button" onClick={importThisMonth} disabled={isSaving}>{isSaving ? "新增中..." : "新增支出"}</button>
        </article>
      ) : null}

      <button className="btn" type="button" onClick={() => setShowSubscriptionForm((value) => !value)}>
        {showSubscriptionForm ? "收起新增訂閱" : "新增個人訂閱"}
      </button>

      {showSubscriptionForm ? (
        <form className="card grid" style={{ boxShadow: "none" }} onSubmit={addSubscription}>
          <h3 style={{ margin: 0 }}>新增個人訂閱</h3>
          <label className="field"><span>訂閱名稱</span><input className="input" value={subscriptionName} onChange={(event) => setSubscriptionName(event.target.value)} placeholder="例如 GPT、動畫瘋" /></label>
          <label className="field"><span>金額</span><input className="input" type="number" inputMode="decimal" pattern="[0-9]*" step="1" value={subscriptionAmount} onChange={(event) => setSubscriptionAmount(event.target.value)} placeholder="例如 660" /></label>
          <label className="field"><span>信用卡</span><select className="select" value={subscriptionCard} onChange={(event) => setSubscriptionCard(event.target.value as CreditCardName)}>{creditCards.map((card) => <option key={card}>{card}</option>)}</select></label>
          <button className="btn secondary" type="submit">儲存訂閱模板</button>
        </form>
      ) : null}

      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
