"use client";

import { FormEvent, useMemo, useState } from "react";

type Owner = "我" | "太太" | "竣堯" | "貓";

type RecurringItem = {
  id: string;
  name: string;
  category: string;
  amount: number;
  target: Owner;
  paymentMethod: string;
  note: string;
  privateToOwner?: boolean;
};

const DEFAULT_ITEMS: RecurringItem[] = [
  {
    id: "mortgage",
    name: "房貸",
    category: "房貸",
    amount: 25000,
    target: "我",
    paymentMethod: "銀行扣款",
    note: "每月固定帶入，可依利率調整",
  },
  {
    id: "insurance-chris",
    name: "保險：我",
    category: "保險",
    amount: 4200,
    target: "我",
    paymentMethod: "信用卡或轉帳",
    note: "個人手機只會看到自己的保險模板",
    privateToOwner: true,
  },
  {
    id: "insurance-wife",
    name: "保險：太太",
    category: "保險",
    amount: 3600,
    target: "太太",
    paymentMethod: "信用卡或轉帳",
    note: "之後登入後只會在太太手機顯示",
    privateToOwner: true,
  },
  {
    id: "insurance-junyao",
    name: "保險：竣堯",
    category: "保險",
    amount: 1500,
    target: "竣堯",
    paymentMethod: "信用卡或轉帳",
    note: "孩子保險會統計到竣堯支出",
  },
  {
    id: "school-fee",
    name: "竣堯學費",
    category: "學費",
    amount: 12000,
    target: "竣堯",
    paymentMethod: "轉帳",
    note: "孩子支出會顯示細項與由誰支付",
  },
  {
    id: "supplement-junyao",
    name: "竣堯保健食品",
    category: "保健食品",
    amount: 1800,
    target: "竣堯",
    paymentMethod: "信用卡",
    note: "孩子細項會在首頁竣堯區塊統計",
  },
  {
    id: "management-fee",
    name: "管理費",
    category: "管理費",
    amount: 2500,
    target: "我",
    paymentMethod: "轉帳",
    note: "社區管理費",
  },
  {
    id: "internet",
    name: "網路費",
    category: "網路費",
    amount: 999,
    target: "我",
    paymentMethod: "信用卡",
    note: "每月固定扣款",
  },
];

export function RecurringExpensePanel() {
  const [items, setItems] = useState(DEFAULT_ITEMS);
  const [selectedId, setSelectedId] = useState(DEFAULT_ITEMS[0].id);
  const [subscriptionName, setSubscriptionName] = useState("");
  const [subscriptionAmount, setSubscriptionAmount] = useState("");
  const [subscriptionOwner, setSubscriptionOwner] = useState<Owner>("我");
  const [message, setMessage] = useState("");

  const selectedItem = useMemo(() => {
    return items.find((item) => item.id === selectedId) ?? items[0];
  }, [items, selectedId]);

  function updateSelectedAmount(amount: number) {
    setItems((current) => current.map((item) => item.id === selectedId ? { ...item, amount } : item));
  }

  function importThisMonth() {
    setMessage(`已帶入展示紀錄：${selectedItem.name} $${selectedItem.amount.toLocaleString("zh-TW")}，歸屬：${selectedItem.target}`);
  }

  function addSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(subscriptionAmount);
    if (!subscriptionName.trim() || !amount || amount <= 0) {
      setMessage("請輸入訂閱名稱與正確金額。");
      return;
    }

    const item: RecurringItem = {
      id: `subscription-${Date.now()}`,
      name: `訂閱：${subscriptionName.trim()}`,
      category: "訂閱",
      amount,
      target: subscriptionOwner,
      paymentMethod: "信用卡",
      note: "個人訂閱模板，之後會依登入者各自保存，不共用",
      privateToOwner: true,
    };

    setItems((current) => [...current, item]);
    setSelectedId(item.id);
    setSubscriptionName("");
    setSubscriptionAmount("");
    setMessage(`已新增展示訂閱：${item.name}`);
  }

  return (
    <section className="card grid">
      <h2>固定支出模板</h2>
      <p className="muted">先用下拉選單選固定支出，金額會自動帶入。登入後會改成各自手機只顯示自己的模板。</p>

      <label className="field">
        <span>選擇固定支出</span>
        <select className="select" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </label>

      <article className="card grid" style={{ boxShadow: "none" }}>
        <div className="row">
          <div>
            <strong>{selectedItem.name}</strong>
            <div className="muted">{selectedItem.category}・{selectedItem.target}・{selectedItem.paymentMethod}</div>
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
        <label className="field">
          <span>歸屬</span>
          <select className="select" value={subscriptionOwner} onChange={(event) => setSubscriptionOwner(event.target.value as Owner)}>
            <option>我</option>
            <option>太太</option>
          </select>
        </label>
        <button className="btn" type="submit">新增訂閱模板</button>
      </form>

      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
