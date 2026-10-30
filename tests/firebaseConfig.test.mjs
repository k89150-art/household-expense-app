import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_ENVS,
  AUTH_EMULATOR_PORT,
  EMULATOR_HOST,
  FIRESTORE_EMULATOR_PORT,
  FirebaseConfigError,
  PRODUCTION_FIREBASE_PROJECT_ID,
  resolveFirebaseConfig,
} from "../src/lib/firebaseConfig.ts";

// 全部為虛構值；不連線任何真實 Firebase。
const PROD = PRODUCTION_FIREBASE_PROJECT_ID;

const production = Object.freeze({
  appEnv: "production",
  apiKey: "fake-production-api-key",
  authDomain: `${PROD}.firebaseapp.com`,
  projectId: PROD,
  storageBucket: `${PROD}.firebasestorage.app`,
  messagingSenderId: "000000000001",
  appId: "1:000000000001:web:fakeproduction",
});

const development = Object.freeze({
  appEnv: "development",
  apiKey: "fake-development-api-key",
  authDomain: "household-expense-dev-fake.firebaseapp.com",
  projectId: "household-expense-dev-fake",
  storageBucket: "household-expense-dev-fake.firebasestorage.app",
  messagingSenderId: "000000000002",
  appId: "1:000000000002:web:fakedevelopment",
});

const emulator = Object.freeze({
  appEnv: "emulator",
  apiKey: "demo-api-key",
  authDomain: "demo-household-expense.firebaseapp.com",
  projectId: "demo-household-expense",
  storageBucket: "demo-household-expense.firebasestorage.app",
  messagingSenderId: "000000000003",
  appId: "1:000000000003:web:fakeemulator",
  emulatorHost: "127.0.0.1",
});

function expectCode(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof FirebaseConfigError, `應為 FirebaseConfigError，實際為 ${error}`);
    assert.equal(error.code, code);
    return true;
  });
}

const REQUIRED = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"];

test("1. production 正確設定通過，且回傳值與輸入一致、不可變更", () => {
  const resolved = resolveFirebaseConfig(production);
  assert.equal(resolved.appEnv, "production");
  assert.equal(resolved.isProduction, true);
  assert.equal(resolved.emulator, null);
  assert.equal(resolved.firebase.projectId, PROD);
  assert.equal(resolved.firebase.apiKey, production.apiKey);
  assert.ok(Object.isFrozen(resolved) && Object.isFrozen(resolved.firebase));
});

test("2. production 使用非正式專案會被拒絕", () => {
  expectCode(() => resolveFirebaseConfig({ ...development, appEnv: "production" }), "PRODUCTION_PROJECT_MISMATCH");
  expectCode(() => resolveFirebaseConfig({ ...emulator, appEnv: "production", emulatorHost: undefined }), "PRODUCTION_PROJECT_MISMATCH");
});

test("3. development 使用獨立專案通過", () => {
  const resolved = resolveFirebaseConfig(development);
  assert.equal(resolved.appEnv, "development");
  assert.equal(resolved.isProduction, false);
  assert.equal(resolved.emulator, null);
  assert.equal(resolved.firebase.projectId, "household-expense-dev-fake");
});

test("4. development 誤用正式專案會被拒絕", () => {
  expectCode(() => resolveFirebaseConfig({ ...production, appEnv: "development" }), "PRODUCTION_PROJECT_FORBIDDEN");
});

test("5. preview 誤用正式專案會被拒絕；preview 使用開發專案通過", () => {
  expectCode(() => resolveFirebaseConfig({ ...production, appEnv: "preview" }), "PRODUCTION_PROJECT_FORBIDDEN");
  assert.equal(resolveFirebaseConfig({ ...development, appEnv: "preview" }).appEnv, "preview");
});

