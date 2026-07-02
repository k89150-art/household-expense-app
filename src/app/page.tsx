"use client";

import { useMemo, useState } from "react";
import { AdvanceForm } from "@/components/AdvanceForm";
import { AuthGate, useCurrentUser } from "@/components/AuthGate";
import { ExpenseQuickForm } from "@/components/ExpenseQuickForm";
import { FirestoreHomeSummary } from "@/components/FirestoreHomeSummary";
import { HouseholdReport } from "@/components/HouseholdReport";
import { IncomeForm } from "@/components/IncomeForm";
import { InvestmentForm } from "@/components/InvestmentForm";
import { PrepaidSettlementForm } from "@/components/PrepaidSettlementForm";
import { RecurringExpensePanel } from "@/components/RecurringExpensePanel";

type Tab = "home" | "add" | "fixed" | "report";
type AddMode = "expense" | "income" | "investment" | "advance";
type Viewer = "chris" | "wife";

const DAILY_QUOTES = [
  "今天先記一筆，未來的自己會感謝你。",
  "錢不是要管你，是要幫你選生活。",
  "把小事記清楚，大方向就會更安定。",
  "今天的支出，也是家的生活痕跡。",
  "有感覺地花錢，比一直忍耐更可持續。",
  "記帳不是約束，是把自由放到看得見的地方。",
  "好好生活的計畫，從一筆小小的紀錄開始。",
];

function HouseholdApp() {
  const user = useCurrentUser();
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [addMode, setAddMode] = useState<AddMode>("expense");
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const viewer: Viewer = user?.email === "k89150@gmail.com" ? "chris" : "wife";

  const monthText = useMemo(() => new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit" }).format(new Date()).replace("/", " / "), []);
  const quote = useMemo(() => DAILY_QUOTES[new Date().getDate() % DAILY_QUOTES.length], []);

  function refreshRecords() {
    setRefreshKey((value) => value + 1);
    setActiveTab("home");
  }

  function openAdd(mode: AddMode) {
    setAddMode(mode);
    setActiveTab("add");
    setIsQuickMenuOpen(false);
  }

  function openFixed() {
    setActiveTab("fixed");
    setIsQuickMenuOpen(false);
  }

  function openTab(tab: Tab) {
    setActiveTab(tab);
    setIsQuickMenuOpen(false);
  }

  return (
    <main className="container">
      <section className="cover">
        <div className="cover-top">
          <p className="brand-kicker">HOUSEHOLD LEDGER</p>
          <div className="profile">{viewer === "chris" ? "阿" : "太"}</div>
        </div>
        <div className="cover-title">
          <h1>一起記</h1>
          <p>{quote}</p>
        </div>
        <div className="balance-line">
          <div>
            <span>{activeTab === "home" ? "本月家庭帳本" : activeTab === "add" ? "新增一筆紀錄" : activeTab === "fixed" ? "固定支出管理" : "月份報表"}</span>
            <strong>{activeTab === "home" ? "首頁" : activeTab === "add" ? "新增" : activeTab === "fixed" ? "固定" : "報表"}</strong>
          </div>
          <div className="month-pill">{monthText}</div>
        </div>
      </section>

      <nav className="ledger-tabs" aria-label="view tabs">
        <button className={activeTab === "home" ? "active" : ""} type="button" onClick={() => openTab("home")}>首頁</button>
        <button className={activeTab === "add" ? "active" : ""} type="button" onClick={() => openAdd(addMode)}>新增</button>
        <button className={activeTab === "report" ? "active" : ""} type="button" onClick={() => openTab("report")}>報表</button>
      </nav>

      {activeTab === "home" ? <FirestoreHomeSummary viewer={viewer} refreshKey={refreshKey} /> : null}

      {activeTab === "add" ? (
        <section className="grid page-section">
          <div className="panel">
            <div className="choice-grid">
              <button className={addMode === "expense" ? "choice active" : "choice"} type="button" onClick={() => setAddMode("expense")}>支出</button>
              <button className={addMode === "income" ? "choice active" : "choice"} type="button" onClick={() => setAddMode("income")}>收入</button>
              <button className={addMode === "investment" ? "choice active" : "choice"} type="button" onClick={() => setAddMode("investment")}>投資</button>
              <button className={addMode === "advance" ? "choice active" : "choice"} type="button" onClick={() => setAddMode("advance")}>代墊</button>
            </div>
          </div>
          {addMode === "expense" ? <ExpenseQuickForm viewer={viewer} onSaved={refreshRecords} /> : null}
          {addMode === "income" ? <IncomeForm viewer={viewer} onSaved={refreshRecords} /> : null}
          {addMode === "investment" ? <InvestmentForm viewer={viewer} onSaved={refreshRecords} /> : null}
          {addMode === "advance" ? <AdvanceForm viewer={viewer} onSaved={refreshRecords} /> : null}
          {addMode === "expense" ? (
            <aside className="desktop-fixed-panel">
              <RecurringExpensePanel viewer={viewer} />
            </aside>
          ) : null}
        </section>
      ) : null}

      {activeTab === "fixed" ? (
        <section className="grid page-section">
          <RecurringExpensePanel viewer={viewer} />
          {viewer === "chris" ? <PrepaidSettlementForm /> : null}
        </section>
      ) : null}

      {activeTab === "report" ? (
        <HouseholdReport />
      ) : null}

      <button className={isQuickMenuOpen ? "scrim open" : "scrim"} type="button" aria-label="關閉快速新增" onClick={() => setIsQuickMenuOpen(false)} />
      <div className={isQuickMenuOpen ? "quick-menu open" : "quick-menu"} aria-label="快速新增">
        <button type="button" onClick={() => openAdd("expense")}>支出</button>
        <button type="button" onClick={() => openAdd("income")}>收入</button>
        <button type="button" onClick={() => openAdd("investment")}>投資</button>
        <button type="button" onClick={openFixed}>固定</button>
      </div>

      <nav className={isQuickMenuOpen ? "compose menu-open" : "compose"}>
        <button data-nav="home" className={activeTab === "home" ? "active" : ""} type="button" onClick={() => openTab("home")}>首頁</button>
        <button className="fab" type="button" aria-label="快速新增" aria-expanded={isQuickMenuOpen} onClick={() => setIsQuickMenuOpen((value) => !value)}>+</button>
        <button data-nav="reports" className={activeTab === "report" ? "active" : ""} type="button" onClick={() => openTab("report")}>報表</button>
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
