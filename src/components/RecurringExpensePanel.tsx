"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/components/AuthGate";
import { currentMonthString, previousMonthDayForMonth } from "@/lib/date";
import { addExpenseRecord, deleteRecurringExpenseTemplate, getExpenseRecordsByMonth, getRecurringExpenseTemplates, upsertRecurringExpenseTemplate } from "@/lib/records";
import type { CreditCardName, OwnerKey, RecurringExpenseTemplateRecord } from "@/lib/records";
import type { ExpenseCategory, PaymentMethod, PersonTarget } from "@/types/domain";
import type { LoanKey } from "@/types/loanRepayment";

type Viewer = "chris" | "wife";
type Owner = "self" | "spouse" | "junyao" | "cat";

type RecurringItem = Omit<RecurringExpenseTemplateRecord, "householdId" | "createdBy" | "createdAt" | "updatedAt">;

function today() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNormalCreditCards(viewer: Viewer): CreditCardName[] {
  return viewer === "chris" ? ["玉山", "國泰", "中信"] : ["台新", "國泰", "中信"];
}

function labelForOwner(owner: Owner, viewer: Viewer) {
  if (owner === "self") return "我";
  if (owner === "spouse") return viewer === "chris" ? "太太" : "先生";
  if (owner === "junyao") return "竣堯";
  return "貓";
}

function toTarget(owner: Owner, viewer: Viewer): PersonTarget {
  if (owner === "self") return viewer;
  if (owner === "spouse") return viewer === "chris" ? "wife" : "chris";
  if (owner === "junyao") return "junyao";
  return "cat";
}

function toPaymentMethod(item: RecurringItem): PaymentMethod {
  if (item.paymentMethod === "信用卡") return "credit_card";
  if (item.paymentMethod === "現金") return "cash";
  if (item.paymentMethod === "轉帳" || item.paymentMethod === "銀行扣款") return "bank_transfer";
  return "other";
}

function toExpenseCategory(item: RecurringItem): ExpenseCategory {
  if (item.name.includes("手機") || item.category.includes("電話")) return "手機門號費";
  if (item.name.includes("網路") || item.category.includes("網路")) return "網路費";
  if (item.name.includes("保險") || item.category.includes("保險")) return "保險";
  if (item.name.includes("學費") || item.name.includes("延托") || item.name.includes("才藝") || item.category.includes("學費")) return "學費";
  if (item.name.includes("管理費") || item.category.includes("管理費") || item.name.includes("房貸")) return "居家固定費";
  return "其他";
}

function isSubscriptionItem(item: RecurringItem) {
  return item.category === "訂閱" || item.name.startsWith("訂閱：");
}

/** 才藝班：使用者自訂名稱的範本（例如「才藝班：鋼琴」），兩人都看得到，可刪除。 */
function isTalentItem(item: RecurringItem) {
  return item.category === "才藝班" || item.name.startsWith("才藝班：");
}

/**
 * 繳費週期（只影響畫面上的「已記錄」判斷與標示，不改資料）：
 * 手機門號每 2 個月繳一次；管理費每季一次、月份不固定。期間內記過一筆就算已繳。
 */
const CYCLE_MONTHS: Record<string, number> = { "mobile-chris": 2, "mobile-wife": 2, "management-fee": 3 };

function cycleMonths(item: RecurringItem) {
  return CYCLE_MONTHS[item.id] ?? 1;
}

function cycleLabel(item: RecurringItem) {
  const months = cycleMonths(item);
  if (months === 3) return "每季";
  return months > 1 ? `每 ${months} 個月` : "";
}

