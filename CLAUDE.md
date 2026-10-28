# Claude 維護指引

本文件提供給 Claude Code 或其他協作代理。開始修改前，請先閱讀本文件與
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。使用者以繁體中文溝通，回報也請使用繁體中文。

## 專案定位

「一起記」是兩位家庭成員共同使用的日常記帳系統，採 iPhone 優先設計，也支援桌面版。
系統管理家庭支出、收入、投資、代墊、固定支出、信用卡帳單與記帳前分期。

技術棧：

- Next.js App Router、React、TypeScript
- Firebase Authentication、Cloud Firestore
- Vercel 部署
- 正式站：<https://household-expense-app.vercel.app/>

## 開始工作前

1. 先執行 `git status --short`，不得覆蓋使用者或其他代理尚未提交的修改。
2. 閱讀與需求直接相關的元件、`src/lib/records.ts`、`src/lib/cardBilling.ts` 與型別。
3. 對照 `docs/ARCHITECTURE.md` 的領域規則；不要用一般記帳 App 的假設取代既有規則。
4. 修改要小而集中，不做無關重構、重新命名或全檔格式化。
5. 涉及刪除資料、遷移 Firestore、放寬安全規則或改變帳務計算時，必須先取得使用者確認。

## 常用指令

```bash
npm install
npm run dev
npm run lint
npm run build
```

環境變數由 `.env.local` 提供，欄位範本在 `.env.example`。不得提交金鑰或私人設定。

## 不可破壞的帳務規則

- `target` 是消費歸屬；`paidBy` 或 `owner` 是付款／紀錄擁有者，兩者不可互換。
- 一般刷卡消費在刷卡時列入支出；信用卡繳款只影響現金流，不可再次列入生活支出。
- 使用者只在自己的信用卡工作區看到自己的卡；家庭總覽與報表仍可彙總共同資料。
- `billMonth` 是帳單歸屬月，不一定等於結帳日所在月份。所有區間必須透過
  `src/lib/cardBilling.ts` 計算，禁止在元件裡另寫日期判斷。
- 國泰 28 日結帳；中信、玉山與保費卡 7 日結帳；台新 2 日結帳。
- 中信建立繳款紀錄時另加 10 元他行扣款手續費。
- 一般分期存在 `ExpenseRecord.installment.schedule`；記帳前分期存在
  `creditCardBills`，兩者不可合併或互相覆寫。
- 建立信用卡繳款時會推進記帳前分期期數；取消繳款時必須能依快照還原。
- 代墊款在標記「已收回」時，以 `reimbursedDate` 歸入該月現金流；原始代墊紀錄仍需保留於報表。
- 個人雜支的共同紀錄與私人文字分開存放；私人文字只允許擁有者讀取。
- 固定支出範本是雲端資料。修改預設設定時，要考慮既有舊範本的正規化／遷移，不可只改新建預設值。

## 資料與安全

- 家庭文件固定為 `households/default-household`，成員 UID 存在父文件 `memberIds`。
- 一般資料放在該家庭文件的子集合；每筆都必須保留正確的 `householdId`。
- `privateExpenseDetails.ownerId` 必須是 Firebase Auth UID，不是 `chris`／`wife` 角色字串。
- Firestore Rules 位於 `firebase/firestore.rules`。除非需求明確要求，不得改為只要登入就能讀寫。
- 不得在前端加入管理員金鑰、Service Account 或繞過 Rules 的程式。

## 主要程式位置

- `src/app/page.tsx`：頁籤、快速新增、主要畫面組合
- `src/app/globals.css`：全站設計系統與響應式樣式
- `src/components/FirestoreHomeSummary.tsx`：首頁摘要、信用卡與繳款流程
- `src/components/HouseholdReport.tsx`：月份／年度報表與搜尋
- `src/components/ExpenseQuickForm.tsx`：一般支出與新刷分期
- `src/components/RecurringExpensePanel.tsx`：固定支出範本與記帳前分期
- `src/lib/records.ts`：Firestore 型別與 CRUD
- `src/lib/cardBilling.ts`：帳單區間、帳單月份與分期推進
- `src/lib/advanceCashFlow.ts`：代墊收回現金流
- `firebase/firestore.rules`：資料存取規則

## 完成條件

至少執行 `npm run lint` 與 `npm run build`。若專案內已有相關測試，也要執行並補足高風險邏輯的測試。
UI 修改需實際檢查手機與桌面寬度；信用卡、分期、代墊或報表修改需用跨結帳日／跨月份案例驗證。
推送 `main` 後由 Vercel 部署；Firestore Rules 不會因 Vercel 部署而自動更新，需另行部署並告知使用者。

## 禁止事項

- 不得清除、重建或批次改寫正式 Firestore 資料來「修好」畫面。
- 不得更改 collection 名稱、欄位用途或帳務公式，除非需求明確且已有遷移方案。
- 不得把私人明細併回共同支出文件。
- 不得用 `new Date("YYYY-MM-DD")` 做容易受時區影響的帳單月份推算；沿用既有日期工具。
- 不得提交 `_verify-latest/`、`node_modules/`、建置產物、暫存截圖或 `.env.local`。
- 不得因美化 UI 改變既有功能流程或資料邏輯。

