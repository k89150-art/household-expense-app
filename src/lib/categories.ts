import { ExpenseCategory } from "@/types/domain";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "餐飲",
  "交通",
  "生活用品",
  "醫療",
  "居家固定費",
  "網路費",
  "娛樂",
  "衣物",
  "寵物",
  "保健食品",
  "稅金",
  "個人雜支",
  "其他",
];

export const HOME_FEE_ITEMS = ["水費", "電費", "瓦斯費", "管理費"] as const;
export const TAX_ITEMS = ["牌照稅", "房屋稅", "所得稅", "燃料稅", "地價稅"] as const;

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
  other: "其他",
} as const;
