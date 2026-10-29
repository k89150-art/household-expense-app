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
- 已刪除或不存在的子文件在讀取時，`existingBelongsToHousehold` 會因 `resource.data` 不存在而回傳 permission-denied，而不是可讀取的 not-found。
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
