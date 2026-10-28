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
