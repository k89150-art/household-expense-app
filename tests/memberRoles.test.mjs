import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { MEMBER_ROLES, parseMemberRoleMap, resolveMemberRole } from "../src/lib/memberRoles.ts";

// 全部為虛構 UID；不含任何正式家庭成員 UID、Email 或記帳資料。
const UID_CHRIS = "FakeChrisUid00000000000001";
const UID_WIFE = "FakeWifeUid000000000000002";
const UID_THIRD = "FakeThirdUid00000000000003";
const MAP = `${UID_CHRIS}:chris,${UID_WIFE}:wife`;
const APP_ENVS = ["production", "preview", "development", "emulator"];

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function rejectCode(input) {
  const result = resolveMemberRole(input);
  assert.equal(result.ok, false, `應拒絕，實際判定為 ${result.ok ? result.viewer : ""}`);
  return result.code;
}

test("W1. 所有環境：兩個白名單 UID 分別固定對應 chris 與 wife", () => {
  for (const appEnv of APP_ENVS) {
    assert.deepEqual(resolveMemberRole({ appEnv, uid: UID_CHRIS, memberRoleMap: MAP }), { ok: true, viewer: "chris" });
    assert.deepEqual(resolveMemberRole({ appEnv, uid: UID_WIFE, memberRoleMap: MAP }), { ok: true, viewer: "wife" });
    // 白名單順序不影響結果
    assert.deepEqual(resolveMemberRole({ appEnv, uid: UID_WIFE, memberRoleMap: `${UID_WIFE}:wife,${UID_CHRIS}:chris` }), { ok: true, viewer: "wife" });
  }
});

test("W2. 所有環境：第三個帳號一律拒絕，絕不預設為 wife（含 production）", () => {
  for (const appEnv of APP_ENVS) {
    assert.equal(rejectCode({ appEnv, uid: UID_THIRD, memberRoleMap: MAP }), "NOT_A_HOUSEHOLD_MEMBER");
  }
});

test("W3. 未登入或缺少 UID 一律拒絕", () => {
  for (const appEnv of APP_ENVS) {
    for (const uid of [undefined, null, ""]) {
      assert.equal(rejectCode({ appEnv, uid, memberRoleMap: MAP }), "MISSING_UID");
    }
  }
});

test("W4. 白名單未設定一律拒絕（含 production）", () => {
  for (const appEnv of APP_ENVS) {
    for (const memberRoleMap of [undefined, null, "", "   "]) {
      assert.equal(rejectCode({ appEnv, uid: UID_CHRIS, memberRoleMap }), "MEMBER_ROLE_MAP_MISSING");
    }
  }
});

test("W5. 白名單設定錯誤時整份拒絕，兩位成員也都不能進入", () => {
  const invalid = [
    `${UID_CHRIS}:chris`,                                   // 只有一筆
    `${UID_CHRIS}:chris,${UID_WIFE}:wife,${UID_THIRD}:wife`, // 三筆
    `${UID_CHRIS}:chris,${UID_WIFE}:chris`,                 // 兩位都是 chris
    `${UID_CHRIS}:wife,${UID_WIFE}:wife`,                   // 兩位都是 wife
    `${UID_CHRIS}:chris,${UID_CHRIS}:wife`,                 // UID 重複
    `${UID_CHRIS}:chris, ${UID_WIFE}:wife`,                 // 多餘空白
    `${UID_CHRIS}:chris,${UID_WIFE}:wife,`,                 // 結尾逗號
    `${UID_CHRIS}:Chris,${UID_WIFE}:wife`,                  // 大小寫不符
    `${UID_CHRIS}:husband,${UID_WIFE}:wife`,                // 未知角色
    `${UID_CHRIS}=chris,${UID_WIFE}=wife`,                  // 分隔符號錯誤
    `${UID_CHRIS}:chris:x,${UID_WIFE}:wife`,                // 多餘欄位
    `short:chris,${UID_WIFE}:wife`,                         // UID 太短
    `uid-with-dash-0000000001:chris,${UID_WIFE}:wife`,      // UID 含非法字元
    `${UID_CHRIS}:,${UID_WIFE}:wife`,                       // 缺角色
  ];
  for (const memberRoleMap of invalid) {
    assert.throws(() => parseMemberRoleMap(memberRoleMap), { name: "MemberRoleMapError" }, memberRoleMap);
    for (const uid of [UID_CHRIS, UID_WIFE]) {
      assert.equal(rejectCode({ appEnv: "production", uid, memberRoleMap }), "MEMBER_ROLE_MAP_INVALID", memberRoleMap);
      assert.equal(rejectCode({ appEnv: "development", uid, memberRoleMap }), "MEMBER_ROLE_MAP_INVALID", memberRoleMap);
    }
  }
});

test("W6. 環境不明一律拒絕", () => {
  for (const appEnv of [undefined, null, "", "staging", "Production", "prod"]) {
    assert.equal(rejectCode({ appEnv, uid: UID_CHRIS, memberRoleMap: MAP }), "UNKNOWN_APP_ENV");
  }
});

