import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { HOUSEHOLD_ID } from "@/lib/household";
import { ExpenseCategory, PaymentMethod, PersonTarget } from "@/types/domain";

export type CreditCardName = "玉山" | "台新" | "國泰" | "中信" | "保費卡";

export type ExpenseRecord = {
  id: string;
  householdId: string;
  date: string;
  amount: number;
  category: ExpenseCategory;
  target: PersonTarget;
  paidBy: "chris" | "wife";
  paymentMethod: PaymentMethod;
  creditCard?: CreditCardName;
  note?: string;
  isPrivate: boolean;
  privateNote?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type NewExpenseInput = Omit<ExpenseRecord, "id" | "householdId" | "createdAt" | "updatedAt">;

type FirestoreWritable = Record<string, string | number | boolean | unknown>;

function removeUndefinedFields<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)) as FirestoreWritable;
}

export async function addExpenseRecord(input: NewExpenseInput) {
  const collectionRef = collection(db, "households", HOUSEHOLD_ID, "expenses");
  const payload = removeUndefinedFields({
    ...input,
    householdId: HOUSEHOLD_ID,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await addDoc(collectionRef, payload);
}

export async function getExpenseRecordsByMonth(month: string) {
  const collectionRef = collection(db, "households", HOUSEHOLD_ID, "expenses");
  const snapshot = await getDocs(query(collectionRef, where("date", ">=", `${month}-01`), where("date", "<=", `${month}-31`), orderBy("date", "desc")));
  return snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() })) as ExpenseRecord[];
}

export async function updateExpenseRecord(id: string, input: Partial<NewExpenseInput>) {
  const docRef = doc(db, "households", HOUSEHOLD_ID, "expenses", id);
  await updateDoc(docRef, removeUndefinedFields({ ...input, updatedAt: serverTimestamp() }));
}

export async function deleteExpenseRecord(id: string) {
  const docRef = doc(db, "households", HOUSEHOLD_ID, "expenses", id);
  await deleteDoc(docRef);
}
