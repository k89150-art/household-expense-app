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

## 2026-10-29 Phase 1 階段 2：工作收入純函式

- 基準：`9383ca5d33b8431d5fa5d583436bff9d7fcefe19`
- 新增 `src/lib/workIncome.ts`，只提供無 I/O 的工作收入資料驗證、分類與最小欄位投影。
- 正式預設 policy 同等接受 `chris`、`wife`；封存中的 Chris-only 規則保留為名稱明確、未啟用的 opt-in 候選 policy。
- 工作收入包含本薪、獎勵金、加班費、值班費、衛福部津貼、年終及年終獎金；前五項標記為經常性收入。
- 輸出金額維持 `number`，沒有整合 API decimal string、月份 response validator、Firebase query 或任何 UI／報表呼叫。
- `tsconfig.json` 啟用 `allowImportingTsExtensions`，讓 Node 單元測試可直接載入共用 TypeScript 模組；專案仍維持 `noEmit`。

驗證結果：

- 原有測試 19/19 通過，新增工作收入測試 10/10 通過，全部共 29/29 通過。
- ESLint、TypeScript typecheck、Next.js production build 與 `git diff --check` 均通過。
- 未修改或連線 Firebase、Firestore、Authentication、Vercel 或正式資料。

尚待產品確認：工作收入未來對外整合是否只限 Chris、是否需要兩人分開摘要，以及所有收入的幣別語意。確認前不得讓正式收入畫面、統計或 API 依賴候選 policy。

## 2026-10-29 Phase 1 階段 3：Firebase Emulator 本機測試環境

- 專用 project ID：`demo-household-expense`。
- Authentication Emulator：`127.0.0.1:9099`。
- Firestore Emulator：`127.0.0.1:8080`。
- `firebase.json` 只新增上述 loopback Emulator 設定並停用 Emulator UI；正式 Rules、indexes、Firebase 初始化與登入流程均未修改。
- 測試程式在初始化 Firebase SDK 或清除／寫入資料前，會驗證 `demo-*` project ID、loopback host 與固定 port；設定不符時直接停止，不會 fallback 到正式 Firebase。
- Seed 建立三個虛構 Auth 使用者、`households/default-household`、兩個 `memberIds`，以及一筆收入、支出、固定支出範本；第三個使用者刻意不在家庭成員清單中。
- Seed 每次先透過 Emulator 專用 REST endpoint 清除 demo project 的 Auth／Firestore 資料，因此可重複執行；不讀取 `.env.local`、Service Account 或正式憑證。

需要 Java 21。若 Java 未在 PATH，可在 PowerShell 暫時指定本機 JDK：

```powershell
$env:JAVA_HOME = Join-Path $env:LOCALAPPDATA 'Programs\OpenJDK\temurin-21'
$env:PATH = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:PATH
```

自動啟動 Emulator、執行整合測試並關閉：

```powershell
.\node_modules\.bin\firebase.cmd emulators:exec --project demo-household-expense --only auth,firestore "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test --test-concurrency=1 tests/emulator/*.test.mjs"
```

手動檢查 Seed 時，先在一個終端啟動 Emulator：

```powershell
.\node_modules\.bin\firebase.cmd emulators:start --project demo-household-expense --only auth,firestore
```

再於另一個終端執行：

```powershell
node scripts/seed-firebase-emulator.mjs
```

本階段真實 Emulator 測試 16/16 通過，涵蓋設定檔 loopback 驗證、Auth 使用者、可重複 Seed、未登入拒絕、家庭成員讀寫、非成員拒絕、`householdId` 驗證、收入／支出／固定支出 CRUD 與集合查詢。這不是 mock 測試。

完整驗證結果：原有測試 29/29 通過；真實 Emulator 測試 16/16 通過；ESLint、TypeScript typecheck、Next.js production build 與 `git diff --check` 均通過。

現有 Rules 的已知限制：

- 子集合只驗證成員資格與 `householdId`，沒有驗證金額型別、分類或必要欄位；合法成員可寫入 schema 錯誤但 `householdId` 正確的文件。本階段以測試如實記錄，未修改 Rules。
- 已刪除或不存在的子文件在讀取時，`existingBelongsToHousehold` 會因 `resource.data` 不存在而回傳 permission-denied，而不是可讀取的 not-found。（更正：只適用於未部署的 Git `af1282f` 版本；正式線上 Rules 會回傳 not-found，見 D-012。）
- Firebase CLI 無法取得 MOTD／remote config 時會顯示非致命網路警告，不影響本機 Emulator 測試。

