# 專案決策紀錄

## D-001 正式開發工作區

- 日期：2026-10-28
- 決策：正式本機工作區改為 `%USERPROFILE%\OneDrive\文件\家庭記帳`，GitHub remote 為 `https://github.com/k89150-art/household-expense-app.git`。
- 原因：集中成果並讓後續 Codex／Claude 使用同一個已驗證基準。
- 限制：歷史封存不得在未確認前刪除；殘留的舊工作樹不是正式來源，也不得成為建置或執行依賴。

## D-002 正式版本基準

- 日期：2026-10-28
- 決策：以 GitHub `main` 的 `9f448609f786ce0d14f6bcf65b67368590005772` 為遷移基準。
- 原因：三份舊工作樹的 HEAD 都是該 commit 的祖先；舊工作樹的未提交成果另行封存，不自動混合。

## D-003 Phase 1 暫不整合

- 日期：2026-10-28
- 決策：工作收入契約與 Firebase 環境隔離 Phase 1 只封存，不合併正式版。
- 原因：它會移除正式 Firebase fallback、要求 Emulator／環境標記並改變 build/start 前置條件，需要獨立審查與測試環境決策。

## D-004 AI 協作控制

- 日期：2026-10-28
- 決策：同一時間只允許一個 AI 修改工作樹；所有代理修改前檢查 Git 狀態，未經明確授權不得 commit、push、deploy 或改動 Firebase／正式資料。
- 交接：每次任務完成更新 `docs/AI_HANDOFF.md`；長期決策更新本文件。

## D-005 OneDrive 依賴安裝方式

- 日期：2026-10-28
- 決策：新工作區在目前環境使用 pnpm hoisted＋copy 佈局，安裝時忽略未核准的第三方安裝 scripts。
- 指令：`pnpm install --frozen-lockfile --node-linker=hoisted --package-import-method=copy --ignore-scripts`
- 原因：預設 isolated linker 在 OneDrive 路徑發生 stack overflow；hoisted＋copy 已完成 test、lint、typecheck、build 與 dev server 驗證，且未產生 reparse point。
- 後續：不得為了消除 pnpm 警告而未經審查開放套件 build scripts。

## D-006 歷史成果的復原來源

- 日期：2026-10-29
- 決策：歷史成果以 `%USERPROFILE%\OneDrive\文件\家庭記帳-歷史開發封存` 中通過 SHA-256 驗證的 snapshot、patch 與 Git bundle 為復原來源。
- 原因：部分舊工作樹已不存在，但正式工作區與 A／B／C 封存均已完成完整性驗證。
- 限制：不得把歷史封存當成正式工作區直接修改，也不得未經另案審查自動還原、合併 Phase 1 或改動 Firebase。

## D-007 收入權威型別

- 日期：2026-10-29
- 決策：收入擁有者、收入分類與收入紀錄欄位以 `src/types/income.ts` 為唯一權威型別；`records.ts` 只負責轉匯出與 Firestore CRUD。
- 相容性：保留正式 Firestore 的 `owner`、`amount: number`、既有分類與其餘文件欄位；`年終` 僅供讀取既有資料，新表單仍使用 `年終獎金`。
- 限制：本決策不包含工作收入篩選、API 契約、Firebase 環境隔離或資料遷移。

## D-008 工作收入純函式邊界

- 日期：2026-10-29
- 決策：工作收入篩選只能存在於無 I/O 的獨立純函式；預設 policy 對 `chris` 與 `wife` 一致，不能將未確認的 Chris-only 規則接到正式功能。
- 隱私：合法輸出只投影日期、數字金額、工作收入分類與經常性標記，不回傳 note、createdBy、Firebase UID、家庭 ID 或其他原始欄位。
- 相容性：正式 Firestore 仍保存 `amount: number`；API 專用 decimal string 與 response validator 不在本階段整合。
- 限制：純函式目前沒有 UI、報表、Firestore query 或 API route 呼叫者，候選 Chris-only policy 必須由後續產品決策另案啟用。

## D-009 Firebase Emulator 安全邊界

