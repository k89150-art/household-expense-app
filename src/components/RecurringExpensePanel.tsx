"use client";

import { FormEvent, useMemo, useState } from "react";

type Viewer = "chris" | "wife";
type Owner = "self" | "spouse" | "junyao" | "cat";

type RecurringItem = {
  id: string;
  name: string;
  category: string;
  amount: number;
  target: Owner;
  paymentMethod: string;
  note: string;
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
    note: "每月固定帶入，可依利率調整",
    visibleFor: ["chris"],
  },
  {
    id: "insurance-self-chris",
    name: "保險：我",
    category: "保險",
    amount: 4200,
    target: "self",
    paymentMethod: "信用卡或轉帳",
    note: "個人手機只顯示自己的保險模板",
    visibleFor: ["chris"],
  },
  {
    id: "insurance-self-wife",
    name: "保險：我",
    category: "保險",
    amount: 3600,
    target: "self",
    paymentMethod: "信用卡或轉帳",
    note: "個人手機只顯示自己的保險模板",
    visibleFor: ["wife"],
  },
  {
    id: "insurance-junyao",
    name: "保險：竣堯",
    category: "保險",
    amount: 1500,
    target: "junyao",
    paymentMethod: "信用卡或轉帳",
    note: "孩子保險會統計到竣堯支出",
    visibleFor: ["chris", "wife"],
  },
  {
    id: "school-fee",
    name: "竣堯學費",
    category: "學費",
    amount: 12000,
    target: "junyao",
    paymentMethod: "轉帳",
    note: "孩子支出會顯示細項與由誰支付",
    visibleFor: ["chris", "wife"],
  },
  {
    id: "supplement-junyao",
    name: "竣堯保健食品",
    category: "保健食品",
    amount: 1800,
    target: "junyao",
    paymentMethod: "信用卡",
    note: "孩子細項會在首頁竣堯區塊統計",
    visibleFor: ["chris", "wife"],
  },
  {
    id: "management-fee",
    name: "管理費",
    category: "管理費",
    amount: 2500,
    target: "self",
    paymentMethod: "轉帳",
    note: "社區管理費",
    visibleFor: ["chris"],
  },
  {
    id: "internet",
    name: "網路費",
    category: "網路費",
    amount: 999,
    target: "self",
    paymentMethod: "信用卡",
    note: "每月固定扣款",
    visibleFor: ["chris"],
  },
];

export function RecurringExpensePanel({ viewer }: { viewer: Viewer }) {
  const [items, setItems] = useState(DEFAULT_ITEMS);
  const visibleItems = useMemo(() => items.filter((item) => item.visibleFor.includes(viewer)), [items, viewer]);
  const [selectedId, setSelectedId] = useState(visibleItems[0]?.id ?? "");
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);
  const [subscriptionName, setSubscriptionName] = useState("");
  const [subscriptionAmount, setSubscriptionAmount] = useState("");
  const [message, setMessage] = useState("");

  const selectedItem = useMemo(() => {
    return visibleItems.find((item) => item.id === selectedId) ?? visibleItems[0];
  }, [selectedId, visibleItems]);

  function updateSelectedAmount(amount: number) {
    if (!selectedItem) return;
    setItems((current) => current.map((item) => item.id === selectedItem.id ? { ...item, amount } : item));
  }

  function importThisMonth() {
    if (!selectedItem) return;
    setMessage(`已帶入展示紀錄：${selectedItem.name} $${selectedItem.amount.toLocaleString("zh-TW")}，歸屬：${labelForOwner(selectedItem.target, viewer)}`);
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
      note: "個人訂閱模板，之後會依登入者各自保存，不共用",
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
      <p className="muted">下拉選單只顯示目前這支手機自己的固定支出，以及共同的竣堯支出。</p>

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
          <p className="muted" style={{ margin: 0 }}>{selectedItem.note}</p>
          <button className="btn secondary" type="button" onClick={importThisMonth}>新增支出</button>
        </article>
      ) : null}

      <button className="btn" type="button" onClick={() => setShowSubscriptionForm((value) => !value)}>
        {showSubscriptionForm ? "收起新增訂閱" : "新增個人訂閱"}
      </button>

      {showSubscriptionForm ? (
        <form className="card grid" style={{ boxShadow: "none" }} onSubmit={addSubscription}>
          <h3 style={{ margin: 0 }}>新增個人訂閱</h3>
          <p className="muted" style={{ margin: 0 }}>不用選歸屬，這筆訂閱就是目前登入者自己的。</p>
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