本階段沒有連線正式 Firebase、修改正式資料、執行 deploy、commit 或 push。

## 2026-10-29 Phase 1 階段 3：最終驗收（Claude 接手）

- Codex 額度用盡，由 Claude 暫時接手本階段的最終審查。
- 驗證是使用者在本機 PowerShell 實際執行的：原有測試 29/29 通過、真實 Firebase Emulator 測試 16/16 通過（`demo-household-expense`、Auth `127.0.0.1:9099`、Firestore `127.0.0.1:8080`）、ESLint、TypeScript、Next.js production build 均通過，`git diff --check` exit code 0；Firebase CLI 已完成 Emulator 關閉程序。Claude 這個工作階段沒有本機終端機權限，未親自執行任何測試或 Git 指令。
- Claude 唯讀審查（對照 GitHub `main` 基準 `9f448609`）：
  - `package.json` 只新增 devDependencies `firebase-tools@15.34.2`、`@firebase/rules-unit-testing@5.0.2`，以及 `emulator:seed`、`test:emulator` 兩個 scripts；dependencies 沒有變更。
  - `pnpm-lock.yaml` 的 importer specifier 與 `package.json` 一致；基準原有的 474 個套件版本全部保留，沒有移除或升級，只新增上述兩個套件的相依套件（部分以並存的不同版本加入）。`next`、`eslint` 等既有 importer 只有 peer 標記（`supports-color`、`@opentelemetry/api`）改變，解析版本不變。
  - `src/`、`firebase/firestore.rules`、`firebase/firestore.indexes.json`、`public/` 在階段 2 commit 之後沒有修改；正式 Firebase 初始化與登入流程未變。
  - Seed 與測試只使用虛構帳號與資料，未讀取 `.env*`，未包含正式金鑰、Token 或 Service Account。
- 提交範圍：只提交階段 3 的九個指定檔案；commit 由使用者在 PowerShell 執行，hash 以 `git log -1` 為準。沒有 push、合併 main 或部署。

下一位 AI 接手注意：

- 階段 3 新增或修改的檔案在工作樹中使用 CRLF 換行，既有檔案為 LF；`.git/config` 沒有設定 `core.autocrlf`，提交前請用 `git diff --cached --stat` 確認沒有出現整檔換行差異。
- Phase 1 階段 4 尚未開始，必須等使用者另行授權。
- Rules 不驗證子集合 schema 的已知限制維持不變（見 D-009），需另案評估。

## 2026-10-29 Phase 1 階段 4：Firestore Rules R1（家庭文件鎖定）

- 基準：`13111a0dddebab9b2dfd6d15c7d8801d117c75ea`；分支 `feature/phase1-income-foundation`。
- 修正 H1（成員可任意修改／刪除家庭文件、可透過 `memberIds` 擴大權限）與 M1（任何登入者可建立新家庭）。
- `firebase/firestore.rules`：`households/{householdId}` 只保留成員讀取；`create`、`update`、`delete` 一律為 `false`。子集合與 `privateExpenseDetails` 規則未變更。
- 已確認正式程式沒有建立、修改 `memberIds` 或刪除家庭文件的流程；家庭成員日後只能透過 Firebase Console 等受控管理流程調整，本階段未新增管理功能。
- `scripts/seed-firebase-emulator.mjs`：家庭文件改由 Emulator 專用的 `Authorization: Bearer owner` REST 通道寫入（先經 `assertSafeEmulatorTarget()` 檢查 demo project 與 loopback），其餘收入、支出、固定支出測試資料仍以成員客戶端身分寫入並經過 Rules；未為 Seed 放寬 Rules。
- 新增 `tests/emulator/household-rules.test.mjs`（15 項）：未登入者／非成員不可讀、兩位成員可讀、不可新增或移除 `memberIds`、不可修改其他欄位或刪除家庭文件、非成員與成員皆不可從客戶端建立新家庭、收入與支出 CRUD 及查詢相容、既有固定支出模板可讀、私人支出 batch 寫入與本人限定存取不變。