test("5b. 非 production 只要任何欄位指向正式專案就拒絕（避免混用設定）", () => {
  // 開發專案 ID，但 authDomain／storageBucket 指向正式專案：先被網域一致性檢查擋下
  expectCode(() => resolveFirebaseConfig({ ...development, authDomain: `${PROD}.firebaseapp.com` }), "DOMAIN_PROJECT_MISMATCH");
  expectCode(() => resolveFirebaseConfig({ ...development, storageBucket: `${PROD}.appspot.com` }), "DOMAIN_PROJECT_MISMATCH");
  // 自訂網域但含正式專案名稱
  expectCode(() => resolveFirebaseConfig({ ...development, authDomain: `${PROD}.example.test` }), "PRODUCTION_PROJECT_FORBIDDEN");
});

test("6–9. 缺少任一必要欄位都會拒絕", () => {
  for (const field of REQUIRED) {
    const withoutField = { ...production };
    delete withoutField[field];
    expectCode(() => resolveFirebaseConfig(withoutField), "MISSING_FIELD");
    expectCode(() => resolveFirebaseConfig({ ...production, [field]: undefined }), "MISSING_FIELD");
    expectCode(() => resolveFirebaseConfig({ ...production, [field]: null }), "MISSING_FIELD");
  }
});

test("6. 缺少 projectId", () => {
  const input = { ...development };
  delete input.projectId;
  expectCode(() => resolveFirebaseConfig(input), "MISSING_FIELD");
});

test("7. 缺少 apiKey", () => {
  const input = { ...development };
  delete input.apiKey;
  expectCode(() => resolveFirebaseConfig(input), "MISSING_FIELD");
});

test("8. 缺少 authDomain", () => {
  const input = { ...development };
  delete input.authDomain;
  expectCode(() => resolveFirebaseConfig(input), "MISSING_FIELD");
});

test("9. 缺少 appEnv 或整份設定", () => {
  const input = { ...production };
  delete input.appEnv;
  expectCode(() => resolveFirebaseConfig(input), "MISSING_FIELD");
  expectCode(() => resolveFirebaseConfig(undefined), "MISSING_FIELD");
  expectCode(() => resolveFirebaseConfig(null), "MISSING_FIELD");
  expectCode(() => resolveFirebaseConfig({}), "MISSING_FIELD");
});

test("10. emulator 正確設定通過，只連 127.0.0.1 與固定 port", () => {
  const resolved = resolveFirebaseConfig(emulator);
  assert.equal(resolved.appEnv, "emulator");
  assert.equal(resolved.isProduction, false);
  assert.deepEqual({ ...resolved.emulator }, { host: EMULATOR_HOST, authPort: AUTH_EMULATOR_PORT, firestorePort: FIRESTORE_EMULATOR_PORT });
  assert.equal(resolved.emulator.host, "127.0.0.1");
});

test("11. emulator 的 projectId 不是 demo- 開頭會被拒絕", () => {
  expectCode(() => resolveFirebaseConfig({ ...development, appEnv: "emulator", emulatorHost: "127.0.0.1" }), "EMULATOR_PROJECT_NOT_DEMO");
  expectCode(() => resolveFirebaseConfig({ ...production, appEnv: "emulator", emulatorHost: "127.0.0.1" }), "PRODUCTION_PROJECT_FORBIDDEN");
});

test("12. emulator 使用非 127.0.0.1 或未設定 host 會被拒絕", () => {
  for (const host of ["localhost", "0.0.0.0", "::1", "192.168.1.10", "127.0.0.2", "firestore.googleapis.com", "127.0.0.1:8080"]) {
    expectCode(() => resolveFirebaseConfig({ ...emulator, emulatorHost: host }), "EMULATOR_HOST_NOT_LOOPBACK");
  }
  const noHost = { ...emulator };
  delete noHost.emulatorHost;
  expectCode(() => resolveFirebaseConfig(noHost), "EMULATOR_HOST_REQUIRED");
});

