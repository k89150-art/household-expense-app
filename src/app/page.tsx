"use client";

import { useMemo, useState } from "react";
import { ExpenseQuickForm } from "@/components/ExpenseQuickForm";
import { HomeSummary } from "@/components/HomeSummary";
import { PrepaidSettlementForm } from "@/components/PrepaidSettlementForm";
import { RecurringExpensePanel } from "@/components/RecurringExpensePanel";

type Tab = "home" | "add" | "fixed" | "report";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>("home");

  const todayText = useMemo(() => {
    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "long",
    }).format(new Date());
  }, []);

  return (
    <main className="container grid">
      <header className="grid" style={{ paddingTop: 8 }}>
        <div className="muted">{todayText}</div>
        <h1 style={{ margin: 0 }}>夫妻家庭帳本</h1>
      </header>

      {activeTab === "home" ? (
        <>
          <HomeSummary />
          <section className="card grid">
            <h2>快速操作</h2>
            <button className="btn" type="button" onClick={() => setActiveTab("add")}>新增支出</button>
            <button className="btn secondary" type="button" onClick={() => setActiveTab("fixed")}>固定支出與午餐餘額</button>
          </section>
        </>
      ) : null}

      {activeTab === "add" ? <ExpenseQuickForm /> : null}
      {activeTab === "fixed" ? (
        <>
          <RecurringExpensePanel />
          <PrepaidSettlementForm />
        </>
      ) : null}
      {activeTab === "report" ? (
        <section className="card grid">
          <h2>月報表</h2>
          <p className="muted">這裡之後會顯示我、太太、竣堯、貓的分類統計，也會標記每筆由誰支付。</p>
          <HomeSummary />
        </section>
      ) : null}

      <nav className="nav">
        <button type="button" onClick={() => setActiveTab("home")}>首頁</button>
        <button type="button" onClick={() => setActiveTab("add")}>新增</button>
        <button type="button" onClick={() => setActiveTab("fixed")}>固定</button>
        <button type="button" onClick={() => setActiveTab("report")}>報表</button>
      </nav>
    </main>
  );
}
