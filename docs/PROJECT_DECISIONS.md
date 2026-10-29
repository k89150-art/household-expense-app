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

## D-010 Git 換行格式規則

- 日期：2026-10-29
- 決策：專案統一使用 LF 換行；`.cmd`、`.bat`、`.ps1` 等 Windows 腳本保留 CRLF；圖片、字型、PDF、壓縮檔等明確標記為 binary，不做換行轉換。
- 規則來源：以 repo 根目錄的 `.gitattributes` 為共同換行規則，優先於個別電腦的 `core.autocrlf` 設定。Codex 與 Claude 都必須遵守，不得在檔案內另行改變換行格式。
- 既有檔案：導入時不立即正規化。目前 `src/app/globals.css`、`src/components/FirestoreHomeSummary.tsx`、`src/components/IncomeForm.tsx`、`src/components/RecurringExpensePanel.tsx`、`src/lib/records.ts` 在 repo 中為 CRLF／LF 混用，暫時維持原狀。
- 限制：未來執行 `git add --renormalize` 時，必須取得使用者授權並獨立提交，並以 `git diff --cached --ignore-cr-at-eol` 確認只有換行差異；不得把換行正規化混入任何功能修改。
