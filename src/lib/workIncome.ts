import { INCOME_CATEGORIES, INCOME_OWNERS } from "../types/income.ts";
import type { IncomeCategory, IncomeOwner } from "../types/income.ts";

// Pure selection contract only: no Firebase, storage, network or accounting side effects.
export const RECURRING_WORK_INCOME_CATEGORIES = [
  "本薪",
  "獎勵金",
  "加班費",
  "值班費",
  "衛福部津貼",
] as const satisfies readonly IncomeCategory[];

export const WORK_INCOME_CATEGORIES = [
  ...RECURRING_WORK_INCOME_CATEGORIES,
  "年終",
  "年終獎金",
] as const satisfies readonly IncomeCategory[];

export type WorkIncomeCategory = typeof WORK_INCOME_CATEGORIES[number];

export interface WorkIncomePolicy {
  eligibleOwners: readonly IncomeOwner[];
}

/** Default pure-function policy treats both existing household members equally. */
export const HOUSEHOLD_WORK_INCOME_POLICY = {
  eligibleOwners: INCOME_OWNERS,
} as const satisfies WorkIncomePolicy;

/**
 * Archived candidate contract only. It is intentionally opt-in and is not used by
 * the current income UI, Firestore CRUD, reports or household calculations.
 */
export const CANDIDATE_CHRIS_ONLY_WORK_INCOME_POLICY = {
  eligibleOwners: ["chris"],
} as const satisfies WorkIncomePolicy;

export interface EligibleWorkIncome {
  date: string;
  amount: number;
  category: WorkIncomeCategory;
  recurring: boolean;
}

export type WorkIncomeSelection =
  | { kind: "ELIGIBLE"; value: EligibleWorkIncome }
  | { kind: "EXCLUDED"; reason: "OWNER" | "CATEGORY" }
  | { kind: "INVALID"; code: "INVALID_SOURCE_DATA" };

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function includes<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function isPositiveAmount(value: unknown): value is number {
  return typeof value === "number"
    && Number.isFinite(value)
    && value > 0
    && value <= Number.MAX_SAFE_INTEGER
    && /^(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?$/.test(String(value));
}

export function selectWorkIncome(
  value: unknown,
  expectedHouseholdId: string,
  policy: WorkIncomePolicy = HOUSEHOLD_WORK_INCOME_POLICY,
): WorkIncomeSelection {
  const invalid: WorkIncomeSelection = { kind: "INVALID", code: "INVALID_SOURCE_DATA" };
  if (!expectedHouseholdId.trim() || !isObject(value)
    || value.householdId !== expectedHouseholdId
    || !includes(INCOME_OWNERS, value.owner)
    || !includes(INCOME_CATEGORIES, value.category)
    || !isCalendarDate(value.date)
    || !isPositiveAmount(value.amount)) {
    return invalid;
  }

  if (!policy.eligibleOwners.includes(value.owner)) return { kind: "EXCLUDED", reason: "OWNER" };
  const category = WORK_INCOME_CATEGORIES.find((item) => item === value.category);
  if (!category) return { kind: "EXCLUDED", reason: "CATEGORY" };

  return {
    kind: "ELIGIBLE",
    value: {
      date: value.date,
      amount: value.amount,
      category,
      recurring: RECURRING_WORK_INCOME_CATEGORIES.some((item) => item === category),
    },
  };
}

export function selectWorkIncomeRecords(
  values: readonly unknown[],
  expectedHouseholdId: string,
  policy: WorkIncomePolicy = HOUSEHOLD_WORK_INCOME_POLICY,
): WorkIncomeSelection[] {
  return values.map((value) => selectWorkIncome(value, expectedHouseholdId, policy));
}