- 日期：2026-10-29
- 決策：Firebase 本機整合測試固定使用 `demo-household-expense`，Authentication 與 Firestore 只綁定 `127.0.0.1:9099`、`127.0.0.1:8080`。
- 防護：測試及 Seed 在 SDK 初始化或資料操作前驗證 demo project、loopback host 與固定 port；不符合即停止，禁止 fallback 到正式 Firebase。
- 資料：Seed 僅使用虛構帳號與資料，UID 由 Authentication Emulator 產生並同步寫入 `households/default-household.memberIds`。
- Rules：本機測試載入現有 `firebase/firestore.rules`；不得為了測試通過而放寬或修改正式 Rules。
- 限制：目前 Rules 不驗證子集合 schema，只保護登入、家庭成員與 `householdId`；是否補強欄位驗證需另案評估，本階段不處理。
- 更正（2026-10-29，見 D-012）：當時 repo 的 `firebase/firestore.rules` 是未部署的 `af1282f` 版本，與正式線上 Rules（`965c4c3`）不同；Emulator 測試結果只代表 Git 版行為。之後 Emulator 一律載入與正式版相容的 Rules。

## D-010 Git 換行格式規則

- 日期：2026-10-29
- 決策：專案統一使用 LF 換行；`.cmd`、`.bat`、`.ps1` 等 Windows 腳本保留 CRLF；圖片、字型、PDF、壓縮檔等明確標記為 binary，不做換行轉換。
- 規則來源：以 repo 根目錄的 `.gitattributes` 為共同換行規則，優先於個別電腦的 `core.autocrlf` 設定。Codex 與 Claude 都必須遵守，不得在檔案內另行改變換行格式。
- 既有檔案：導入時不立即正規化。目前 `src/app/globals.css`、`src/components/FirestoreHomeSummary.tsx`、`src/components/IncomeForm.tsx`、`src/components/RecurringExpensePanel.tsx`、`src/lib/records.ts` 在 repo 中為 CRLF／LF 混用，暫時維持原狀。
- 限制：未來執行 `git add --renormalize` 時，必須取得使用者授權並獨立提交，並以 `git diff --cached --ignore-cr-at-eol` 確認只有換行差異；不得把換行正規化混入任何功能修改。

## D-011 家庭文件不開放客戶端寫入

- 日期：2026-10-29
- 決策：`households/{householdId}` 只允許家庭成員讀取；所有客戶端皆不得建立、修改或刪除家庭文件，`memberIds` 不得由 App 變更。
- 原因：原規則允許成員任意改寫 `memberIds` 或刪除家庭文件（可擴大權限或鎖死全家資料），且任何登入者都能建立新家庭；正式程式沒有任何寫入家庭文件的流程。
- 管理：成員調整只能透過 Firebase Console 等受控管理流程；Emulator 測試以 Emulator 專用的 owner 通道建立家庭文件，不得為測試放寬 Rules。
- 限制：R1 不包含子集合欄位驗證（R3／R4）與固定支出模板讀取問題（R2）；正式部署需另行授權。
- 更正（2026-10-29，見 D-012）：「固定支出模板讀取問題」只存在於未部署的 Git `af1282f` 版本；正式線上 Rules 允許成員讀取不存在的子文件，新增模板流程在正式環境正常，R2 不需處理此項。R1 改以正式 Rules 為基準，只修改家庭文件權限。

## D-012 Firestore Rules 以正式線上版本為相容基準

- 日期：2026-10-29
- 事實：使用者自 Firebase Console 備份的正式 Rules（`家庭記帳-Rules備份\firestore.rules.prod-20261029.rules.txt`）與 Git `965c4c3` 完全一致；GitHub main 與 R1 前的 repo 版本則是 `af1282f`，多了 `existingBelongsToHousehold()`，用於子集合 read／delete／update。`af1282f` 的限制從未出現在正式線上 Rules。
- 決策：repo 的 `firebase/firestore.rules` 以正式線上版本為基準；R1 只修改 `households/{householdId}`（成員可讀，客戶端不可 create／update／delete），其餘條件與正式備份逐字一致，不導入 `existingBelongsToHousehold()`。
- 正式環境既有行為（保留）：成員可讀取不存在的子文件（回傳 not-found）；成員可讀取、刪除缺少 `householdId` 的舊文件；修改時結果文件必須含正確 `householdId`；子集合查詢不強制 `householdId` 篩選（App 查詢仍自行加上）。
- Git 曾有、未部署的限制：`af1282f` 會拒絕上述讀取、刪除與修改，並使 `upsertRecurringExpenseTemplate()` 新增模板失敗。是否採用需另案評估（可與 R3／R4 一併），不得隨其他修改一起部署。
- 部署前條件：每次部署 Rules 前必須重新從 Console 備份線上版本，並確認與 repo 版本的差異只有本次授權的修改。
