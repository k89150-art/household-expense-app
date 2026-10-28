# 一起記：架構與帳務邏輯

本文件說明目前正式版的技術邊界與帳務規則。實際型別與程式碼是最終依據；若文件與程式不一致，請先查明差異，不要直接依文件改寫正式資料。

## 1. 畫面與元件

### 首頁

`FirestoreHomeSummary` 載入家庭資料，顯示月份摘要、個人／家庭可用金額、近期紀錄、信用卡待繳／未出帳／已繳，以及分期資訊。首頁的月份可切換，資料顯示必須跟著選定月份，不可固定使用系統當月。

### 新增

- `ExpenseQuickForm`：支出、信用卡消費與一般分期
- `IncomeForm`：收入
- `InvestmentForm`：投資
- `AdvanceForm`：代墊款
- `RecurringExpensePanel`：固定支出範本與記帳前分期

手機版透過快速新增與模式按鈕切換；桌面版可在一般支出旁同時顯示固定支出。功能相同，但版面不是單純縮放。

### 報表

`HouseholdReport` 提供月份、年度統計與關鍵字搜尋。現金流、生活支出、信用卡繳款、投資、代墊付出與代墊收回是不同概念，不可為了讓數字看似相等而混成同一類。

## 2. Firestore 結構

根文件：

```text
households/default-household
  memberIds: Firebase Auth UID[]
```

主要子集合：

| Collection | 用途 | 主要型別／欄位 |
| --- | --- | --- |
| `expenses` | 一般支出、刷卡消費、一般分期 | `date`, `amount`, `category`, `target`, `paidBy`, `paymentMethod`, `creditCard`, `installment` |
| `incomes` | 收入 | `date`, `amount`, `owner`, `category` |
| `investments` | 投資 | `date`, `amount`, `owner`, `type`, `name` |
| `advances` | 代墊 | `date`, `amount`, `owner`, `status`, `reimbursedDate`, `paymentMethod` |
| `cardPayments` | 已建立的信用卡繳款 | `card`, `owner`, `billMonth`, `paidDate`, `amount`, `legacyInstallmentAdjustments` |
| `creditCardBills` | 記帳前就存在的分期 | `kind`, `card`, `amount`, `totalInstallments`, `nextInstallmentNo`, `nextBillMonth`, `isActive` |
| `recurringExpenses` | 固定支出範本 | `name`, `category`, `amount`, `target`, `paymentMethod`, `creditCard`, `visibleFor` |
| `privateExpenseDetails` | 私人支出文字 | `expenseId`, `ownerId`, `privateNote` |
| `prepaidAccounts` / `prepaidSettlements` | 預付金與結算 | 依現有元件與型別 |

所有一般子集合文件都要帶 `householdId: "default-household"`。CRUD 集中在 `src/lib/records.ts`，不要在 UI 元件任意新增另一套 Firestore 寫入方式。

## 3. 身分與隱私

應用程式目前把已登入使用者映射為 `chris` 或 `wife`，用於付款人、收入擁有者、固定支出可見範圍與信用卡頁面篩選。這是應用角色，不等同 Firebase UID。

私人支出採雙文件：

1. `expenses` 保存家庭共同可見的日期、金額、付款人與「個人雜支」外觀。
2. `privateExpenseDetails` 保存真實文字，`ownerId` 使用 Firebase UID。
3. Firestore Rules 只允許該 UID 讀寫自己的私人明細。

任何查詢失敗都不可用放寬 Rules 成「所有登入者可讀」處理。

## 4. 信用卡帳單月份

帳單月份由 `src/lib/cardBilling.ts` 統一計算：

| 卡片 | 結帳日 | `billMonth` 規則 |
| --- | ---: | --- |
| 國泰 | 28 日 | 在同一個 `billMonth` 結帳 |
| 中信 | 7 日 | 在 `billMonth` 的下一個月 7 日結帳 |
| 玉山 | 7 日 | 在 `billMonth` 的下一個月 7 日結帳 |
| 保費卡 | 7 日 | 在 `billMonth` 的下一個月 7 日結帳 |
| 台新 | 2 日 | 在 `billMonth` 的下一個月 2 日結帳 |

例如 `2026-08` 帳單：

- 國泰：`2026-07-29` 至 `2026-08-28`
- 中信／玉山／保費卡：`2026-08-08` 至 `2026-09-07`
- 台新：`2026-08-03` 至 `2026-09-02`

元件只能呼叫 `statementRangeForCard`、`isInCardStatement`、`statementDateForCard` 等共用函式，不得各自重做月份邏輯。

## 5. 信用卡消費與繳款

