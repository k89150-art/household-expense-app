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

## 2026-10-30 GitHub main 同步正式 R1 Firestore Rules

- 分支：`chore/sync-r1-rules`，從本機 main `96f8e033be7076ac0a0c4652db976ea43e6d0bf7` 建立；沒有從 Phase 1 開發分支建立。
- 正式 Firebase Project ID：`household-expense-app-8102d`，資料庫 `(default)`。
- R1 已正式部署：使用者於 2026-10-29 以 Firebase CLI 15.34.2、`--only firestore:rules` 部署；來源為開發分支 `feature/phase1-income-foundation` 的 commit `1335b2ea7881d8f107e932b63118da1da7510631`，部署紀錄 commit 為 `9dfc5ab51237bb7c91d59868ad78c106a8dd0d6d`。Firebase Console 已確認生效，正式網站讀取正常。
- 本分支只把 `firebase/firestore.rules` 換成 `9dfc5ab` 的完整檔案（Git blob `5aecbbbe2e2be00075a06bb11aeaa2a081c4a5b9`），讓 GitHub main 與目前正式線上 Rules 一致。
- 同步原因：GitHub main（`9f44860`）原本的 Rules 是從未部署的 `af1282f` 版本。若之後從 main 部署 Rules，會撤銷 R1，並帶入未經授權的限制。
- 本次 Rules 差異：
  - `households/{householdId}`：成員可讀；客戶端不可 create、update、delete（R1）。
  - 移除 `existingBelongsToHousehold()` 及其在子集合 read／delete、update 的兩處引用。**這是恢復與正式線上 Rules（Git `965c4c3`）一致，不是新增未授權的權限變更**；正式環境從未使用這項限制。
  - 收入、支出、固定支出等 11 個子集合的其他條件，以及 `privateExpenseDetails` 規則，與正式線上版本逐字一致。
- 相容性依據：候選 Rules 與使用者從 Firebase Console 備份的部署前正式 Rules（SHA-256 `5412BE69EE1D4B824D59D4B5CCE0A06F8FAB813F20BE3170F121558F821C7E08`，內容等於 Git `965c4c3`）相比，只差 R1 兩行；同一份 Rules 已在開發分支通過 Firebase Emulator 37/37。
- 不在本分支：Phase 1 的收入型別、工作收入純函式、Firebase Emulator 測試環境與測試、`.gitattributes`，以及它們的 `package.json`、`pnpm-lock.yaml`、`tsconfig.json` 修改，仍保留在 `feature/phase1-income-foundation`，尚未整合到 main。
- 未修改：`src/`、`tests/`、`firebase.json`、Firestore indexes、Vercel 設定、正式 Firebase 資料。
- 狀態：同步分支尚未 push，也尚未合併到 main。依 Vercel 設定（Production Branch 為 `main`），push main 會建立新的 Production Deployment；網站程式不變，但仍需在 push 後確認正式網站正常。
- 未來 Rules 部署必須遵守 D-013（記錄於開發分支；摘要見本分支 D-014）：部署前重新從 Console 備份並比對、差異只能是當次授權的修改、只用 `--only firestore:rules`。
