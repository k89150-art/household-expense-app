import { ExpenseCategory } from "@/types/domain";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "餐飲",
  "交通",
  "生活用品",
  "孩子",
  "醫療",
  "保險",
  "房貸",
  "管理費",
  "水費",
  "電費",
  "瓦斯費",
  "網路費",
  "訂閱",
  "娛樂",
  "衣物",
  "寵物",
  "個人雜支",
  "信用卡繳款",
  "其他",
];

export const TARGET_LABELS = {
  family: "家庭",
  chris: "Chris",
  wife: "太太",
  son: "兒子",
  cat: "貓",
  other: "其他",
} as const;

export const PAYMENT_METHOD_LABELS = {
  cash: "現金",
  credit_card: "信用卡",
  bank_transfer: "轉帳",
  line_pay: "LINE Pay",
  prepaid: "預付金",
  other: "其他",
} as const;