刷卡消費是生活支出，新增時即計入消費月份與分類。信用卡繳款則代表銀行現金流出，存在 `cardPayments`，不能再次計入生活支出，否則會重複計算。

建立繳款前允許輸入實際帳單金額，以處理銀行帳單與系統逐筆紀錄的差額。紀錄保留系統明細金額、實際帳單金額與差額說明。中信繳款另加 10 元手續費；差額與手續費不可混為同一概念。

卡片擁有者以紀錄的 `owner`／`paidBy` 判斷。個人信用卡工作區只顯示目前登入者的卡，避免兩人的卡片、結帳日與已繳狀態混在一起。

## 6. 分期付款

### 記帳後建立的一般分期

保存在 `ExpenseRecord.installment`：

```text
total
fee
totalPayable
firstBillMonth
schedule[] = { billMonth, installmentNo, amount }
```

帳單明細依 `schedule.billMonth` 帶入。若第一期月份修正，必須重建整份 schedule 並保持總金額一致，最後一期負責吸收除法餘數。

### 記帳前分期

保存在 `creditCardBills`，以 `nextInstallmentNo` 與 `nextBillMonth` 表示下一期。建立對應帳單繳款後才會推進期數；最後一期後 `isActive` 變為 `false`。

`cardPayments.legacyInstallmentAdjustments` 是繳款當下的推進快照，用於：

- 已繳帳單仍顯示當期包含的分期明細。
- 取消繳款時恢復原期數與啟用狀態。
- 避免已繳完的最後一期從歷史帳單消失。

不要只更新分期文件而不保留／使用這份快照。

## 7. 代墊與現金流

代墊支出在原付款日造成現金流出。狀態改為「已收回」時寫入 `reimbursedDate`，收回金額依該日期歸入月份或年度現金流。

重要區分：

- `date`：原始代墊日期，供歷史紀錄與原始月份分組。
- `reimbursedDate`：實際收回日期，供現金流計算。
- 已收回不代表刪除；全部報表仍需保留該筆代墊。
- 取消已收回狀態時，要清除 `reimbursedDate`，避免現金流殘留。

共用邏輯位於 `src/lib/advanceCashFlow.ts`。

## 8. 固定支出

固定支出範本存於 Firestore，不只是前端常數。預設範本與既有雲端範本可能來自不同版本，因此更新付款方式、卡片、顯示名稱或排序時，需要檢查正規化流程是否會同步舊資料。

目前常見規則包括：

- 保險類依帳單月份使用前一個月 24 日，讓該筆進入預期信用卡帳單。
- 醫院停車月租／季繳範本使用中信信用卡。
- 訂閱費固定排序在固定支出清單後方。
- 固定支出新增成功後仍要保留清楚提示，避免使用者重複新增。

不要把「固定發生」誤解成「金額永遠不變」並自動改寫使用者輸入；系統允許本月金額與範本金額分開處理。

## 9. 排序、日期與數字

- 同日紀錄以最後建立者在最上方；依 `createdAt`／穩定次序處理，不可只按日期後造成順序隨機。
- 日期字串格式為 `YYYY-MM-DD`，月份為 `YYYY-MM`。
- 使用本地日期工具，避免 UTC 轉換讓台灣時區日期前後偏移。
- 金額使用 number 儲存；輸入欄位可以是暫時空字串，不要強制保留無法刪除的 `0`。
- 金額計算要明確區分生活支出、信用卡繳款、投資、代墊與代墊收回。

## 10. 安全規則與部署

`firebase/firestore.rules` 以父文件 `memberIds` 驗證家庭成員，並確認新舊文件的 `householdId`。私人明細另驗證 `ownerId`。

Vercel 與 Firestore 是兩個部署面：

- 推送 `main`：觸發 Vercel 網站部署。
- 修改 Firestore Rules：需另執行 Firebase 部署，例如
  `npx firebase-tools deploy --only firestore:rules`。

部署後要確認正式站，而不只確認本機。PWA 加入主畫面後可能受快取影響，若畫面仍舊，需分辨是部署失敗、Service Worker／瀏覽器快取，還是程式邏輯問題。

## 11. 建議驗證案例

信用卡或分期修改至少涵蓋：

1. 各卡結帳日前一天、結帳日、結帳日後一天。
2. 跨年月份，例如 `2026-12` 到 `2027-01`。
3. 一般消費、一般分期、記帳前分期同時出現在同張卡。
4. 建立繳款、取消繳款、重新建立繳款。
5. 實際帳單與系統金額相同、不相同，以及中信加 10 元。
6. 最後一期繳完後，歷史帳單仍保留明細。

代墊修改至少涵蓋跨月收回與取消收回。UI 修改至少檢查窄手機、一般手機與桌面寬度，並確認底部導覽沒有遮住內容。