驗證結果（Claude 在雲端副本實際執行，非使用者本機）：

- 依 `pnpm-lock.yaml` 安裝相同版本依賴，使用 Java 21 與使用者本機的 `cloud-firestore-emulator-v1.22.0.jar`。
- 原有單元測試 29/29 通過。
- 真實 Firebase Emulator 測試 31/31 通過（原有 16 項＋R1 新增 15 項）。
- 反向驗證：把 Rules 換回 `13111a0` 版本時，R1 測試 20–26 失敗；27–31 也連帶失敗，因為舊 Rules 讓前面的測試真的刪除／覆寫了家庭文件，證明測試能偵測 H1／M1。
- ESLint、TypeScript `--noEmit`、Next.js production build 均通過。
- 使用者本機驗證：待執行。（後續：`cc3e54e` 版 Rules 未部署，改由下一節正式相容版部署。）

尚未解決的 Rules 問題：

- M2：子集合仍未驗證欄位白名單、必填欄位、`amount` 型別與範圍、分類與 `owner` 合法值（R3／R4 處理）。
- L1–L5：`createdBy` 可偽造、時間戳記未驗證、成員可修改彼此紀錄、被移出成員仍可存取本人私人明細、無欄位白名單。
- 已知相容性問題（本階段只記錄、未修復）：讀取不存在的子集合文件會被拒絕，`upsertRecurringExpenseTemplate()` 新增模板前的 `getDoc` 會失敗並退回本機模板；已以測試 30 記錄目前行為，留待 R2 決定。（更正：此問題只存在於未部署的 Git `af1282f` 版本，正式環境沒有；`cc3e54e` 的 Rules 檔不可直接部署，見下一節與 D-012。）

部署狀態：R1 只在本機 Emulator 驗證，**尚未部署到正式 Firebase**；正式 Rules 仍為舊版。部署需使用者另行授權，並先保存目前正式 Rules 作為回滾版本。（後續：正式相容版已於 2026-10-29 部署，見「R1 正式部署紀錄」與「R1 最終上線與 GitHub 同步完成」。）

更正：上一節「階段 3 新增或修改的檔案在工作樹中使用 CRLF」不完全正確；新增的 `scripts/`、`tests/emulator/` 檔案為 LF，換行規則現以 `.gitattributes`（D-010）為準。

## 2026-10-29 Phase 1 階段 4：R1 正式相容版

- 基準：`cc3e54ebc74bfe16cac1fd2473d6766d7750232e`；分支 `feature/phase1-income-foundation`。
- 背景：使用者從 Firebase Console 備份的正式 Rules（`家庭記帳-Rules備份\firestore.rules.prod-20261029.rules.txt`）與 Git `965c4c3` 完全一致，與 repo 的 `af1282f` 版本不同（正式版沒有 `existingBelongsToHousehold()`）。`cc3e54e` 的 Rules 檔若直接部署，會同時帶入未授權的 `af1282f` 限制，因此不可部署。
- `firebase/firestore.rules`：改為「正式備份＋R1」。與正式備份的差異只有 `households/{householdId}` 兩行：`allow read` 保留成員條件，`allow create, update, delete: if false`。其餘條件逐字一致，不導入 `existingBelongsToHousehold()`。
- 測試調整（改為反映正式行為）：
  - `firebase-emulator.test.mjs` 收入 CRUD：刪除後讀取改為「成功且 not-found」。
  - `household-rules.test.mjs` 第 30 項：改為「成員可讀取不存在的固定支出模板（not-found）、非成員不可」。
  - 新增 `tests/emulator/production-compat.test.mjs`（6 項）：完整模擬 `upsertRecurringExpenseTemplate()` 的新增／另一成員重存／列表／刪除流程，非成員不可執行；缺少 `householdId` 的舊資料可由成員讀取、刪除，修改時須帶入 `householdId`，非成員不可存取，且 App 列表查詢本來就不會列出；讀取不存在的收入／支出對成員回傳 not-found、對非成員與未登入拒絕。
- Seed 與 R1 家庭文件權限測試維持不變。

驗證結果（Claude 在雲端隔離副本實際執行，非使用者本機）：

