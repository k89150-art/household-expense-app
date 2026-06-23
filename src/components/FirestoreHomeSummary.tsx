"use client";

import { useEffect, useMemo, useState } from "react";
import { deleteExpenseRecord, getExpenseRecordsByMonth, ExpenseRecord } from "@/lib/records";
import { Viewer } from "@/lib/household";

type Scope = "month" | "all";

type Props = {
  viewer: Viewer;
  refreshKey?: number;
};

const TARGET_LABELS: Record<string, string> = {
  chris: "我",
  wife: "我",
  junyao: "竣堯",
  cat: "貓",
};

function money(value = 0) {
  return `$${value.toLocaleString("zh-TW")}`;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function shiftMonth(yyyymm: string, diff: number) {
  const [year, month] = yyyymm.split("-").map(Number);
  const date = new Date(year, month - 1 + diff, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(yyyymm: string) {
  const [year, month] = yyyymm.split("-");
  return `${year} 年 ${Number(month)} 月`;
}

function displayTarget(record: ExpenseRecord, viewer: Viewer) {
  if (record.target === "chris") return viewer === "chris" ? "我" : "先生";
  if (record.target === "wife") return viewer === "wife" ? "我" : "太太";
  return TARGET_LABELS[record.target] ?? record.target;
}

function displayPaidBy(record: ExpenseRecord, viewer: Viewer) {
  if (record.paidBy === "chris") return viewer === "chris" ? "我" : "先生";
  return viewer === "wife" ? "我" : "太太";
}

function groupByTarget(records: ExpenseRecord[]) {
  return records.reduce<Record<string, ExpenseRecord[]>>((groups, record) => {
    groups[record.target] = [...(groups[record.target] ?? []), record];
    return groups;
  }, {});
}

function groupByCategory(records: ExpenseRecord[]) {
  return records.reduce<Record<string, ExpenseRecord[]>>((groups, record) => {
    groups[record.category] = [...(groups[record.category] ?? []), record];
    return groups;
  }, {});
}

function groupByCreditCard(records: ExpenseRecord[]) {
  return records.filter((record) => record.paymentMethod === "credit_card" && record.creditCard).reduce<Record<string, ExpenseRecord[]>>((groups, record) => {
    const card = record.creditCard ?? "未指定";
    groups[card] = [...(groups[card] ?? []), record];
    return groups;
  }, {});
}

export function FirestoreHomeSummary({ viewer, refreshKey = 0 }: Props) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [scope, setScope] = useState<Scope>("month");
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [openedTarget, setOpenedTarget] = useState<string | null>(null);
  const [openedCategory, setOpenedCategory] = useState<string | null>(null);
  const [showCreditCards, setShowCreditCards] = useState(false);
  const [message, setMessage] = useState("");

  async function loadRecords() {
    setIsLoading(true);
    setMessage("");
    try {
      const targetMonth = scope === "month" ? selectedMonth : currentMonth();
      const data = await getExpenseRecordsByMonth(targetMonth);
      setRecords(data);
    } catch (error) {
      console.error(error);
      setMessage("讀取資料失敗。請確認 Firestore Database 已建立，且安全規則已允許登入使用者讀取。");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, scope, refreshKey]);

  async function handleDelete(id: string) {
    const ok = window.confirm("確定要刪除這筆支出嗎？");
    if (!ok) return;
    await deleteExpenseRecord(id);
    await loadRecords();
  }

  const totalExpense = records.reduce((sum, record) => sum + record.amount, 0);
  const groupedTargets = useMemo(() => groupByTarget(records), [records]);
  const creditCardGroups = useMemo(() => groupByCreditCard(records), [records]);
  const creditCardTotal = Object.values(creditCardGroups).flat().reduce((sum, record) => sum + record.amount, 0);

  return (
    <section className="grid">
      <article className="card grid">
        <div className="row">
          <button className="btn secondary" type="button" onClick={() => setSelectedMonth((value) => shiftMonth(value, -1))}>上個月</button>
          <strong>{monthLabel(selectedMonth)}</strong>
          <button className="btn secondary" type="button" onClick={() => setSelectedMonth((value) => shiftMonth(value, 1))}>下個月</button>
        </div>
        <div className="row">
          <button className={scope === "month" ? "btn" : "btn secondary"} type="button" onClick={() => setScope("month")}>當月</button>
          <button className={scope === "all" ? "btn" : "btn secondary"} type="button" onClick={() => setScope("all")}>全部月份</button>
        </div>
      </article>

      <article className="card grid">
        <h2>{scope === "month" ? "當月總結" : "目前月份總結"}</h2>
        <div className="row"><span>總支出</span><strong>{money(totalExpense)}</strong></div>
        <p className="muted" style={{ margin: 0 }}>目前正式版先接上支出資料；收入與投資會在下一階段接資料庫。</p>
        {isLoading ? <p className="muted">讀取中...</p> : null}
        {message ? <p className="muted">{message}</p> : null}
      </article>

      {records.length === 0 && !isLoading ? (
        <article className="card grid">
          <h2>尚無支出</h2>
          <p className="muted" style={{ margin: 0 }}>到「新增」頁儲存第一筆支出後，這裡就會出現正式資料。</p>
        </article>
      ) : null}

      {Object.entries(groupedTargets).map(([target, targetRecords]) => {
        const targetKey = target;
        const isOpen = openedTarget === targetKey;
        const targetTotal = targetRecords.reduce((sum, record) => sum + record.amount, 0);
        const groupedCategories = groupByCategory(targetRecords);
        const sample = targetRecords[0];
        return (
          <article className="card grid" key={targetKey}>
            <button
              className="row"
              type="button"
              onClick={() => {
                setOpenedTarget(isOpen ? null : targetKey);
                setOpenedCategory(null);
              }}
              style={{ border: 0, background: "transparent", padding: 0, textAlign: "left" }}
            >
              <div>
                <h2 style={{ margin: 0 }}>{sample ? displayTarget(sample, viewer) : target}</h2>
                <div className="muted">點一下看分類</div>
              </div>
              <strong>{money(targetTotal)}</strong>
            </button>

            {isOpen ? (
              <div className="grid">
                {Object.entries(groupedCategories).map(([category, categoryRecords]) => {
                  const categoryKey = `${targetKey}-${category}`;
                  const isCategoryOpen = openedCategory === categoryKey;
                  const categoryTotal = categoryRecords.reduce((sum, record) => sum + record.amount, 0);
                  return (
                    <div className="card grid" style={{ boxShadow: "none" }} key={categoryKey}>
                      <button
                        className="row"
                        type="button"
                        onClick={() => setOpenedCategory(isCategoryOpen ? null : categoryKey)}
                        style={{ border: 0, background: "transparent", padding: 0, textAlign: "left" }}
                      >
                        <strong>{category}</strong>
                        <span className="muted">{money(categoryTotal)}・{isCategoryOpen ? "收合" : "明細"}</span>
                      </button>
                      {isCategoryOpen ? (
                        <div className="grid">
                          {categoryRecords.map((record) => (
                            <div className="row" key={record.id}>
                              <span>{record.date.slice(5)}　{record.isPrivate ? "個人雜支" : record.note || record.category}</span>
                              <span className="muted">
                                {money(record.amount)}{record.creditCard ? `・${record.creditCard}` : ""}{record.target === "junyao" ? `・${displayPaidBy(record, viewer)}付` : ""}
                                <button className="btn secondary" type="button" onClick={() => handleDelete(record.id)} style={{ marginLeft: 8 }}>刪除</button>
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </article>
        );
      })}

      <article className="card grid">
        <button
          className="row"
          type="button"
          onClick={() => setShowCreditCards((value) => !value)}
          style={{ border: 0, background: "transparent", padding: 0, textAlign: "left" }}
        >
          <div>
            <h2 style={{ margin: 0 }}>信用卡核對</h2>
            <div className="muted">點一下看各卡消費</div>
          </div>
          <strong>{money(creditCardTotal)}</strong>
        </button>
        {showCreditCards ? (
          <div className="grid">
            {Object.entries(creditCardGroups).map(([card, cardRecords]) => {
              const cardTotal = cardRecords.reduce((sum, record) => sum + record.amount, 0);
              return (
                <div className="card grid" style={{ boxShadow: "none" }} key={card}>
                  <div className="row"><strong>{card}</strong><strong>{money(cardTotal)}</strong></div>
                  {cardRecords.map((record) => (
                    <div className="row" key={`${card}-${record.id}`}>
                      <span>{record.date.slice(5)}　{record.note || record.category}</span>
                      <span className="muted">{money(record.amount)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : null}
      </article>
    </section>
  );
}
