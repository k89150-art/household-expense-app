# AI 協作規則

本專案由使用者、Codex 與 Claude 共同維護。任何代理開始工作前，必須先閱讀
`CLAUDE.md`、`docs/ARCHITECTURE.md`、`docs/AI_HANDOFF.md` 與
`docs/PROJECT_DECISIONS.md`。

## 工作方式

1. 同一時間只允許一個 AI 修改工作樹。
2. 修改前先執行 `git status --short --branch`，不得覆蓋使用者或其他代理的未提交成果。
3. 先讀取相關元件、型別與共用帳務函式，再做小而集中的修改。
4. 不得未經使用者明確授權執行 commit、push、部署、資料遷移或遠端設定變更。
5. 不得未經授權修改 Firebase 專案、Security Rules 或正式資料。
6. 不得把測試資料寫入正式 Firestore。
7. 完成任務後更新 `docs/AI_HANDOFF.md`，記錄改動、驗證結果、未完成事項與工作樹狀態。
8. 重要且長期有效的產品／技術決策更新到 `docs/PROJECT_DECISIONS.md`。

## 驗證要求

依變更範圍執行現有驗證。在 Windows／OneDrive 工作區優先直接執行專案內工具，
避免 pnpm 12 的 pre-run dependency verification 再次觸發 stack overflow：

```powershell
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/*.test.mjs
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\next.cmd build
```

若某項無法執行，必須在交接紀錄中寫明原因，不可把「未執行」回報成通過。
UI 修改需要檢查手機與桌面；信用卡、分期、代墊與報表修改需要檢查跨月份案例。

## 安全邊界

- 正式來源是目前工作區的 Git 儲存庫與 GitHub `main`；舊工作樹和歷史封存都不是可直接修改或自動合併的正式來源。
- 正式記帳資料在 Firebase Authentication 與 Cloud Firestore，不在 Git 儲存庫。
- 固定支出範本有 Firestore 雲端資料，瀏覽器 localStorage 只是本機快取／失敗時的備援。
- `src/components/HomeSummary.tsx` 內的示範 localStorage 資料目前不是正式首頁資料來源。
- 不得把 `.env*`、憑證、Token 或使用者資料提交到 Git。
- 不得自動整合 `家庭記帳-歷史開發封存` 中的 Phase 1；必須另案審查。

## OneDrive 依賴安裝

在 OneDrive 工作區需要重建依賴時，使用已驗證的安裝方式：

```bash
pnpm install --frozen-lockfile --node-linker=hoisted --package-import-method=copy --ignore-scripts
```

不得未經審查開放第三方安裝 scripts，也不得提交 `node_modules` 或 `.next`。
