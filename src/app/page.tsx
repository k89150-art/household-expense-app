"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { AdvanceForm } from "@/components/AdvanceForm";
import { AuthGate, useCurrentUser } from "@/components/AuthGate";
import { ExpenseQuickForm } from "@/components/ExpenseQuickForm";
import { FirestoreHomeSummary } from "@/components/FirestoreHomeSummary";
import { HouseholdReport } from "@/components/HouseholdReport";
import { IncomeForm } from "@/components/IncomeForm";
import { PrepaidSettlementForm } from "@/components/PrepaidSettlementForm";
import { RecurringExpensePanel } from "@/components/RecurringExpensePanel";
import { firebaseAppEnv } from "@/lib/firebase";
import type { Viewer } from "@/lib/household";
import { resolveMemberRole } from "@/lib/memberRoles";

type Tab = "home" | "records" | "add" | "report" | "fixed";
type AddMode = "expense" | "income" | "advance";
type NavTab = Exclude<Tab, "add">;

const TAB_TITLES: Record<Tab, string> = {
  home: "首頁",
  records: "紀錄",
  add: "新增",
  report: "報表",
  fixed: "固定支出",
};

const NAV_ICONS: Record<NavTab, ReactNode> = {
  home: <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  records: <><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></>,
  report: <><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>,
  fixed: <><path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></>,
};

function NavIcon({ tab }: { tab: NavTab }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {NAV_ICONS[tab]}
    </svg>
  );
}

/**
 * 登入後、任何 Firestore 讀寫之前的角色關卡：雙帳號 UID 白名單（NEXT_PUBLIC_MEMBER_ROLES）。
 * 所有會讀寫 Firestore 的元件都在 HouseholdApp 之內；不在白名單時完全不掛載 HouseholdApp。
 * 資料存取另由 Firestore Rules 的 memberIds 在伺服器端強制。
 */
function MemberRoleGate() {
  const user = useCurrentUser();
  const resolution = resolveMemberRole({
    appEnv: firebaseAppEnv,
    uid: user?.uid,
    memberRoleMap: process.env.NEXT_PUBLIC_MEMBER_ROLES,
  });

  if (!resolution.ok) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <h1>一起記</h1>
          <p className="muted">{resolution.message}</p>
          <p className="muted">錯誤代碼：{resolution.code}</p>
          {user?.uid ? <p className="muted">目前登入帳號的 UID（設定白名單用）：{user.uid}</p> : null}
        </section>
      </main>
    );
  }

  return <HouseholdApp viewer={resolution.viewer} />;
}

function HouseholdApp({ viewer }: { viewer: Viewer }) {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [addMode, setAddMode] = useState<AddMode>("expense");
  const [refreshKey, setRefreshKey] = useState(0);

  function openTab(tab: Tab) {
    setActiveTab(tab);
    window.scrollTo({ top: 0 });
  }

  function refreshRecords() {
    setRefreshKey((value) => value + 1);
    openTab("home");
  }

  function navButton(tab: NavTab) {
    return (
      <button type="button" aria-current={activeTab === tab ? "page" : undefined} onClick={() => openTab(tab)}>
        <NavIcon tab={tab} />
        {tab === "fixed" ? "固定" : TAB_TITLES[tab]}
      </button>
    );
  }

  return (
    <main className="container">
      <header className="app-header">
        <h1>{TAB_TITLES[activeTab]}</h1>
      </header>

      {activeTab === "home" ? <FirestoreHomeSummary viewer={viewer} refreshKey={refreshKey} view="home" /> : null}
      {activeTab === "records" ? <FirestoreHomeSummary viewer={viewer} refreshKey={refreshKey} view="records" /> : null}

      {activeTab === "add" ? (
        <section className="grid page-section">
          <div className="panel">
            <div className="choice-grid" role="group" aria-label="紀錄類型">
              <button className={addMode === "expense" ? "choice active" : "choice"} type="button" aria-pressed={addMode === "expense"} onClick={() => setAddMode("expense")}>支出</button>
              <button className={addMode === "income" ? "choice active" : "choice"} type="button" aria-pressed={addMode === "income"} onClick={() => setAddMode("income")}>收入</button>
              <button className={addMode === "advance" ? "choice active" : "choice"} type="button" aria-pressed={addMode === "advance"} onClick={() => setAddMode("advance")}>代墊</button>
            </div>
          </div>
          {addMode === "expense" ? <ExpenseQuickForm viewer={viewer} onSaved={refreshRecords} /> : null}
          {addMode === "income" ? <IncomeForm viewer={viewer} onSaved={refreshRecords} /> : null}
          {addMode === "advance" ? <AdvanceForm viewer={viewer} onSaved={refreshRecords} /> : null}
        </section>
      ) : null}

      {activeTab === "fixed" ? (
        <section className="grid page-section">
          <RecurringExpensePanel viewer={viewer} />
          {viewer === "chris" ? <PrepaidSettlementForm /> : null}
        </section>
      ) : null}

      {activeTab === "report" ? <HouseholdReport /> : null}

      <nav className="bottom-nav" aria-label="主要導覽">
        {navButton("home")}
        {navButton("records")}
        <button className="nav-add" type="button" aria-label="新增" aria-current={activeTab === "add" ? "page" : undefined} onClick={() => { setAddMode("expense"); openTab("add"); }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
        </button>
        {navButton("report")}
        {navButton("fixed")}
      </nav>
    </main>
  );
}

export default function HomePage() {
  return (
    <AuthGate>
      <MemberRoleGate />
    </AuthGate>
  );
}
