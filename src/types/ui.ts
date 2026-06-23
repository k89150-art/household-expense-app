import { ExpenseCategory, PaymentMethod, PersonTarget } from "./domain";

export type DemoExpense = {
  id: string;
  date: string;
  amount: number;
  category: ExpenseCategory;
  target: PersonTarget;
  paymentMethod: PaymentMethod;
  note: string;
  isPrivate: boolean;
};

export type AppTab = "home" | "add" | "recurring" | "reports";
