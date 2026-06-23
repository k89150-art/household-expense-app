import { ExpenseCategory } from "@/types/domain";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "餐飲",
  "交通",
  "生活用品",
  "醫療",
  "管理費",
  "水費",
  "電費",
  "瓦斯費",
  "網路費",
  "娛樂",
  "衣物",
  "寵物",
  "保健食品",
  "個人雜支",
  "其他",
];

export const TARGET_LABELS = {
  chris: "我",
  wife: "太太",
  junyao: "竣堯",
  cat: "貓",
} as const;

export const PAYER_LABELS = {
  chris: "我付",
  wife: "太太付",
} as const;

export const PAYMENT_METHOD_LABELS = {
  cash: "現金",
  credit_card: "信用卡",
  bank_transfer: "轉帳",
  line_pay: "LINE Pay",
  prepaid: "預付金",
  other: "其他",
} as const;
