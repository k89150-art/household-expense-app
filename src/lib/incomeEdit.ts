import { INCOME_CATEGORIES, INCOME_ENTRY_CATEGORIES } from "../types/income.ts";
import type { IncomeCategory, IncomeRecord } from "../types/income.ts";
import { isCalendarDate } from "./workIncome.ts";

// Pure edit contract for an existing income document: no Firebase, storage or network.
// Editing keeps the Firestore document ID, owner, householdId and createdBy, so a synced
// copy elsewhere (Portfolio Steward) sees an UPDATE of the same record, never delete + add.

export interface IncomeEditDraft {
  date: string;
  amount: string;
  category: string;
  note: string;
}

/** Changed fields only. `note: null` removes the note field. */
export interface IncomeRecordChanges {
  date?: string;
  amount?: number;
  category?: IncomeCategory;
  note?: string | null;
}

export type IncomeEditResult =
  | { ok: true; changes: IncomeRecordChanges }
  | { ok: false; code: "INVALID_DATE" | "INVALID_AMOUNT" | "INVALID_CATEGORY" | "NOTE_TOO_LONG" | "NO_CHANGES" };

const AMOUNT_TEXT = /^(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?$/;
const MAX_NOTE_LENGTH = 200;

/** Categories offered when editing: the entry list, plus the legacy value the record already has. */
export function editableIncomeCategories(current: IncomeCategory): readonly IncomeCategory[] {
  return (INCOME_ENTRY_CATEGORIES as readonly IncomeCategory[]).includes(current)
    ? INCOME_ENTRY_CATEGORIES
    : [current, ...INCOME_ENTRY_CATEGORIES];
}

export function draftFromIncome(record: Pick<IncomeRecord, "date" | "amount" | "category" | "note">): IncomeEditDraft {
  return { date: record.date, amount: String(record.amount), category: record.category, note: record.note ?? "" };
}

export function buildIncomeChanges(
  original: Pick<IncomeRecord, "date" | "amount" | "category" | "note">,
  draft: IncomeEditDraft,
): IncomeEditResult {
  const date = draft.date.trim();
  if (!isCalendarDate(date)) return { ok: false, code: "INVALID_DATE" };

  const amountText = draft.amount.trim();
  const amount = Number(amountText);
  if (!AMOUNT_TEXT.test(amountText) || !Number.isFinite(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER) {
    return { ok: false, code: "INVALID_AMOUNT" };
  }

  const category = draft.category;
  const allowed = (INCOME_CATEGORIES as readonly string[]).includes(category)
    && editableIncomeCategories(original.category).includes(category as IncomeCategory);
  if (!allowed) return { ok: false, code: "INVALID_CATEGORY" };

  const note = draft.note.trim();
  if (note.length > MAX_NOTE_LENGTH) return { ok: false, code: "NOTE_TOO_LONG" };

  const changes: IncomeRecordChanges = {};
  if (date !== original.date) changes.date = date;
  if (amount !== original.amount) changes.amount = amount;
  if (category !== original.category) changes.category = category as IncomeCategory;
  const originalNote = (original.note ?? "").trim();
  if (note !== originalNote) changes.note = note === "" ? null : note;

  return Object.keys(changes).length === 0 ? { ok: false, code: "NO_CHANGES" } : { ok: true, changes };
}

export const INCOME_EDIT_MESSAGES: Record<Exclude<IncomeEditResult, { ok: true }>["code"], string> = {
  INVALID_DATE: "請輸入正確日期。",
  INVALID_AMOUNT: "請輸入正確收入金額（大於 0，最多兩位小數）。",
  INVALID_CATEGORY: "收入名目不正確。",
  NOTE_TOO_LONG: `備註最多 ${MAX_NOTE_LENGTH} 字。`,
  NO_CHANGES: "沒有任何變更。",
};
