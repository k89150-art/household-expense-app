import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { MEMBER_ROLES, parseDevelopmentRoleMap, resolveMemberRole } from "../src/lib/memberRoles.ts";

// 全部為虛構 UID 與 Email；不含正式家庭成員 UID 或任何記帳資料。
const UID_A = "DevTesterChrisUid000000001";
const UID_B = "DevTesterWifeUid0000000002";
const UID_UNKNOWN = "SomeoneElseUid000000000003";
const DEV_MAP = `${UID_A}:chris,${UID_B}:wife`;
const NON_PRODUCTION = ["development", "preview", "emulator"];

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function codeOf(input) {
  const result = resolveMemberRole(input);
  assert.equal(result.ok, false, `應拒絕，實際判定為 ${result.ok ? result.viewer : ""}`);
  return result.code;
}

test("R1. production 維持既有行為：指定 Email 為 chris，其餘為 wife", async () => {
  const legacyEmail = /LEGACY_PRODUCTION_CHRIS_EMAIL = "([^"]+)"/.exec(await source("src/lib/memberRoles.ts"))[1];
  assert.deepEqual(
    resolveMemberRole({ appEnv: "production", uid: UID_A, email: legacyEmail, developmentRoleMap: undefined }),
    { ok: true, viewer: "chris", source: "production-legacy-email" },
  );
  for (const email of ["someone@example.test", null, undefined]) {
    const result = resolveMemberRole({ appEnv: "production", uid: UID_B, email, developmentRoleMap: undefined });
    assert.deepEqual(result, { ok: true, viewer: "wife", source: "production-legacy-email" });
  }
});

test("R2. production 忽略開發對應表（不因開發設定改變正式行為）", () => {
  const result = resolveMemberRole({ appEnv: "production", uid: UID_A, email: "someone@example.test", developmentRoleMap: `${UID_A}:chris` });
  assert.deepEqual(result, { ok: true, viewer: "wife", source: "production-legacy-email" });
});

test("R3. 非 production 依明確 UID 對應判定角色", () => {
  for (const appEnv of NON_PRODUCTION) {
    assert.deepEqual(resolveMemberRole({ appEnv, uid: UID_A, email: null, developmentRoleMap: DEV_MAP }), { ok: true, viewer: "chris", source: "development-uid-map" });
    assert.deepEqual(resolveMemberRole({ appEnv, uid: UID_B, email: null, developmentRoleMap: DEV_MAP }), { ok: true, viewer: "wife", source: "development-uid-map" });
  }
});

test("R4. 非 production 的未知使用者一律拒絕，絕不預設為 wife", () => {
  for (const appEnv of NON_PRODUCTION) {
    assert.equal(codeOf({ appEnv, uid: UID_UNKNOWN, email: "someone@example.test", developmentRoleMap: DEV_MAP }), "UNMAPPED_DEVELOPMENT_USER");
  }
});

test("R5. 非 production 不使用 Email 判斷：正式站的 chris Email 未對應 UID 時也拒絕", async () => {
  const legacyEmail = /LEGACY_PRODUCTION_CHRIS_EMAIL = "([^"]+)"/.exec(await source("src/lib/memberRoles.ts"))[1];
  for (const appEnv of NON_PRODUCTION) {
    assert.equal(codeOf({ appEnv, uid: UID_UNKNOWN, email: legacyEmail, developmentRoleMap: DEV_MAP }), "UNMAPPED_DEVELOPMENT_USER");
    // 對應表中的 UID 決定角色，Email 不影響結果
    assert.equal(resolveMemberRole({ appEnv, uid: UID_B, email: legacyEmail, developmentRoleMap: DEV_MAP }).viewer, "wife");
  }
});

test("R6. 非 production 未設定對應表時所有帳號都拒絕", () => {
  for (const appEnv of NON_PRODUCTION) {
    for (const developmentRoleMap of [undefined, null, "", "   "]) {
      assert.equal(codeOf({ appEnv, uid: UID_A, email: null, developmentRoleMap }), "DEVELOPMENT_ROLE_MAP_MISSING");
    }
  }
});

test("R7. 對應表格式錯誤時整份拒絕（不部分接受）", () => {
  const invalid = [
    `${UID_A}:chris,`,
    `,${UID_A}:chris`,
    `${UID_A}:chris, ${UID_B}:wife`,
    ` ${UID_A}:chris`,
    `${UID_A}=chris`,
    `${UID_A}:chris:extra`,
    `${UID_A}:husband`,
    `${UID_A}:Chris`,
    `${UID_A}:chris,${UID_A}:wife`,
    "short:chris",
    "uid-with-dash-000000000:chris",
    `${UID_A}:`,
    `:chris`,
  ];
  for (const developmentRoleMap of invalid) {
    assert.equal(codeOf({ appEnv: "development", uid: UID_A, email: null, developmentRoleMap }), "DEVELOPMENT_ROLE_MAP_INVALID", developmentRoleMap);
    assert.throws(() => parseDevelopmentRoleMap(developmentRoleMap), { name: "DevelopmentRoleMapError" });
  }
});

test("R8. 缺少 UID 或未知環境一律拒絕", () => {
  for (const uid of [undefined, null, ""]) {
    assert.equal(codeOf({ appEnv: "development", uid, email: null, developmentRoleMap: DEV_MAP }), "MISSING_UID");
  }
  for (const appEnv of [undefined, null, "", "staging", "Production", "prod"]) {
    assert.equal(codeOf({ appEnv, uid: UID_A, email: null, developmentRoleMap: DEV_MAP }), "UNKNOWN_APP_ENV");
  }
});

