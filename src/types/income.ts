/** 收入擁有者沿用既有家庭成員識別，不使用 Firebase UID。 */
export const INCOME_OWNERS = ["chris", "wife"] as const;
export type IncomeOwner = typeof INCOME_OWNERS[number];

/**
 * Firestore 既有收入分類。
 * `年終` 是舊資料仍可能使用的精確值；新表單只提供 `年終獎金`。
 */
export const INCOME_CATEGORIES = [
  "本薪",
  "獎勵金",
  "加班費",
  "值班費",
  "衛福部津貼",
  "年終",
  "年終獎金",
  "生活費轉入",
  "其他",
] as const;
export type IncomeCategory = typeof INCOME_CATEGORIES[number];

export const INCOME_ENTRY_CATEGORIES = INCOME_CATEGORIES.filter((category) => category !== "年終");
export type IncomeEntryCategory = typeof INCOME_ENTRY_CATEGORIES[number];

export interface IncomeRecord {
  id: string;
  householdId: string;
  date: string;
  amount: number;
  owner: IncomeOwner;
  category: IncomeCategory;
  note?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}
