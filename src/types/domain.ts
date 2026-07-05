export type UserRole = "husband" | "wife";
export type PersonTarget = "chris" | "wife" | "junyao" | "cat";
export type PaymentMethod = "cash" | "credit_card" | "bank_transfer" | "line_pay" | "prepaid" | "other";
export type ExpenseScope = "personal";
export type RecurringCycle = "monthly" | "yearly" | "custom";
export type BillStatus = "unpaid" | "paid" | "partial";

export type ExpenseCategory =
  | "餐飲"
  | "交通"
  | "生活用品"
  | "文具"
  | "醫療"
  | "居家固定費"
  | "手機門號費"
  | "網路費"
  | "保險"
  | "學費"
  | "娛樂"
  | "衣物"
  | "寵物"
  | "保健食品"
  | "稅金"
  | "個人雜支"
  | "其他";

export interface HouseholdUser {
  id: string;
  householdId: string;
  displayName: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface Household {
  id: string;
  name: string;
  memberIds: string[];
  createdAt: string;
}

export interface Expense {
  id: string;
  householdId: string;
  date: string;
  amount: number;
  category: ExpenseCategory;
  scope: ExpenseScope;
  target: PersonTarget;
  paidBy: string;
  paymentMethod: PaymentMethod;
  creditCardId?: string;
  prepaidAccountId?: string;
  note?: string;
  isPrivate: boolean;
  privateOwnerId?: string;
  publicNote?: string;
  excludeFromExpenseReport?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrivateExpenseDetail {
  id: string;
  expenseId: string;
  ownerId: string;
  actualItem: string;
  privateNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Income {
  id: string;
  householdId: string;
  date: string;
  amount: number;
  ownerId: string;
  category: "薪水" | "生活費轉入" | "獎金" | "兼職" | "補助" | "投資收入" | "其他";
  note?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LivingTransfer {
  id: string;
  householdId: string;
  month: string;
  date: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  purpose: "家用" | "孩子費用" | "生活費" | "房貸/房租" | "保險" | "其他";
  status: "pending" | "completed";
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringExpense {
  id: string;
  householdId: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  cycle: RecurringCycle;
  installmentTotal?: number;
  installmentCurrent?: number;
  payerId: string;
  paymentMethod: PaymentMethod;
  creditCardId?: string;
  target: PersonTarget;
  startMonth: string;
  endMonth?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreditCard {
  id: string;
  householdId: string;
  name: string;
  ownerId: string;
  closingDay: number;
  paymentDueDay: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreditCardBill {
  id: string;
  householdId: string;
  creditCardId: string;
  billMonth: string;
  billAmount: number;
  paidAmount: number;
  paymentDate?: string;
  status: BillStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrepaidAccount {
  id: string;
  householdId: string;
  name: string;
  ownerId: string;
  balance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PrepaidSettlement {
  id: string;
  householdId: string;
  prepaidAccountId: string;
  periodStart: string;
  periodEnd: string;
  previousBalance: number;
  topUpAmount: number;
  currentBalance: number;
  calculatedExpense: number;
  linkedExpenseId: string;
  note?: string;
  createdAt: string;
}