test("R9. 拒絕訊息不包含 UID、Email 或對應表內容", () => {
  const results = [
    resolveMemberRole({ appEnv: "development", uid: UID_UNKNOWN, email: "someone@example.test", developmentRoleMap: DEV_MAP }),
    resolveMemberRole({ appEnv: "development", uid: UID_A, email: "someone@example.test", developmentRoleMap: `${UID_A}:husband` }),
  ];
  for (const result of results) {
    assert.equal(result.ok, false);
    for (const secret of [UID_A, UID_B, UID_UNKNOWN, "someone@example.test"]) {
      assert.ok(!result.message.includes(secret), `訊息不得包含 ${secret}`);
    }
  }
});

test("R10. 角色只有 chris 與 wife；解析結果正確且不可重複", () => {
  assert.deepEqual([...MEMBER_ROLES], ["chris", "wife"]);
  assert.deepEqual([...parseDevelopmentRoleMap(DEV_MAP)], [[UID_A, "chris"], [UID_B, "wife"]]);
  assert.deepEqual([...parseDevelopmentRoleMap(`${UID_A}:chris`)], [[UID_A, "chris"]]);
});

test("R11. 角色判斷集中：正式站 Email 只出現在 memberRoles.ts；其他程式不再以 Email 判斷角色", async () => {
  const legacyEmail = /LEGACY_PRODUCTION_CHRIS_EMAIL = "([^"]+)"/.exec(await source("src/lib/memberRoles.ts"))[1];
  const files = [
    "src/app/page.tsx",
    "src/lib/household.ts",
    "src/lib/records.ts",
    "src/components/AuthGate.tsx",
    "src/components/AdvanceForm.tsx",
    "src/components/IncomeForm.tsx",
    "src/components/InvestmentForm.tsx",
    "src/components/ExpenseQuickForm.tsx",
    "src/components/FirestoreHomeSummary.tsx",
    "src/components/RecurringExpensePanel.tsx",
  ];
  for (const file of files) {
    const text = await source(file);
    assert.ok(!text.includes(legacyEmail), `${file} 不得再出現正式站 Email`);
    assert.doesNotMatch(text, /getViewerByEmail|CHRIS_EMAIL/, `${file} 不得再使用舊的 Email 角色判斷`);
    assert.doesNotMatch(text, /\.email\s*===/, `${file} 不得以 Email 比對判斷角色`);
  }
  const roles = await source("src/lib/memberRoles.ts");
  const code = roles.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /process\.env/, "memberRoles.ts 不得讀取 process.env");
  assert.doesNotMatch(code, /from\s+["']firebase/, "memberRoles.ts 不得匯入 Firebase SDK");
});

test("R12. 頁面結構：登入（AuthGate）→ 角色關卡 → 才掛載會讀寫 Firestore 的 HouseholdApp", async () => {
  const page = await source("src/app/page.tsx");
  assert.match(page, /<AuthGate>\s*<MemberRoleGate \/>\s*<\/AuthGate>/, "AuthGate 內只能直接放 MemberRoleGate");
  const gate = page.slice(page.indexOf("function MemberRoleGate"), page.indexOf("function HouseholdApp"));
  assert.match(gate, /resolveMemberRole\(/);
  assert.match(gate, /appEnv: firebaseAppEnv/, "必須使用已驗證的 firebaseAppEnv");
  assert.match(gate, /if \(!resolution\.ok\) \{[\s\S]*?return \(/, "角色無法確認時必須提前返回");
  assert.equal((page.match(/<HouseholdApp /g) ?? []).length, 1, "HouseholdApp 只能由角色關卡掛載");
  assert.match(gate, /<HouseholdApp viewer=\{resolution\.viewer\} \/>/);
  // 關卡本身不得讀寫 Firestore
  assert.doesNotMatch(gate, /records|getDocs|addDoc|setDoc|updateDoc|deleteDoc/);
  // 讀寫 Firestore 的元件只在 HouseholdApp 之內
  const app = page.slice(page.indexOf("function HouseholdApp"));
  for (const component of ["FirestoreHomeSummary", "ExpenseQuickForm", "IncomeForm", "InvestmentForm", "AdvanceForm", "RecurringExpensePanel", "PrepaidSettlementForm", "HouseholdReport"]) {
    assert.ok(!page.slice(0, page.indexOf("function HouseholdApp")).includes(`<${component}`), `${component} 不得在角色關卡之前掛載`);
    assert.ok(app.includes(`<${component}`), `${component} 應在 HouseholdApp 內`);
  }
});

test("R13. 表單必須由上層傳入角色，不再自行推斷", async () => {
  for (const file of ["src/components/AdvanceForm.tsx", "src/components/IncomeForm.tsx", "src/components/InvestmentForm.tsx"]) {
    const text = await source(file);
    assert.match(text, /viewer: Viewer;/, `${file} 的 viewer 必須是必填`);
    assert.doesNotMatch(text, /viewer\?: Viewer/);
    assert.doesNotMatch(text, /viewer \?\?/);
  }
});

test("R14. firebase.ts 匯出的 appEnv 來自驗證結果", async () => {
  const text = await source("src/lib/firebase.ts");
  assert.match(text, /export const firebaseAppEnv = firebaseRuntime\.appEnv;/);
});
