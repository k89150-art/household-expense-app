import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { HOUSEHOLD_ID } from "@/lib/household";
import { ExpenseCategory, PaymentMethod, PersonTarget } from "@/types/domain";

export type CreditCardName = "玉山" | "台新" | "國泰" | "中信" | "保費卡";
export type OwnerKey = "chris" | "wife";

export type ExpenseRecord = {
  id: string;
  householdId: string;
  date: string;
  amount: number;
  category: ExpenseCategory;
  target: PersonTarget;
  paidBy: OwnerKey;
  paymentMethod: PaymentMethod;
  creditCard?: CreditCardName;
  note?: string;
  isPrivate: boolean;
  privateNote?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type IncomeRecord = {
  id: string;
  householdId: string;
  date: string;
  amount: number;
  owner: OwnerKey;
  category: "本薪" | "獎勵金" | "加班費" | "年終" | "生活費轉入" | "其他";
  note?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type InvestmentRecord = {
  id: string;
  householdId: string;
  date: string;
  amount: number;
  owner: OwnerKey;
  type: "定期定額" | "單筆買入" | "股息再投入" | "其他";
  name: string;
  note?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type AdvanceRecord = {
  id: string;
  householdId: string;
  date: string;
  amount: number;
  owner: OwnerKey;
  item: string;
  target: "醫院" | "太太" | "先生" | "其他";
  status: "待核銷" | "已送件" | "已收回";
  paymentMethod: PaymentMethod;
  creditCard?: CreditCardName;
  reimbursedDate?: string;
  note?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type CardPaymentRecord = {
  id: string;
  householdId: string;
  date: string;
  amount: number;
  owner: OwnerKey;
  card: CreditCardName;
  billMonth: string;
  status: "已繳款";
  paidDate: string;
  note?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type NewExpenseInput = Omit<ExpenseRecord, "id" | "householdId" | "createdAt" | "updatedAt">;
export type NewIncomeInput = Omit<IncomeRecord, "id" | "householdId" | "createdAt" | "updatedAt">;
export type NewInvestmentInput = Omit<InvestmentRecord, "id" | "householdId" | "createdAt" | "updatedAt">;
export type NewAdvanceInput = Omit<AdvanceRecord, "id" | "householdId" | "createdAt" | "updatedAt">;
export type NewCardPaymentInput = Omit<CardPaymentRecord, "id" | "householdId" | "createdAt" | "updatedAt">;

type FirestoreWritable = Record<string, string | number | boolean | unknown>;

function removeUndefinedFields<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)) as FirestoreWritable;
}

async function addRecord(collectionName: string, input: Record<string, unknown>) {
  const collectionRef = collection(db, "households", HOUSEHOLD_ID, collectionName);
  await addDoc(collectionRef, removeUndefinedFields({
    ...input,
    householdId: HOUSEHOLD_ID,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
}

async function getRecordsByMonth<T>(collectionName: string, month: string) {
  const collectionRef = collection(db, "households", HOUSEHOLD_ID, collectionName);
  const snapshot = await getDocs(query(collectionRef, where("date", ">=", `${month}-01`), where("date", "<=", `${month}-31`), orderBy("date", "desc")));
  return snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() })) as T[];
}

export async function addExpenseRecord(input: NewExpenseInput) {
  await addRecord("expenses", input);
}

export async function getExpenseRecordsByMonth(month: string) {
  return getRecordsByMonth<ExpenseRecord>("expenses", month);
}

export async function updateExpenseRecord(id: string, input: Partial<NewExpenseInput>) {
  const docRef = doc(db, "households", HOUSEHOLD_ID, "expenses", id);
  await updateDoc(docRef, removeUndefinedFields({ ...input, updatedAt: serverTimestamp() }));
}

export async function deleteExpenseRecord(id: string) {
  const docRef = doc(db, "households", HOUSEHOLD_ID, "expenses", id);
  await deleteDoc(docRef);
}

export async function addIncomeRecord(input: NewIncomeInput) {
  await addRecord("incomes", input);
}

export async function getIncomeRecordsByMonth(month: string) {
  return getRecordsByMonth<IncomeRecord>("incomes", month);
}

export async function deleteIncomeRecord(id: string) {
  const docRef = doc(db, "households", HOUSEHOLD_ID, "incomes", id);
  await deleteDoc(docRef);
}

export async function addInvestmentRecord(input: NewInvestmentInput) {
  await addRecord("investments", input);
}

export async function getInvestmentRecordsByMonth(month: string) {
  return getRecordsByMonth<InvestmentRecord>("investments", month);
}

export async function deleteInvestmentRecord(id: string) {
  const docRef = doc(db, "households", HOUSEHOLD_ID, "investments", id);
  await deleteDoc(docRef);
}

export async function addAdvanceRecord(input: NewAdvanceInput) {
  await addRecord("advances", input);
}

export async function getAdvanceRecordsByMonth(month: string) {
  return getRecordsByMonth<AdvanceRecord>("advances", month);
}

export async function updateAdvanceRecord(id: string, input: Partial<NewAdvanceInput>) {
  const docRef = doc(db, "households", HOUSEHOLD_ID, "advances", id);
  await updateDoc(docRef, removeUndefinedFields({ ...input, updatedAt: serverTimestamp() }));
}

export async function deleteAdvanceRecord(id: string) {
  const docRef = doc(db, "households", HOUSEHOLD_ID, "advances", id);
  await deleteDoc(docRef);
}

export async function addCardPaymentRecord(input: NewCardPaymentInput) {
  await addRecord("cardPayments", input);
}

export async function getCardPaymentRecordsByMonth(month: string) {
  return getRecordsByMonth<CardPaymentRecord>("cardPayments", month);
}

export async function getCardPaymentRecordsByBillMonth(month: string) {
  const collectionRef = collection(db, "households", HOUSEHOLD_ID, "cardPayments");
  const snapshot = await getDocs(query(collectionRef, where("billMonth", "==", month), orderBy("date", "desc")));
  return snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() })) as CardPaymentRecord[];
}

export async function deleteCardPaymentRecord(id: string) {
  const docRef = doc(db, "households", HOUSEHOLD_ID, "cardPayments", id);
  await deleteDoc(docRef);
}
