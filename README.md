# 一起記

iPhone 優先的家庭收支 App，使用 Next.js + Firebase + Vercel。

## 核心特色

- 夫妻共用家庭帳本
- 不做分帳，專注家庭收支
- 月初生活費轉帳紀錄
- 支出、收入、固定支出模板
- 醫療費可分對象
- 管理費、房貸、保險、水電瓦斯、網路費
- 信用卡消費逐筆記，帳單只追蹤繳款
- 個人雜支私人明細
- 醫院午餐預付金每週結算

## 開發

本機工作區：`C:\Projects\Household-Expense`。依賴以 `pnpm-lock.yaml` 鎖定：

```bash
pnpm install --frozen-lockfile --ignore-scripts
npm run dev
```

複製 `.env.example` 成 `.env.local`，填入**開發用** Firebase 專案設定（非 production 環境若混入正式專案設定，App 會拒絕初始化）。
測試、檢查與建置：`npm run test`、`npm run test:emulator`、`npm run lint`、`npm run build`。

## 專案文件

| 文件 | 內容 |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | AI 協作規則、驗證要求、依賴安裝 |
| [`CLAUDE.md`](CLAUDE.md) | 維護指引與不可破壞的帳務規則 |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | 現行架構、資料結構、帳務邏輯與環境隔離 |
| [`docs/PROJECT_DECISIONS.md`](docs/PROJECT_DECISIONS.md) | 長期決策紀錄（D-001 起） |
| [`docs/AI_HANDOFF.md`](docs/AI_HANDOFF.md) | 依時間排列的交接紀錄與目前狀態 |
| [`docs/SPEC.md`](docs/SPEC.md) | 早期產品規格（歷史文件；現況以架構與決策文件為準） |
