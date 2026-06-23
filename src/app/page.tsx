"use client";

import { useMemo, useState } from "react";
import { DashboardCard } from "@/components/DashboardCard";
import { ExpenseQuickForm } from "@/components/ExpenseQuickForm";
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
          <DashboardCard title="本月家庭支出" amount={24300} hint="不含信用卡繳款與生活費轉帳" />
          <DashboardCard title="本月個人支出" amount={4150} hint="含 Chris 醫院午餐與個人餐飲" />
          <DashboardCard title="本月生活費轉帳" amount={30000} hint="Chris → 太太，已轉帳" />
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
          <p className="muted">這裡之後會顯示分類統計、信用卡統計、固定支出與生活費轉帳狀態。</p>
          <DashboardCard title="展示：餐飲" amount={6800} />
          <DashboardCard title="展示：醫療" amount={850} />
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
