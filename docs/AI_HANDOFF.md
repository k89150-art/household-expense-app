# AI 交接紀錄

## 2026-10-28 工作目錄遷移

### 正式工作區

- 路徑：`%USERPROFILE%\OneDrive\文件\家庭記帳`
- 遠端：`https://github.com/k89150-art/household-expense-app.git`
- 分支：`main`
- 建立基準：`9f448609f786ce0d14f6bcf65b67368590005772`
- 基準來源：已透過 GitHub 遠端 `main` 驗證後重新 clone，沒有混入舊工作樹。

### 歷史封存

封存位於：

`%USERPROFILE%\OneDrive\文件\家庭記帳-歷史開發封存`

三份舊來源各自保存 Git bundle、未提交 patch、排除依賴／建置產物的原始碼快照、來源資訊與 SHA-256 清單。部分舊工作樹後來已不存在，因此不得再把舊路徑視為必要依賴或正式來源；需要取回歷史成果時，應以通過 SHA-256 與 Git bundle 驗證的歷史封存為準，且不得自動還原或合併。

### 尚未整合

`C-2026-07-01-phase1` 包含工作收入契約、收入型別、純函式驗證、Firebase 環境隔離、Emulator 初始化與測試。這些成果刻意沒有合併到正式 `main`，原因是它改變 Firebase 啟動與部署條件，必須另案確認測試／正式環境策略。

B 工作樹的「值班費、衛福部津貼、年終獎金」已存在正式版，不需要從舊 patch 再套用。

### 資料儲存

- 正式登入：Firebase Authentication。
- 正式記帳資料：Cloud Firestore，Firebase project ID 為既有正式設定。
- 未發現 Realtime Database 使用。
- 未發現正式記帳資料存放於專案資料夾。
- 固定支出元件使用 localStorage 作本機快取／雲端失敗備援，正常登入後會與 Firestore 範本同步。
- 未被正式頁面引用的 `HomeSummary` 含舊示範 localStorage 投資資料，不是正式首頁資料來源。

搬移程式資料夾不會搬移或刪除 Firebase 資料。正式網站網域的瀏覽器資料也不受本機路徑影響；本機開發若改用不同 port，localStorage 會因 origin 不同而分開。

### 協作狀態

`AGENTS.md`、本文件與 `docs/PROJECT_DECISIONS.md` 是共同維護規則與交接來源。開始下一項工作前請先檢查 Git 狀態，確認所在分支與授權範圍，並在完成後更新本文件。

### 遷移驗證結果

- `pnpm test`：16/16 通過。
- ESLint：通過（直接執行 `node_modules/.bin/eslint.cmd .`）。
- TypeScript：通過（直接執行 `node_modules/.bin/tsc.cmd --noEmit`）。
- Next.js production build：通過。
- Development server：在 port 3210 啟動成功，首頁 HTTP 200 且包含「一起記」，驗證後已關閉。
- Git tracked files：與遠端基準一致，沒有程式碼或 Firebase 設定修改。

### OneDrive／pnpm 注意事項

pnpm 12 的預設 isolated linker 在此 OneDrive 路徑曾發生 stack overflow；改用下列方式可完成安裝，並避免建立大量套件 junction：

```bash
pnpm install --frozen-lockfile --node-linker=hoisted --package-import-method=copy --ignore-scripts
```

pnpm 12 會因供應鏈政策阻止 `@firebase/util`、`protobufjs`、`sharp`、`unrs-resolver` 的安裝 scripts；本次沒有擅自修改允許清單。即使忽略 scripts，現有 test、lint、typecheck、build 與 dev server 均已通過。若未來確定需要這些 postinstall scripts，應另案審查後再設定 `onlyBuiltDependencies`。

目前的 hoisted＋copy `node_modules` 沒有發現 reparse point，但約佔數百 MiB，OneDrive 仍會同步大量可重建檔案。建議後續固定使用同一安裝方式，且不要把 `node_modules` 或 `.next` 納入歷史封存。

## 2026-10-29 Phase 1 階段 1：收入型別集中化

- 分支：`feature/phase1-income-foundation`
- 基準：`96f8e033be7076ac0a0c4652db976ea43e6d0bf7`
- 新增 `src/types/income.ts` 作為收入擁有者、分類與 Firestore 收入紀錄的唯一權威型別。
- `records.ts` 保留既有轉匯出介面與所有 CRUD 實作；`IncomeForm` 保留原有欄位、選項順序與操作流程。
- `domain.ts` 原本未使用且欄位不符正式資料的 `Income`，改為權威 `IncomeRecord` 的相容別名。
- 未修改 Firebase 初始化、Authentication、Firestore Rules、project ID、資料結構、計算邏輯或 UI。

驗證結果：

- 原有測試 16/16 通過。
- 新增收入 runtime 測試 3/3 通過；全部共 19/19 通過。
- 收入 owner、分類、欄位與 `amount: number` 的 compile-time 契約通過。
- ESLint、TypeScript typecheck、Next.js production build、`git diff --check` 均通過。
- 本階段未執行端到端 Firestore 測試，也未連線或操作正式記帳資料。