test("W7. 拒絕訊息不包含任何 UID", () => {
  const results = [
    resolveMemberRole({ appEnv: "production", uid: UID_THIRD, memberRoleMap: MAP }),
    resolveMemberRole({ appEnv: "production", uid: UID_CHRIS, memberRoleMap: `${UID_CHRIS}:chris` }),
    resolveMemberRole({ appEnv: "development", uid: UID_CHRIS, memberRoleMap: `${UID_CHRIS}:chris,${UID_CHRIS}:wife` }),
  ];
  for (const result of results) {
    assert.equal(result.ok, false);
    for (const uid of [UID_CHRIS, UID_WIFE, UID_THIRD]) assert.ok(!result.message.includes(uid));
  }
});

test("W8. 角色只有 chris 與 wife", () => {
  assert.deepEqual([...MEMBER_ROLES], ["chris", "wife"]);
  assert.deepEqual([...parseMemberRoleMap(MAP)], [[UID_CHRIS, "chris"], [UID_WIFE, "wife"]]);
});

test("W9. 程式碼不含私人 Email：過去寫死的正式站 Email 已從 src 全部移除，且不再以 Email 判斷角色", async () => {
  // 從本機 Git 歷史（main 3db867a）取出舊值比對，測試檔本身不寫出 Email
  const old = execFileSync("git", ["show", "3db867a275eb134fadaf33ee4c00ddec4d4db0bd:src/lib/household.ts"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const legacyEmail = /CHRIS_EMAIL = "([^"]+)"/.exec(old)?.[1];
  assert.ok(legacyEmail, "無法從 Git 歷史取得比對值；此測試不可略過");

  async function listFiles(dir) {
    const out = [];
    for (const entry of await readdir(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...await listFiles(path));
      else out.push(path);
    }
    return out;
  }
  for (const file of await listFiles("src")) {
    const text = await source(file);
    assert.ok(!text.includes(legacyEmail), `${file} 仍含正式站 Email`);
    assert.doesNotMatch(text, /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/, `${file} 不得含任何 Email`);
    assert.doesNotMatch(text, /getViewerByEmail|CHRIS_EMAIL|\.email\s*===/, `${file} 不得以 Email 判斷角色`);
  }
  const roles = (await source("src/lib/memberRoles.ts")).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(roles, /process\.env/, "memberRoles.ts 不得讀取 process.env");
  assert.doesNotMatch(roles, /from\s+["']firebase/, "memberRoles.ts 不得匯入 Firebase SDK");
});

test("W10. 頁面結構：登入（AuthGate）→ 白名單關卡 → 才掛載會讀寫 Firestore 的 HouseholdApp", async () => {
  const page = await source("src/app/page.tsx");
  assert.match(page, /<AuthGate>\s*<MemberRoleGate \/>\s*<\/AuthGate>/, "AuthGate 內只能直接放 MemberRoleGate");
  const gate = page.slice(page.indexOf("function MemberRoleGate"), page.indexOf("function HouseholdApp"));
  assert.match(gate, /appEnv: firebaseAppEnv/, "必須使用已驗證的 firebaseAppEnv");
  assert.match(gate, /memberRoleMap: process\.env\.NEXT_PUBLIC_MEMBER_ROLES/, "必須逐字讀取 NEXT_PUBLIC_MEMBER_ROLES 才會內嵌到瀏覽器程式");
  assert.doesNotMatch(page, /NEXT_PUBLIC_DEV_MEMBER_ROLES|email:/, "不得再使用開發專用對應表或 Email");
  assert.match(gate, /if \(!resolution\.ok\) \{[\s\S]*?return \(/, "不在白名單時必須提前返回");
  assert.equal((page.match(/<HouseholdApp /g) ?? []).length, 1, "HouseholdApp 只能由白名單關卡掛載");
  assert.match(gate, /<HouseholdApp viewer=\{resolution\.viewer\} \/>/);
  assert.doesNotMatch(gate, /records|getDocs|addDoc|setDoc|updateDoc|deleteDoc/, "關卡本身不得讀寫 Firestore");
  const beforeApp = page.slice(0, page.indexOf("function HouseholdApp"));
  const app = page.slice(page.indexOf("function HouseholdApp"));
  for (const component of ["FirestoreHomeSummary", "ExpenseQuickForm", "IncomeForm", "AdvanceForm", "RecurringExpensePanel", "PrepaidSettlementForm", "HouseholdReport"]) {
    assert.ok(!beforeApp.includes(`<${component}`), `${component} 不得在白名單關卡之前掛載`);
    assert.ok(app.includes(`<${component}`), `${component} 應在 HouseholdApp 內`);
  }
});

test("W11. 表單必須由上層傳入角色，不再自行推斷", async () => {
  for (const file of ["src/components/AdvanceForm.tsx", "src/components/IncomeForm.tsx"]) {
    const text = await source(file);
    assert.match(text, /viewer: Viewer;/, `${file} 的 viewer 必須是必填`);
    assert.doesNotMatch(text, /viewer\?: Viewer|viewer \?\?/);
  }
});

test("W12. firebase.ts 匯出的 appEnv 來自驗證結果；.env.example 只列名稱不含值", async () => {
  assert.match(await source("src/lib/firebase.ts"), /export const firebaseAppEnv = firebaseRuntime\.appEnv;/);
  assert.match(await source(".env.example"), /^NEXT_PUBLIC_MEMBER_ROLES=\r?$/m);
});