- 正式備份與候選 Rules 的差異（忽略換行）只有上述 R1 兩行。
- 原有單元測試 29/29 通過。
- 真實 Firebase Emulator 測試 37/37 通過（原有 16＋R1 15＋正式相容 6），Emulator 正常關閉。
- 反向驗證：以 `cc3e54e` 的 Git 版 Rules 執行時，第 13、30、32、34–37 項失敗，證明測試能分辨 `af1282f` 與正式行為；以正式備份原樣執行時，正式相容測試 32–37 全部通過，R1 測試 20–26 失敗（27–31 因家庭文件已被前面的測試真的刪除或覆寫而連帶失敗），證明 H1／M1 在線上仍存在。
- ESLint、TypeScript `--noEmit`、Next.js production build、`git diff --check` 均通過。
- 使用者本機驗證：待執行。（後續：使用者於部署前在本機執行，單元測試 29/29、Emulator 37/37 通過，見「R1 正式部署紀錄」。）

部署狀態：尚未部署。部署前須重新從 Console 備份線上 Rules、確認與 repo 差異只有 R1，並取得使用者授權；只使用 `--only firestore:rules`。（後續：已於 2026-10-29 部署。）

## 2026-10-29 Phase 1 階段 4：R1 正式部署紀錄

以下事實由使用者實際操作並回報；Claude 沒有正式 Firebase 的存取權限，未親自執行部署或線上檢查。

部署內容與方式：

- 部署來源：分支 `feature/phase1-income-foundation`，commit `1335b2ea7881d8f107e932b63118da1da7510631`（`fix: align R1 rules with production baseline`）的 `firebase/firestore.rules`。
- Firebase 專案：`household-expense-app-8102d`；Firestore 資料庫：`(default)`。
- Firebase CLI：15.34.2；指令只使用 `--only firestore:rules`，CLI 顯示 Deploy complete。
- 部署內容：正式 Rules（Git `965c4c3`）加上 R1。差異只有 `households/{householdId}`：成員可讀，客戶端不可 create／update／delete。未導入 `existingBelongsToHousehold()`。
- 部署前回滾備份：`%USERPROFILE%\OneDrive\文件\家庭記帳-Rules備份\firestore.rules.prod-20261029.rules.txt`，SHA-256 `5412BE69EE1D4B824D59D4B5CCE0A06F8FAB813F20BE3170F121558F821C7E08`（Claude 已重新計算並確認一致）；內容與 Git `965c4c3` 相同。
- 部署前本機驗證（使用者執行）：單元測試 29/29、Firebase Emulator 測試 37/37 通過。

部署後狀態：

- 已完成正式部署：Firebase Console 已確認新版 Rules 生效。
- 已確認正式網站讀取正常：正式網站可以正常讀取記帳資料。
- 未重新部署 Vercel；未執行資料 migration；未修改正式記帳紀錄、`memberIds` 或家庭文件。
- H1（成員可改寫／刪除家庭文件、擴大 `memberIds`）與 M1（任何登入者可建立新家庭）在正式環境已由 R1 封鎖。

尚未完成：

- 尚未執行正式環境完整 CRUD 驗收：收入、支出、私人支出、固定支出模板、代墊、刷卡繳款的新增、修改、刪除，目前只確認讀取正常；兩位成員各自登入的驗收也尚未記錄。
- 尚未在 Console 規則模擬器記錄 R1 驗證結果（成員 get 允許；update／delete 拒絕；非成員 get、create 拒絕）。
- 尚未確認正式 `households` 集合是否只有 `default-household`（M1 修補前是否已被利用）。
- 正式站部署產物實際使用的 Project ID 尚未以產物檢查驗證；目前依程式預設值與 Vercel 無環境變數推定為 `household-expense-app-8102d`。
- R3（新建立資料的欄位驗證）、R4（修改時的欄位驗證）尚未開始；M2、L1–L5 仍未處理。
- `af1282f` 的 `existingBelongsToHousehold()` 限制是否採用，尚待另案評估（見 D-012）。
- Firebase 正式／開發環境隔離尚未完成：`src/lib/firebase.ts` 仍以正式設定為預設值，App 無法連接 Emulator；歷史封存的 Phase 1 環境隔離方案未整合。

下一位 AI 接手注意：

