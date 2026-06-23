"use client";

import { useMemo, useState } from "react";

type RecurringItem = {
  id: string;
  name: string;
  category: string;
  amount: number;
  target: string;
  payer: string;
  paymentMethod: string;
  note: string;
};

const DEFAULT_ITEMS: RecurringItem[] = [
  {
    id: "mortgage",
    name: "房貸",
    category: "房貸",
    amount: 25000,
    target: "我",
    payer: "我",
    paymentMethod: "銀行扣款",
    note: "每月固定帶入，可依利率調整",
  },
  {
    id: "insurance-chris-son",
    name: "保險：我與竣堯",
    category: "保險",
    amount: 6000,
    target: "我 / 竣堯",
    payer: "我",
    paymentMethod: "信用卡或轉帳",
    note: "一次繳清後分 12 期，每月帶入",
  },
  {
    id: "school-fee",
    name: "竣堯學費",
    category: "學費",
    amount: 12000,
    target: "竣堯",
    payer: "太太",
    paymentMethod: "轉帳",
    note: "可標記由誰支付",
  },
  {
    id: "supplement-junyao",
    name: "竣堯保健食品",
    category: "保健食品",
    amount: 1800,
    target: "竣堯",
    payer: "我",
    paymentMethod: "信用卡",
    note: "孩子細項會在首頁竣堯區塊統計",
  },
  {
    id: "management-fee",
    name: "管理費",
    category: "管理費",
    amount: 2500,
    target: "我",
    payer: "我",
    paymentMethod: "轉帳",
    note: "社區管理費",
  },
  {
    id: "internet",
    name: "網路費",
    category: "網路費",
    amount: 999,
    target: "我",
    payer: "我",
    paymentMethod: "信用卡",
    note: "每月固定扣款",
  },
  {
    id: "subscription",
    name: "訂閱服務",
    category: "訂閱",
    amount: 390,
    target: "我",
    payer: "我",
    paymentMethod: "信用卡",
    note: "Netflix、iCloud 或其他訂閱可新增在這裡",
  },
];

export function RecurringExpensePanel() {
  const [items, setItems] = useState(DEFAULT_ITEMS);
  const [selectedId, setSelectedId] = useState(DEFAULT_ITEMS[0].id);
  const [message, setMessage] = useState("");

  const selectedItem = useMemo(() => {
    return items.find((item) => item.id === selectedId) ?? items[0];
  }, [items, selectedId]);

  function updateSelectedAmount(amount: number) {
    setItems((current) => current.map((item) => item.id === selectedId ? { ...item, amount } : item));
  }

  function importThisMonth() {
    setMessage(`已帶入展示紀錄：${selectedItem.name} $${selectedItem.amount.toLocaleString("zh-TW")}，歸屬：${selectedItem.target}，付款：${selectedItem.payer}`);
  }

  return (
    <section className="card grid">
      <h2>固定支出模板</h2>
      <p className="muted">先用下拉選單選固定支出，金額會自動帶入。金額可直接修改，再按「新增支出」。</p>

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
        <div className="row"><span>付款者</span><span className="muted">{selectedItem.payer}</span></div>
        <p className="muted" style={{ margin: 0 }}>{selectedItem.note}</p>
        <button className="btn secondary" type="button" onClick={importThisMonth}>新增支出</button>
      </article>

      <button className="btn" type="button" onClick={() => setMessage("之後會開啟新增固定支出模板")}>新增 / 修改固定支出模板</button>
      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
