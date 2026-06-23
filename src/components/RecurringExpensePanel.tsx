"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Viewer = "chris" | "wife";
type Owner = "self" | "spouse" | "junyao" | "cat";

type RecurringItem = {
  id: string;
  name: string;
  category: string;
  amount: number;
  target: Owner;
  paymentMethod: string;
  visibleFor: Viewer[];
};

function labelForOwner(owner: Owner, viewer: Viewer) {
  if (owner === "self") return "我";
  if (owner === "spouse") return viewer === "chris" ? "太太" : "先生";
  if (owner === "junyao") return "竣堯";
  return "貓";
}

const DEFAULT_ITEMS: RecurringItem[] = [
  {
    id: "mortgage",
    name: "房貸",
    category: "房貸",
    amount: 25000,
    target: "self",
    paymentMethod: "銀行扣款",
    visibleFor: ["chris"],
  },
  {
    id: "mobile-chris",
    name: "手機門號費：我",
    category: "電話費",
    amount: 699,
    target: "self",
    paymentMethod: "信用卡",
    visibleFor: ["chris"],
  },
  {
    id: "mobile-wife",
    name: "手機門號費：我",
    category: "電話費",
    amount: 699,
    target: "self",
    paymentMethod: "信用卡",
    visibleFor: ["wife"],
  },
  {
    id: "insurance-self-chris",
    name: "保險：我",
    category: "保險",
    amount: 4200,
    target: "self",
    paymentMethod: "信用卡或轉帳",
    visibleFor: ["chris"],
  },
  {
    id: "insurance-self-wife",
    name: "保險：我",
    category: "保險",
    amount: 3600,
    target: "self",
    paymentMethod: "信用卡或轉帳",
    visibleFor: ["wife"],
  },
  {
    id: "insurance-junyao",
    name: "保險：竣堯",
    category: "保險",
    amount: 1500,
    target: "junyao",
    paymentMethod: "信用卡或轉帳",
    visibleFor: ["chris"],
  },
  {
    id: "school-fee",
    name: "竣堯學費",
    category: "學費",
    amount: 12000,
    target: "junyao",
    paymentMethod: "轉帳",
    visibleFor: ["chris", "wife"],
  },
  {
    id: "after-school-care",
    name: "竣堯延托費",
    category: "學費",
    amount: 2500,
    target: "junyao",
    paymentMethod: "轉帳",
    visibleFor: ["wife"],
  },
  {
    id: "management-fee",
    name: "管理費",
    category: "管理費",
    amount: 2500,
    target: "self",
    paymentMethod: "轉帳",
    visibleFor: ["chris"],
  },
  {
    id: "internet",
    name: "網路費",
    category: "網路費",
    amount: 999,
    target: "self",
    paymentMethod: "信用卡",
    visibleFor: ["chris"],
  },
];

const STORAGE_KEY = "household-expense-demo-recurring-items";

function mergeDefaultItems(storedItems: RecurringItem[]) {
  const existingIds = new Set(storedItems.map((item) => item.id));
  const missingDefaults = DEFAULT_ITEMS.filter((item) => !existingIds.has(item.id));
  return [...storedItems, ...missingDefaults];
}

function loadStoredItems() {
  if (typeof window === "undefined") return DEFAULT_ITEMS;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_ITEMS;
  try {
    return mergeDefaultItems(JSON.parse(raw) as RecurringItem[]);
  } catch {
    return DEFAULT_ITEMS;
  }
}

export function RecurringExpensePanel({ viewer }: { viewer: Viewer }) {
  const [items, setItems] = useState<RecurringItem[]>(loadStoredItems);
  const visibleItems = useMemo(() => items.filter((item) => item.visibleFor.includes(viewer)), [items, viewer]);
  const [selectedId, setSelectedId] = useState("");
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);
  const [subscriptionName, setSubscriptionName] = useState("");
  const [subscriptionAmount, setSubscriptionAmount] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const selectedItem = useMemo(() => {
    return visibleItems.find((item) => item.id === selectedId) ?? visibleItems[0];
  }, [selectedId, visibleItems]);

  useEffect(() => {
    if (selectedItem) setSelectedId(selectedItem.id);
  }, [viewer, selectedItem]);

  function updateSelectedAmount(amount: number) {
    if (!selectedItem) return;
    setItems((current) => current.map((item) => item.id === selectedItem.id ? { ...item, amount } : item));
  }

  function importThisMonth() {
    if (!selectedItem) return;
    setMessage(`已新增展示支出：${selectedItem.name} $${selectedItem.amount.toLocaleString("zh-TW")}。下次點這個項目會記住這次金額。`);
  }

  function addSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(subscriptionAmount);
    if (!subscriptionName.trim() || !amount || amount <= 0) {
      setMessage("請輸入訂閱名稱與正確金額。");
      return;
    }

    const item: RecurringItem = {
      id: `subscription-${viewer}-${Date.now()}`,
      name: `訂閱：${subscriptionName.trim()}`,
      category: "訂閱",
      amount,
      target: "self",
      paymentMethod: "信用卡",
      visibleFor: [viewer],
    };

    setItems((current) => [...current, item]);
    setSelectedId(item.id);
    setSubscriptionName("");
    setSubscriptionAmount("");
    setShowSubscriptionForm(false);
    setMessage(`已新增展示訂閱：${item.name}`);
  }

  return (
    <section className="card grid">
      <h2>固定支出模板</h2>
      <label className="field">
        <span>選擇固定支出</span>
        <select className="select" value={selectedItem?.id ?? ""} onChange={(event) => setSelectedId(event.target.value)}>
          {visibleItems.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </label>

      {selectedItem ? (
        <article className="card grid" style={{ boxShadow: "none" }}>
          <div className="row">
            <div>
              <strong>{selectedItem.name}</strong>
              <div className="muted">{selectedItem.category}・{labelForOwner(selectedItem.target, viewer)}・{selectedItem.paymentMethod}</div>
            </div>
            <strong>${selectedItem.amount.toLocaleString("zh-TW")}</strong>
          </div>
          <label className="field">
            <span>金額</span>
            <input className="input" type="number" value={selectedItem.amount} onChange={(event) => updateSelectedAmount(Number(event.target.value))} />
          </label>
          <button className="btn secondary" type="button" onClick={importThisMonth}>新增支出</button>
        </article>
      ) : null}

      <button className="btn" type="button" onClick={() => setShowSubscriptionForm((value) => !value)}>
        {showSubscriptionForm ? "收起新增訂閱" : "新增個人訂閱"}
      </button>

      {showSubscriptionForm ? (
        <form className="card grid" style={{ boxShadow: "none" }} onSubmit={addSubscription}>
          <h3 style={{ margin: 0 }}>新增個人訂閱</h3>
          <label className="field">
            <span>訂閱名稱</span>
            <input className="input" value={subscriptionName} onChange={(event) => setSubscriptionName(event.target.value)} placeholder="例如 GPT、動畫瘋" />
          </label>
          <label className="field">
            <span>金額</span>
            <input className="input" type="number" value={subscriptionAmount} onChange={(event) => setSubscriptionAmount(event.target.value)} placeholder="例如 660" />
          </label>
          <button className="btn secondary" type="submit">儲存訂閱模板</button>
        </form>
      ) : null}

      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