test("12b. 非 emulator 環境不可設定 Emulator 連線；demo- 專案只限 emulator", () => {
  expectCode(() => resolveFirebaseConfig({ ...production, emulatorHost: "127.0.0.1" }), "EMULATOR_HOST_UNEXPECTED");
  expectCode(() => resolveFirebaseConfig({ ...development, emulatorHost: "127.0.0.1" }), "EMULATOR_HOST_UNEXPECTED");
  expectCode(() => resolveFirebaseConfig({ ...emulator, appEnv: "development", emulatorHost: undefined }), "DEMO_PROJECT_OUTSIDE_EMULATOR");
  expectCode(() => resolveFirebaseConfig({ ...emulator, appEnv: "preview", emulatorHost: undefined }), "DEMO_PROJECT_OUTSIDE_EMULATOR");
});

test("13. 未知或大小寫不符的 appEnv 會被拒絕", () => {
  for (const appEnv of ["staging", "prod", "Production", "PRODUCTION", "test", "local"]) {
    expectCode(() => resolveFirebaseConfig({ ...production, appEnv }), "UNKNOWN_APP_ENV");
  }
  assert.deepEqual([...APP_ENVS], ["production", "preview", "development", "emulator"]);
});

test("14. 空字串、純空白或含空白的設定會被拒絕", () => {
  for (const field of ["appEnv", ...REQUIRED]) {
    expectCode(() => resolveFirebaseConfig({ ...production, [field]: "" }), "MISSING_FIELD");
    expectCode(() => resolveFirebaseConfig({ ...production, [field]: "   " }), "MISSING_FIELD");
  }
  expectCode(() => resolveFirebaseConfig({ ...production, projectId: ` ${PROD}` }), "INVALID_VALUE");
  expectCode(() => resolveFirebaseConfig({ ...production, apiKey: "fake key" }), "INVALID_VALUE");
  expectCode(() => resolveFirebaseConfig({ ...production, apiKey: 12345 }), "INVALID_VALUE");
});

test("15. 任何缺少設定的情況都不會自動 fallback 到正式專案", () => {
  const baseFor = { production, preview: { ...development, appEnv: "preview" }, development, emulator };
  for (const appEnv of APP_ENVS) {
    for (const field of REQUIRED) {
      for (const missing of [undefined, null, ""]) {
        // 以該環境「其他欄位全部正確」的設定為基準，只缺一個欄位；必須明確回報 MISSING_FIELD，
        // 不可因其他檢查剛好擋下而掩蓋 fallback。
        const input = { ...baseFor[appEnv], [field]: missing };
        let resolved;
        try {
          resolved = resolveFirebaseConfig(input);
        } catch (error) {
          assert.ok(error instanceof FirebaseConfigError);
          assert.equal(error.code, "MISSING_FIELD", `appEnv=${appEnv} 缺少 ${field} 應回報 MISSING_FIELD，實際 ${error.code}`);
          continue;
        }
        assert.fail(`缺少 ${field}（appEnv=${appEnv}）時應丟出錯誤，卻回傳 projectId=${resolved.firebase.projectId}`);
      }
    }
  }
  // 只給 appEnv=production、其餘全部缺少，也不得回傳正式設定
  expectCode(() => resolveFirebaseConfig({ appEnv: "production" }), "MISSING_FIELD");
});

test("16. 驗證模組本身不含 API Key、不匯入 Firebase SDK、不讀取 process.env", async () => {
  const { readFile } = await import("node:fs/promises");
  const raw = await readFile(new URL("../src/lib/firebaseConfig.ts", import.meta.url), "utf8");
  assert.doesNotMatch(raw, /AIza[0-9A-Za-z_-]{10,}/, "不得硬編碼 Firebase API Key（含註解）");
  // 只檢查程式碼本身：移除區塊註解與行註解後再比對
  const source = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(source, /from\s+["']firebase/, "不得匯入 Firebase SDK");
  assert.doesNotMatch(source, /import\s*\(\s*["']firebase/, "不得動態匯入 Firebase SDK");
  assert.doesNotMatch(source, /process\.env/, "不得直接讀取 process.env");
});