- 正式線上 Rules 現在等於 repo `1335b2e` 的 `firebase/firestore.rules`。GitHub main（`9f44860`）的 Rules 仍是未部署的 `af1282f` 版本，**不可從 main 部署 Rules**，否則會撤銷 R1 並帶入未授權限制。（2026-10-30 後續：GitHub main 已同步至 `3db867a`，其 Rules 與正式 R1 一致，此風險已解除；部署 Rules 仍須遵守 D-013。）
- 回滾方式：在 Console 規則歷史選回 R1 前版本，或發布上述備份檔內容；回滾前先確認備份 SHA-256。
- 每次部署 Rules 前，都要重新從 Console 備份線上版本，確認與 repo 的差異只有本次授權的修改，且只用 `--only firestore:rules`。
- 本分支尚未 push，也尚未合併 main。（2026-10-30 後續：本分支仍未 push、未合併；只有 R1 Rules 另以 `chore/sync-r1-rules` 同步到 main。）

## 2026-10-30 GitHub main 同步正式 R1 Firestore Rules

（本節為 main 分支 `3db867a` 的原文，原樣併入本分支以保持兩邊紀錄一致；只在「狀態」一行補充後續說明。）

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
- 狀態：同步分支尚未 push，也尚未合併到 main。（2026-10-30 後續：已 fast-forward 合併到本機 main 並 push；GitHub main 為 `3db867a`，Vercel Production 已部署成功。）依 Vercel 設定（Production Branch 為 `main`），push main 會建立新的 Production Deployment；網站程式不變，但仍需在 push 後確認正式網站正常。
- 未來 Rules 部署必須遵守 D-013（記錄於開發分支；摘要見本分支 D-014）：部署前重新從 Console 備份並比對、差異只能是當次授權的修改、只用 `--only firestore:rules`。

## 2026-10-30 R1 最終上線與 GitHub 同步完成

以下為使用者實際操作並確認的結果；Claude 沒有正式 Firebase、Vercel 或 GitHub 寫入權限，只做唯讀審查與準備指令。

- R1 正式 Firebase 部署成功：專案 `household-expense-app-8102d`、資料庫 `(default)`，2026-10-29 以 `--only firestore:rules` 部署開發分支 `1335b2e` 的 Rules；Firebase Console 已確認生效。
- GitHub main 已同步至 `3db867a275eb134fadaf33ee4c00ddec4d4db0bd`：由 `chore/sync-r1-rules` fast-forward 合併到本機 main 後 push，只推送 `96f8e03` 與 `3db867a` 兩個 commit，沒有使用 force。
- Vercel Production Deployment 成功：Branch `main`、Commit `3db867a`、狀態 Ready。
- 使用者已確認正式網站正常。
- 本次 GitHub 同步沒有把 Phase 1 程式碼併入 main：main 只多了 `AGENTS.md`、交接文件與 `firebase/firestore.rules`；`src/`、`package.json`、`pnpm-lock.yaml`、`tsconfig.json`、Emulator 測試與 `.gitattributes` 仍只在 `feature/phase1-income-foundation`。
- R1 Rules 與 GitHub main 版本一致：main、開發分支 `9dfc5ab`、部署來源 `1335b2e` 的 `firebase/firestore.rules` 是同一個 Git blob `5aecbbbe2e2be00075a06bb11aeaa2a081c4a5b9`。

各分支狀態（2026-10-30）：

- GitHub main／本機 main：`3db867a`。
- `chore/sync-r1-rules`：`3db867a`（已合併，保留作為紀錄）。
- `feature/phase1-income-foundation`：`9dfc5ab`（未 push、未合併；本節文件提交後會前進）。

尚未完成：

- 正式環境完整 CRUD 權限驗收尚未完成（目前只確認讀取正常）：收入、支出、私人支出、固定支出模板、代墊、刷卡繳款的新增、修改、刪除，兩位成員各自驗收，以及 Console 規則模擬器紀錄。
- Firebase 開發／正式環境隔離尚未開始：`src/lib/firebase.ts` 仍以正式設定為預設值，App 無法連接 Emulator。
- R3（新建立資料的欄位驗證）、R4（修改時的欄位驗證）尚未開始；M2、L1–L5 仍未處理；`af1282f` 的 `existingBelongsToHousehold()` 是否採用仍待另案評估。
- main 上的交接文件仍保留「同步分支尚未 push」的舊敘述；之後整合 main 與開發分支的文件時一併更新（見 D-015）。

