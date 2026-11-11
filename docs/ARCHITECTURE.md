# 一起記：架構與帳務邏輯

本文件說明目前正式版的技術邊界與帳務規則。實際型別與程式碼是最終依據；若文件與程式不一致，請先查明差異，不要直接依文件改寫正式資料。

## 1. 畫面與元件

2026-11 UI 改版（見 D-018）後，所有裝置都使用手機單欄版面（電腦版最寬 560px），底部固定五格導覽：首頁｜紀錄｜＋（新增）｜報表｜固定。`src/app/page.tsx` 的 `HouseholdApp` 只負責頁籤切換；資料讀寫仍在各元件內。

### 首頁

`FirestoreHomeSummary view="home"`：固定顯示本月（首頁不提供月份切換）。內容為環形圖（本月剩餘＝家庭剩餘，比例＝已付出／收入）、收入／已付出／我的現金流、本月花費前三名分類、最近 3 筆紀錄（「全部」跳到紀錄頁），以及信用卡待繳／未出帳／已繳與未銷帳代墊款。

### 紀錄

`FirestoreHomeSummary view="records"`：月份切換（‹ 月份 ›、回本月、全部月份）、關鍵字搜尋、全部／支出／收入／只看我的篩選；收入與支出依日期分組。點一筆展開操作：收入「修改／刪除」（`IncomeEditForm`），支出「刪除」，房貸／增貸支出另有「還款明細」（`LoanRepaymentForm`，兩段式還款）。首頁與紀錄頁共用同一份計算，畫面整理不改變任何計算。

### 新增

- `ExpenseQuickForm`：分類 4 欄按鈕（「居家固定費」畫面顯示為「居家」）＋數字鍵盤（可用「+」連加，存成一筆合計）；付款／對象／日期三格；信用卡選卡；「分期…」展開分期與私人明細。居家細項不列「管理費」（管理費統一在固定支出記錄）。
- `IncomeForm`：收入
- `AdvanceForm`：代墊款

新增頁上方切換 支出／收入／代墊；固定支出不在新增頁，改到底部「固定」。

### 固定

`RecurringExpensePanel`（分組清單，見第 8 節）＋ chris 的 `PrepaidSettlementForm`。

### 報表

`HouseholdReport` 提供月報／年報與關鍵字搜尋。上方環形圖與「收支結構」逐列列出：收入 − 現付生活支出 − 現付代墊 − 信用卡繳款 ＋ 已收回代墊 ＝ 現金流。當期刷卡消費只顯示、不計入現金流（繳卡費時以「信用卡繳款」計入），避免重複計算。付款方式只分現金與信用卡兩類（銀行扣款、轉帳都算現金）。現金流、生活支出、信用卡繳款、代墊付出與代墊收回是不同概念，不可為了讓數字看似相等而混成同一類。

畫面上的分類短名稱由 `src/lib/categories.ts` 的 `categoryLabel()` 提供；Firestore 仍存原本的分類名稱。

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
| `investments` | 投資（已停用：介面與計算不再使用，舊資料保留） | `date`, `amount`, `owner`, `type`, `name` |
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
- 分組與順序（程式常數，不存資料庫）：貸款（房貸、房屋增貸）、居住（管理費）、通訊、保險、竣堯（學費、延托費、才藝班）、交通、其他、訂閱。
- 「本月已記錄」只在畫面判斷：讀取近期支出，以備註＝範本名稱、分類、對象、付款方式比對（與「重複新增」檢查同一套條件，不比對信用卡；兩人共用的範本不比對付款人）。不寫入任何資料。
- 繳費週期（程式常數 `CYCLE_MONTHS`）：手機門號每 2 個月、管理費每季（月份不固定）；週期內記過一筆即視為已繳。只影響畫面判斷與標示。
- 才藝班：使用者自訂名稱的範本（`才藝班：名稱`，category `才藝班`，對象竣堯，兩人可見，可刪除），記錄時歸「學費」分類；與個人訂閱一樣存在 `recurringExpenses`，資料結構不變。

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