function shiftMonthValue(yyyymm: string, diff: number) {
  const [year, month] = yyyymm.split("-").map(Number);
  const date = new Date(year, month - 1 + diff, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function usesPreviousMonthInsuranceDate(item: RecurringItem) {
  return item.id === "insurance-self-chris" || item.id === "insurance-junyao";
}

const DEFAULT_ITEMS: RecurringItem[] = [
  { id: "mortgage", name: "房貸", category: "房貸", amount: 25000, target: "self", paymentMethod: "銀行扣款", visibleFor: ["chris"] },
  { id: "home-equity-loan", name: "房屋增貸", category: "房屋增貸", amount: 11000, target: "self", paymentMethod: "銀行扣款", visibleFor: ["chris"] },
  { id: "management-fee", name: "管理費", category: "管理費", amount: 2500, target: "self", paymentMethod: "現金", visibleFor: ["chris"] },
  { id: "internet", name: "網路費", category: "網路費", amount: 999, target: "self", paymentMethod: "銀行扣款", visibleFor: ["chris"] },
  { id: "mobile-chris", name: "手機門號費", category: "手機門號費", amount: 699, target: "self", paymentMethod: "銀行扣款", visibleFor: ["chris"] },
  { id: "mobile-wife", name: "手機門號費", category: "手機門號費", amount: 699, target: "self", paymentMethod: "銀行扣款", visibleFor: ["wife"] },
  { id: "insurance-self-chris", name: "保險：我", category: "保險", amount: 4200, target: "self", paymentMethod: "信用卡", creditCard: "台新", visibleFor: ["chris"] },
  { id: "insurance-self-wife", name: "保險：我", category: "保險", amount: 3600, target: "self", paymentMethod: "信用卡", creditCard: "保費卡", visibleFor: ["wife"] },
  { id: "insurance-junyao", name: "保險：竣堯", category: "保險", amount: 1500, target: "junyao", paymentMethod: "信用卡", creditCard: "台新", visibleFor: ["chris"] },
  { id: "school-fee", name: "竣堯學費", category: "學費", amount: 12000, target: "junyao", paymentMethod: "轉帳", visibleFor: ["chris", "wife"] },
  { id: "after-school-care", name: "竣堯延托費", category: "學費", amount: 2500, target: "junyao", paymentMethod: "轉帳", visibleFor: ["wife"] },
  { id: "hospital-parking", name: "醫院停車月租", category: "停車費", amount: 0, target: "self", paymentMethod: "信用卡", creditCard: "中信", visibleFor: ["chris"] },
];

const STORAGE_KEY = "household-expense-recurring-items";

/** 固定支出範本 ID -> 貸款別。這兩個範本新增的支出帶 loanKey，還款明細不必依備註文字判斷。 */
const LOAN_TEMPLATE_KEYS: Record<string, LoanKey> = { mortgage: "ORIGINAL_MORTGAGE", "home-equity-loan": "TOP_UP_LOAN" };

/** 已移除的預設項目（例如信貸）：雲端或本機殘留的舊模板一律略過，不顯示也不再寫回。 */
const REMOVED_TEMPLATE_IDS = new Set(["personal-loan"]);

function isActiveTemplate(item: RecurringItem) {
  return !REMOVED_TEMPLATE_IDS.has(item.id);
}

/** 固定支出分組與順序：依 DEFAULT_ITEMS 排列；個人訂閱固定放最後。 */
const DEFAULT_ORDER = new Map(DEFAULT_ITEMS.map((item, index) => [item.id, index]));

function templateGroup(item: RecurringItem) {
  if (isSubscriptionItem(item)) return "訂閱";
  if (item.id === "mortgage" || item.id === "home-equity-loan") return "貸款";
  if (item.id === "management-fee") return "居住";
  if (item.id === "internet" || item.id.startsWith("mobile-")) return "通訊";
  if (item.category === "保險") return "保險";
  if (item.target === "junyao") return "竣堯";
  if (item.id === "hospital-parking") return "交通";
  return "其他";
}

function templateRank(item: RecurringItem) {
  if (isSubscriptionItem(item)) return 2;
  return DEFAULT_ORDER.has(item.id) || isTalentItem(item) ? 0 : 1;
}

function templateOrder(item: RecurringItem) {
  if (isTalentItem(item)) return (DEFAULT_ORDER.get("after-school-care") ?? 0) + 0.5;
  return DEFAULT_ORDER.get(item.id) ?? 0;
}

function normalizeRecurringItem(item: RecurringItem): RecurringItem {
  if (item.id === "mobile-chris" || item.id === "mobile-wife") {
    return { ...item, name: "手機門號費", category: "手機門號費", paymentMethod: "銀行扣款", creditCard: undefined };
  }
  if (item.id === "internet") {
    return { ...item, category: "網路費", paymentMethod: "銀行扣款", creditCard: undefined };
  }
  if (item.id === "management-fee") {
    return { ...item, paymentMethod: "現金", creditCard: undefined };
  }
  if (item.id === "hospital-parking") {
    return { ...item, category: "停車費", paymentMethod: "信用卡", creditCard: "中信" };
  }
  if (item.id === "insurance-self-chris" || item.id === "insurance-junyao") {
    return { ...item, category: "保險", paymentMethod: "信用卡", creditCard: "台新" };
  }
  return item;
}

function mergeDefaultItems(storedItems: RecurringItem[]) {
  const normalizedItems = storedItems.filter(isActiveTemplate).map(normalizeRecurringItem);
  const existingIds = new Set(normalizedItems.map((item) => item.id));
  const missingDefaults = DEFAULT_ITEMS.filter((item) => !existingIds.has(item.id));
  return [...normalizedItems, ...missingDefaults];
}

function loadStoredItems() {
  if (typeof window === "undefined") return DEFAULT_ITEMS;
  const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem("household-expense-demo-recurring-items");
  if (!raw) return DEFAULT_ITEMS;
  try {
    return mergeDefaultItems(JSON.parse(raw) as RecurringItem[]);
  } catch {
    return DEFAULT_ITEMS;
  }
}

function templateSnapshot(item: RecurringItem) {
  return {
    name: item.name,
    category: item.category,
    amount: item.amount,
    target: item.target,
    paymentMethod: item.paymentMethod,
    creditCard: item.creditCard,
    visibleFor: item.visibleFor,
  };
}

async function saveTemplateToCloud(item: RecurringItem, userId: string) {
  await upsertRecurringExpenseTemplate({ ...item, createdBy: userId });
}

export function RecurringExpensePanel({ viewer }: { viewer: Viewer }) {
  const user = useCurrentUser();
  const [items, setItems] = useState<RecurringItem[]>(loadStoredItems);
  const visibleItems = useMemo(() => items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.visibleFor.includes(viewer))
    .sort((a, b) =>
      templateRank(a.item) - templateRank(b.item) ||
      templateOrder(a.item) - templateOrder(b.item) ||
      a.index - b.index
    )
    .map(({ item }) => item), [items, viewer]);
  const groupedVisibleItems = useMemo(() => {
    const groups = new Map<string, RecurringItem[]>();
    for (const item of visibleItems) {
      const group = templateGroup(item);
      groups.set(group, [...(groups.get(group) ?? []), item]);
    }
    return [...groups.entries()];
  }, [visibleItems]);
  const creditCards = useMemo(() => getNormalCreditCards(viewer), [viewer]);
  const [selectedId, setSelectedId] = useState("");
  const [amountDraft, setAmountDraft] = useState("");
  const [expenseDate, setExpenseDate] = useState(today());
  const [insuranceBillMonth, setInsuranceBillMonth] = useState(currentMonthString());
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);
  const [subscriptionName, setSubscriptionName] = useState("");
  const [subscriptionAmount, setSubscriptionAmount] = useState("");
  const [subscriptionCard, setSubscriptionCard] = useState<CreditCardName>(creditCards[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [isTemplateLoading, setIsTemplateLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recordedIds, setRecordedIds] = useState<Map<string, string>>(() => new Map());
  const [showTalentForm, setShowTalentForm] = useState(false);
  const [talentName, setTalentName] = useState("");
  const [talentAmount, setTalentAmount] = useState("");
  const [talentPayment, setTalentPayment] = useState<"轉帳" | "現金" | "信用卡">("轉帳");
  const [recordedTick, setRecordedTick] = useState(0);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    setSubscriptionCard(creditCards[0]);
  }, [creditCards]);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    const userId = user.uid;

    async function loadCloudTemplates() {
      setIsTemplateLoading(true);
      try {
        const cloudItems = await getRecurringExpenseTemplates();
        const normalizedCloudItems = cloudItems.filter(isActiveTemplate).map(normalizeRecurringItem);
        const seedItems = normalizedCloudItems.length > 0 ? mergeDefaultItems(normalizedCloudItems) : mergeDefaultItems(loadStoredItems());
        const cloudById = new Map(normalizedCloudItems.map((item) => [item.id, item]));
        const templatesToSave = normalizedCloudItems.length === 0
          ? seedItems
          : seedItems.filter((item) => {
            const cloudItem = cloudById.get(item.id);
            return !cloudItem || JSON.stringify(templateSnapshot(cloudItem)) !== JSON.stringify(templateSnapshot(item));
          });

        await Promise.all(templatesToSave.map((item) => saveTemplateToCloud(item, userId)));
        if (isMounted) {
          setItems(seedItems);
          setMessage(normalizedCloudItems.length > 0 ? "" : "固定支出模板已同步到雲端。");
        }
      } catch (error) {
        console.error(error);
        if (isMounted) setMessage("固定支出雲端同步失敗，暫時使用本機模板。");
      } finally {
        if (isMounted) setIsTemplateLoading(false);
      }
    }

    loadCloudTemplates();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || visibleItems.length === 0) return;
    let isMounted = true;
    const month = currentMonthString();
    const insuranceDate = previousMonthDayForMonth(month, 24);

    async function loadRecorded() {
      try {
        const maxCycle = Math.max(1, ...visibleItems.map(cycleMonths));
        const cycleMonthList = Array.from({ length: maxCycle }, (_, index) => shiftMonthValue(month, -index));
        const months = Array.from(new Set([...cycleMonthList, insuranceDate.slice(0, 7)]));
        const records = (await Promise.all(months.map((value) => getExpenseRecordsByMonth(value)))).flat();
        const ids = new Map<string, string>();
        for (const item of visibleItems) {
          const paymentMethod = toPaymentMethod(item);
          const category = toExpenseCategory(item);
          const target = toTarget(item.target, viewer);
          const periodStart = `${shiftMonthValue(month, -(cycleMonths(item) - 1))}-01`;
          const inPeriod = (date: string) => usesPreviousMonthInsuranceDate(item) ? date === insuranceDate : date >= periodStart && date <= `${month}-31`;
          const shared = item.visibleFor.length > 1;
          const match = records
            .filter((record) =>
              inPeriod(record.date) &&
              record.note === item.name &&
              record.category === category &&
              record.target === target &&
              (shared || record.paidBy === viewer) &&
              record.paymentMethod === paymentMethod)
            .sort((a, b) => b.date.localeCompare(a.date))[0];
          if (match) ids.set(item.id, match.date);
        }
        if (isMounted) setRecordedIds(ids);
      } catch (error) {
        console.error(error);
      }
    }

    loadRecorded();
    return () => {
      isMounted = false;
    };
  }, [user, visibleItems, viewer, recordedTick]);

  const selectedItem = useMemo(() => visibleItems.find((item) => item.id === selectedId) ?? visibleItems[0], [selectedId, visibleItems]);
  const usesFixedInsuranceDate = selectedItem ? usesPreviousMonthInsuranceDate(selectedItem) : false;
  const effectiveExpenseDate = usesFixedInsuranceDate ? previousMonthDayForMonth(insuranceBillMonth, 24) : expenseDate;

  useEffect(() => {
    if (selectedItem) {
      setSelectedId(selectedItem.id);
      setAmountDraft(String(selectedItem.amount));
    }
  }, [viewer, selectedItem]);

  function updateSelectedAmount(value: string) {
    setAmountDraft(value);
  }

  async function saveSelectedAmount() {
    if (!selectedItem) return;
    if (amountDraft.trim() === "") {
      setAmountDraft(String(selectedItem.amount));
      return;
    }
    const amount = Number(amountDraft);
    if (!Number.isFinite(amount) || amount < 0) {
      setAmountDraft(String(selectedItem.amount));
      setMessage("請輸入正確金額。");
      return;
    }
    if (amount === selectedItem.amount) return;
    const updatedItem = { ...selectedItem, amount };
    setItems((current) => current.map((item) => item.id === selectedItem.id ? updatedItem : item));
    try {
      if (user) await saveTemplateToCloud(updatedItem, user.uid);
    } catch (error) {
      console.error(error);
      setItems((current) => current.map((item) => item.id === selectedItem.id ? selectedItem : item));
      setAmountDraft(String(selectedItem.amount));
      setMessage("固定支出金額同步失敗，已保留原本設定。");
    }
  }

  async function updateSelectedCreditCard(card: CreditCardName) {
    if (!selectedItem) return;
    const updatedItem = { ...selectedItem, creditCard: card };
    setItems((current) => current.map((item) => item.id === selectedItem.id ? updatedItem : item));
    try {
      if (user) await saveTemplateToCloud(updatedItem, user.uid);
    } catch (error) {
      console.error(error);
      setItems((current) => current.map((item) => item.id === selectedItem.id ? selectedItem : item));
      setMessage("信用卡設定同步失敗，已保留原本設定。");
    }
  }

  async function deleteSelectedSubscription() {
    if (!selectedItem || !(isSubscriptionItem(selectedItem) || isTalentItem(selectedItem))) return;
    const ok = window.confirm(`確定要刪除「${selectedItem.name}」這個模板嗎？`);
    if (!ok) return;

    try {
      if (user) await deleteRecurringExpenseTemplate(selectedItem.id);
      const remainingVisibleItems = visibleItems.filter((item) => item.id !== selectedItem.id);
      setItems((current) => current.filter((item) => item.id !== selectedItem.id));
      setSelectedId(remainingVisibleItems[0]?.id ?? "");
      setMessage(`已刪除訂閱模板：${selectedItem.name}`);
    } catch (error) {
      console.error(error);
      setMessage("刪除雲端訂閱模板失敗，請稍後再試。");
    }
  }

  async function importThisMonth() {
    if (!selectedItem) return;
    if (!user) {
      setMessage("請先登入。");
      return;
    }
    if (!selectedItem.amount || selectedItem.amount <= 0) {
      setMessage("請輸入正確金額。");
      return;
    }
    const ok = window.confirm(`確定新增固定支出「${selectedItem.name}」${selectedItem.amount.toLocaleString("zh-TW")} 元嗎？`);
    if (!ok) return;
    const paymentMethod = toPaymentMethod(selectedItem);
    const category = toExpenseCategory(selectedItem);
    const target = toTarget(selectedItem.target, viewer);
    const recordDate = effectiveExpenseDate;
    setIsSaving(true);
    setMessage("");
    try {
      const existingExpenses = await getExpenseRecordsByMonth(recordDate.slice(0, 7));
      const duplicate = existingExpenses.find((record) =>
        record.note === selectedItem.name &&
        record.category === category &&
        record.target === target &&
        record.paidBy === viewer &&
        record.paymentMethod === paymentMethod &&
        (record.creditCard ?? "") === (paymentMethod === "credit_card" ? selectedItem.creditCard ?? "" : "")
      );
      if (duplicate) {
        const duplicateOk = window.confirm(`這個月已經新增過「${selectedItem.name}」。仍然要再新增一次嗎？`);
        if (!duplicateOk) return;
      }
      await addExpenseRecord({
        date: recordDate,
        amount: selectedItem.amount,
        category,
        target,
        paidBy: viewer as OwnerKey,
        paymentMethod,
        creditCard: paymentMethod === "credit_card" ? selectedItem.creditCard : undefined,
        note: selectedItem.name,
        isPrivate: false,
        createdBy: user.uid,
        loanKey: LOAN_TEMPLATE_KEYS[selectedItem.id],
      });
      setRecordedTick((value) => value + 1);
      setMessage(`已新增：${selectedItem.name}｜${recordDate}｜${category}｜${selectedItem.paymentMethod}${selectedItem.creditCard ? `・${selectedItem.creditCard}` : ""}｜$${selectedItem.amount.toLocaleString("zh-TW")}`);
    } catch (error) {
      console.error(error);
      setMessage("新增失敗，請確認 Firestore rules 或稍後再試。");
    } finally {
      setIsSaving(false);
    }
  }

  async function addTalentClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(talentAmount);
    if (!talentName.trim() || !Number.isFinite(amount) || amount < 0 || talentAmount.trim() === "") {
      setMessage("請輸入才藝班名稱與正確金額。");
      return;
    }
    if (!user) {
      setMessage("請先登入。");
      return;
    }
    const item: RecurringItem = {
      id: `talent-${Date.now()}`,
      name: `才藝班：${talentName.trim()}`,
      category: "才藝班",
      amount,
      target: "junyao",
      paymentMethod: talentPayment,
      creditCard: talentPayment === "信用卡" ? creditCards[0] : undefined,
      visibleFor: ["chris", "wife"],
    };
    try {
      await saveTemplateToCloud(item, user.uid);
      setItems((current) => [...current, item]);
      setSelectedId(item.id);
      setTalentName("");
      setTalentAmount("");
      setTalentPayment("轉帳");
      setShowTalentForm(false);
      setMessage(`已新增才藝班：${item.name}`);
    } catch (error) {
      console.error(error);
      setMessage("新增才藝班失敗，請稍後再試。");
    }
  }

  async function addSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(subscriptionAmount);
    if (!subscriptionName.trim() || !amount || amount <= 0) {
      setMessage("請輸入訂閱名稱與正確金額。");
      return;
    }
    if (!user) {
      setMessage("請先登入。");
      return;
    }
    const item: RecurringItem = {
      id: `subscription-${viewer}-${Date.now()}`,
      name: `訂閱：${subscriptionName.trim()}`,
      category: "訂閱",
      amount,
      target: "self",
      paymentMethod: "信用卡",
      creditCard: subscriptionCard,
      visibleFor: [viewer],
    };
    try {
      await saveTemplateToCloud(item, user.uid);
      setItems((current) => [...current, item]);
      setSelectedId(item.id);
      setSubscriptionName("");
      setSubscriptionAmount("");
      setSubscriptionCard(creditCards[0]);
      setShowSubscriptionForm(false);
      setMessage(`已新增訂閱模板：${item.name}`);
    } catch (error) {
      console.error(error);
      setMessage("新增雲端訂閱模板失敗，請稍後再試。");
    }
  }

  const recordedCount = visibleItems.filter((item) => recordedIds.has(item.id)).length;
  const progressPercent = visibleItems.length > 0 ? Math.round((recordedCount / visibleItems.length) * 100) : 0;

  return (
    <section className="grid fixed-panel">
      <div className="fixed-progress">
        <div className="home-bar"><span style={{ width: `${progressPercent}%` }} /></div>
        <span>本月已記錄 {recordedCount} / {visibleItems.length}</span>
      </div>
      {isTemplateLoading ? <p className="muted fixed-note">正在同步固定支出模板...</p> : null}
      {message ? <p className="muted fixed-note" role="status">{message}</p> : null}

      {groupedVisibleItems.map(([group, groupItems]) => (
        <div className="fixed-group" key={group}>
          <h2 className="fixed-group-title">{group}</h2>
          <div className="card fixed-list">
            {groupItems.map((item) => {
              const isOpen = expandedId === item.id && selectedItem?.id === item.id;
              const isRecorded = recordedIds.has(item.id);
              return <div className="fixed-item" key={item.id}>
                <button className="fixed-row" type="button" aria-expanded={isOpen} onClick={() => { setSelectedId(item.id); setExpandedId(isOpen ? null : item.id); }}>
                  <span className="fixed-row-main">
                    <span className={isRecorded ? "fixed-name done" : "fixed-name"}>{item.name}</span>
                    <span className="muted">{cycleLabel(item) ? `${cycleLabel(item)} · ` : ""}${item.amount.toLocaleString("zh-TW")} · {item.paymentMethod}{item.creditCard ? ` ${item.creditCard}` : ""}{item.target !== "self" ? ` · ${labelForOwner(item.target, viewer)}` : ""}</span>
                  </span>
                  {isRecorded
                    ? <span className="fixed-done"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>{cycleMonths(item) > 1 ? `已繳 ${(recordedIds.get(item.id) ?? "").slice(5).replace("-", "/")}` : "本月已記錄"}</span>
                    : <span className="fixed-todo">記錄</span>}
                </button>
                {isOpen && selectedItem ? <div className="fixed-editor">
                  <div className="fixed-editor-fields">
                    <label className="field">
                      <span>{usesFixedInsuranceDate ? "帳單月份" : "支出日期"}</span>
                      {usesFixedInsuranceDate ? (
                        <input className="input" type="month" value={insuranceBillMonth} onChange={(event) => setInsuranceBillMonth(event.target.value)} />
                      ) : (
                        <input className="input" type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} />
                      )}
                    </label>
                    <label className="field">
                      <span>金額</span>
                      <input className="input" type="number" inputMode="decimal" pattern="[0-9]*" step="1" value={amountDraft} onChange={(event) => updateSelectedAmount(event.target.value)} onBlur={saveSelectedAmount} />
                    </label>
                  </div>
                  {usesFixedInsuranceDate ? <small className="muted">實際刷卡日固定為 {effectiveExpenseDate}，會歸入 {insuranceBillMonth} 的信用卡帳單。</small> : null}
                  {selectedItem.paymentMethod === "信用卡" && selectedItem.creditCard !== "保費卡" ? (
                    <label className="field">
                      <span>信用卡</span>
                      <select className="select" value={selectedItem.creditCard ?? creditCards[0]} onChange={(event) => updateSelectedCreditCard(event.target.value as CreditCardName)}>
                        {creditCards.map((card) => <option key={card}>{card}</option>)}
                      </select>
                    </label>
                  ) : null}
                  <div className="fixed-editor-actions">
                    {isSubscriptionItem(selectedItem) || isTalentItem(selectedItem) ? <button className="btn secondary danger-text" type="button" onClick={deleteSelectedSubscription}>{isTalentItem(selectedItem) ? "刪除這個才藝班" : "刪除這個訂閱"}</button> : null}
                    <button className="btn" type="button" onClick={importThisMonth} disabled={isSaving}>{isSaving ? "新增中..." : isRecorded ? "再新增一筆" : "新增這筆支出"}</button>
                  </div>
                </div> : null}
              </div>;
            })}
          </div>
        </div>
      ))}

      <button className="btn secondary" type="button" onClick={() => setShowTalentForm((value) => !value)}>
        {showTalentForm ? "收起新增才藝班" : "＋ 新增才藝班"}
      </button>

      {showTalentForm ? (
        <form className="card grid" onSubmit={addTalentClass}>
          <h3 style={{ margin: 0 }}>新增才藝班</h3>
          <label className="field"><span>才藝班名稱</span><input className="input" value={talentName} onChange={(event) => setTalentName(event.target.value)} placeholder="例如 鋼琴、游泳、美術" /></label>
          <label className="field"><span>每月金額</span><input className="input" type="number" inputMode="decimal" pattern="[0-9]*" step="1" value={talentAmount} onChange={(event) => setTalentAmount(event.target.value)} placeholder="例如 2400" /></label>
          <label className="field"><span>付款方式</span><select className="select" value={talentPayment} onChange={(event) => setTalentPayment(event.target.value as "轉帳" | "現金" | "信用卡")}><option>轉帳</option><option>現金</option><option>信用卡</option></select></label>
          <p className="muted" style={{ margin: 0 }}>會出現在「竣堯」分組，兩人都看得到；記錄時歸「學費」分類。</p>
          <button className="btn" type="submit">儲存才藝班</button>
        </form>
      ) : null}

      <button className="btn secondary" type="button" onClick={() => setShowSubscriptionForm((value) => !value)}>
        {showSubscriptionForm ? "收起新增訂閱" : "＋ 新增個人訂閱"}
      </button>

      {showSubscriptionForm ? (
        <form className="card grid" onSubmit={addSubscription}>
          <h3 style={{ margin: 0 }}>新增個人訂閱</h3>
          <label className="field"><span>訂閱名稱</span><input className="input" value={subscriptionName} onChange={(event) => setSubscriptionName(event.target.value)} placeholder="例如 GPT、動畫瘋" /></label>
          <label className="field"><span>金額</span><input className="input" type="number" inputMode="decimal" pattern="[0-9]*" step="1" value={subscriptionAmount} onChange={(event) => setSubscriptionAmount(event.target.value)} placeholder="例如 660" /></label>
          <label className="field"><span>信用卡</span><select className="select" value={subscriptionCard} onChange={(event) => setSubscriptionCard(event.target.value as CreditCardName)}>{creditCards.map((card) => <option key={card}>{card}</option>)}</select></label>
          <button className="btn" type="submit">儲存訂閱模板</button>
        </form>
      ) : null}
    </section>
  );
}

