import type { IncomeCategory, IncomeOwner, IncomeRecord } from "../src/types/income";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;
type Expect<Value extends true> = Value;

type ExpectedIncomeCategory =
  | "本薪"
  | "獎勵金"
  | "加班費"
  | "值班費"
  | "衛福部津貼"
  | "年終"
  | "年終獎金"
  | "生活費轉入"
  | "其他";

type ExpectedIncomeRecord = {
  id: string;
  householdId: string;
  date: string;
  amount: number;
  owner: "chris" | "wife";
  category: ExpectedIncomeCategory;
  note?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type IncomeOwnerContract = Expect<Equal<IncomeOwner, "chris" | "wife">>;
export type IncomeCategoryContract = Expect<Equal<IncomeCategory, ExpectedIncomeCategory>>;
export type IncomeRecordContract = Expect<Equal<IncomeRecord, ExpectedIncomeRecord>>;
