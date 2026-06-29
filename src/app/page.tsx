"use client";

import { useMemo, useState } from "react";
import { AdvanceForm } from "@/components/AdvanceForm";
import { AuthGate, useCurrentUser } from "@/components/AuthGate";
import { ExpenseQuickForm } from "@/components/ExpenseQuickForm";
import { FirestoreHomeSummary } from "@/components/FirestoreHomeSummary";
import { IncomeForm } from "@/components/IncomeForm";
import { InvestmentForm } from "@/components/InvestmentForm";
import { PrepaidSettlementForm } from "@/components/PrepaidSettlementForm";
import { RecurringExpensePanel } from "@/components/RecurringExpensePanel";

type Tab = "home" | "add" | "fixed" | "report";
type AddMode = "expense" | "income" | "investment" | "advance";
type Viewer = "chris" | "wife";

function HouseholdApp() {
  const user = useCurrentUser();
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [addMode, setAddMode] = useState<AddMode>("expense");
  const [refreshKey, setRefreshKey] = useState(0);
  const viewer: Viewer = user?.email === "k89150@gmail.com" ? "chris" : "wife";

  const todayText = useMemo(() => new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "long" }).format(new Date()), []);

  function refreshRecords() {
    setRefreshKey((value) => value + 1);
    setActiveTab("home");
  }

  return (
    <main className="container grid">
      <header className="grid" style={{ paddingTop: 8 }}>
        <div className="muted">{todayText}</div>
        <h1 style={{ margin: 0 }}>夫妻家庭帳本</h1>
        <p className="muted" style={{ margin: 0 }}>目前帳號：{viewer === "chris" ? "我的手機" : "太太手機"}</p>
      </header>

      {activeTab === "home" ? (
        <>
          <FirestoreHomeSummary viewer={viewer} refreshKey={refreshKey} />
          <section className="card grid">
            <h2>快速操作</h2>
            <button className="btn" type="button" onClick={() => { setActiveTab("add"); setAddMode("expense"); }}>新增支出</button>
            <button className="btn secondary" type="button" onClick={() => { setActiveTab("add"); setAddMode("income"); }}>新增收入</button>
            <button className="btn secondary" type="button" onClick={() => { setActiveTab("add"); setAddMode("investment"); }}>新增投資紀錄</button>
            <button className="btn secondary" type="button" onClick={() => { setActiveTab("add"); setAddMode("advance"); }}>新增代墊款</button>
            <button className="btn secondary" type="button" onClick={() => setActiveTab("fixed")}>固定支出{viewer === "chris" ? "與午餐餘額" : ""}</button>
          </section>
        </>
      ) : null}

      {activeTab === "add" ? (
        <section className="grid">
          <div className="card grid" style={{ boxShadow: "none" }}>
            <div className="row">
              <button className={addMode === "expense" ? "btn" : "btn secondary"} type="button" onClick={() => setAddMode("expense")}>支出</button>
              <button className={addMode === "income" ? "btn" : "btn secondary"} type="button" onClick={() => setAddMode("income")}>收入</button>
              <button className={addMode === "investment" ? "btn" : "btn secondary"} type="button" onClick={() => setAddMode("investment")}>投資</button>
              <button className={addMode === "advance" ? "btn" : "btn secondary"} type="button" onClick={() => setAddMode("advance")}>代墊</button>
            </div>
          </div>
          {addMode === "expense" ? <ExpenseQuickForm viewer={viewer} onSaved={refreshRecords} /> : null}
          {addMode === "income" ? <IncomeForm viewer={viewer} onSaved={refreshRecords} /> : null}
          {addMode === "investment" ? <InvestmentForm viewer={viewer} onSaved={refreshRecords} /> : null}
          {addMode === "advance" ? <AdvanceForm viewer={viewer} onSaved={refreshRecords} /> : null}
        </section>
      ) : null}

      {activeTab === "fixed" ? (
        <>
          <RecurringExpensePanel viewer={viewer} />
          {viewer === "chris" ? <PrepaidSettlementForm /> : null}
        </>
      ) : null}

      {activeTab === "report" ? (
        <section className="card grid">
          <h2>月報表</h2>
          <p className="muted">報表會依登入者顯示內容。</p>
          <FirestoreHomeSummary viewer={viewer} refreshKey={refreshKey} />
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

export default function HomePage() {
  return (
    <AuthGate>
      <HouseholdApp />
    </AuthGate>
  );
}
