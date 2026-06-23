"use client";

import { useMemo, useState } from "react";
import { ExpenseQuickForm } from "@/components/ExpenseQuickForm";
import { HomeSummary } from "@/components/HomeSummary";
import { PrepaidSettlementForm } from "@/components/PrepaidSettlementForm";
import { RecurringExpensePanel } from "@/components/RecurringExpensePanel";

type Tab = "home" | "add" | "fixed" | "report";
type Viewer = "chris" | "wife";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [viewer, setViewer] = useState<Viewer>("chris");

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
        <div className="card grid" style={{ boxShadow: "none" }}>
          <span className="muted">展示用：目前模擬哪支手機</span>
          <div className="row">
            <button className={viewer === "chris" ? "btn" : "btn secondary"} type="button" onClick={() => setViewer("chris")}>我的手機</button>
            <button className={viewer === "wife" ? "btn" : "btn secondary"} type="button" onClick={() => setViewer("wife")}>太太手機</button>
          </div>
        </div>
      </header>

      {activeTab === "home" ? (
        <>
          <HomeSummary viewer={viewer} />
          <section className="card grid">
            <h2>快速操作</h2>
            <button className="btn" type="button" onClick={() => setActiveTab("add")}>新增支出</button>
            <button className="btn secondary" type="button" onClick={() => setActiveTab("fixed")}>固定支出{viewer === "chris" ? "與午餐餘額" : ""}</button>
          </section>
        </>
      ) : null}

      {activeTab === "add" ? <ExpenseQuickForm viewer={viewer} /> : null}
      {activeTab === "fixed" ? (
        <>
          <RecurringExpensePanel viewer={viewer} />
          {viewer === "chris" ? <PrepaidSettlementForm /> : null}
        </>
      ) : null}
      {activeTab === "report" ? (
        <section className="card grid">
          <h2>月報表</h2>
          <p className="muted">正式版會依登入者顯示「我 / 配偶」，孩子與貓的支出則共同統計。</p>
          <HomeSummary viewer={viewer} />
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