下一位 AI 接手注意：

- 未來部署 Rules 仍須遵守 D-013：部署前重新從 Console 備份並比對、差異只能是當次授權的修改、只用 `--only firestore:rules`。
- main 與開發分支的交接文件都是在共同祖先 `96f8e03` 的檔案結尾各自追加，日後合併必定在文件結尾衝突；本分支已原樣併入 main 的 2026-10-30 同步紀錄與 D-014，解衝突時以本分支版本為準，不會遺失 main 的紀錄。

## 2026-11-05 Portfolio Steward 同步第一階段（本機分支，未部署）

- 分支：`feature/household-sync-phase1`（從 main `7c7e36a` 建立）；只在本機與 Emulator 驗證，**未部署 Rules、未 push、未部署網站**。
- 收入原地修改：`src/lib/incomeEdit.ts`（純函式驗證，只寫有變更的欄位）、`updateIncomeRecord`（`updateDoc`，保留文件 ID、owner、householdId、createdBy；清除備註用 `deleteField`）、收入列表「修改」按鈕與 `IncomeEditForm`。
- 外部唯讀整合身分：Rules 新增 `isDedicatedReader`／`isIntegrationReader`。家庭文件的 `integrationReaderIds` 名單中的 UID（且不是成員）只能讀家庭文件與 `incomes`（get／list），沒有任何寫入或其他集合權限。名單只能由 Console／Admin 寫入（客戶端不可寫家庭文件，R1 不變）。成員與其他集合的既有規則完全未改。
- Emulator：seed 新增虛構 `integration.reader@example.test` 與 `integrationReaderIds`；新增 `tests/emulator/integration-reader.test.mjs`（9 項）與 `tests/incomeEdit.test.mjs`（5 項）。
- 正式上線前需要另行授權：建立正式整合帳號、在 Console 把它的 UID 寫入 `integrationReaderIds`、依 D-013 部署 Rules。

## 2026-11-05 Portfolio Steward 同步第二階段：房貸／增貸還款明細（本機分支，未部署）

- 分支：`feature/household-sync-phase2`（接在第一階段之後）；只在本機與 Emulator 驗證，**未部署 Rules、未 push、未部署網站**。
- 資料：`households/{householdId}/loanRepayments/{expenseId}`，文件 ID 等於原支出 ID（一筆支出最多一筆明細，不新增支出）。欄位：`householdId`、`expenseId`、`loanKey`（`ORIGINAL_MORTGAGE`／`TOP_UP_LOAN`）、`dueDate`、`paidDate`、`totalAmount`、`principal`、`interest`、`fee`（新台幣整數，本金＋利息＋手續費＝總額＝支出金額）、`confirmation`、`status`（`ACTIVE`／`VOID`）、`createdBy`、`createdAt`、`updatedAt`。型別在 `src/types/loanRepayment.ts`，純驗證在 `src/lib/loanRepayment.ts`（不推算本金或利息）。
- 畫面：支出列表中備註含「房貸」或「增貸」的支出（或已有明細的支出）出現「還款明細」按鈕，可補登、轉換舊支出、修改、作廢、還原（`LoanRepaymentForm`）。私人支出不顯示。讀不到明細（例如 Rules 尚未部署）時只隱藏按鈕，其他功能不受影響。
- 刪除支出：`deleteExpenseRecord` 在同一批次一併刪除明細。
- Rules：成員可建立／修改明細（欄位、整數、相加、日期格式、`updatedAt == request.time`、`createdBy` 不可改；ACTIVE 時總額必須等於支出金額）；明細不能單獨刪除，只能和支出同批刪除；支出不能單獨刪除而留下明細，也不能把金額改成與有效明細不一致。整合身分可讀 `loanRepayments`（get／list），不能寫。其他集合的規則未改。
- 測試：`tests/loanRepayment.test.mjs`（5 項）、`tests/emulator/loan-repayment-rules.test.mjs`（7 項）。
- 正式上線前需要另行授權：依 D-013 部署 Rules；Portfolio Steward 端 Migration 0038 的套用與正式同步另案核准。
