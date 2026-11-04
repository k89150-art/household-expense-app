import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  EXIT,
  PRODUCTION_FIREBASE_PROJECT_ID,
  analyzeArtifacts,
  evaluate,
  main,
  readRemoteArtifacts,
} from "../scripts/check-deployed-project.mjs";

const PROD = PRODUCTION_FIREBASE_PROJECT_ID;
const DEV = "household-expense-dev-fake";

// 依實際 next build（Turbopack）產物的寫法建立虛構片段；不含真實 API Key。
const prodFallbackChunk =
  `let pG={apiKey:T.default.env.NEXT_PUBLIC_FIREBASE_API_KEY??"fake-key",` +
  `authDomain:T.default.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN??"${PROD}.firebaseapp.com",` +
  `projectId:T.default.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID??"${PROD}",` +
  `storageBucket:T.default.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET??"${PROD}.firebasestorage.app"}`;
const devInlinedChunk =
  `let pG={apiKey:"fake-dev-key",authDomain:"${DEV}.firebaseapp.com",projectId:"${DEV}",storageBucket:"${DEV}.firebasestorage.app"}`;
const sdkNoise =
  "constructor(e,t){this.projectId=e,this.database=t||sF}" +
  "Value:`projects/${e.projectId}/databases/${e.database}/documents/`";

test("analyze：讀出 minify 後 `env ?? \"值\"` 形式的正式專案", () => {
  assert.deepEqual(analyzeArtifacts([prodFallbackChunk, sdkNoise]), { projectIds: [PROD], domainProjectIds: [PROD] });
});

test("analyze：讀出建置時已內嵌的開發專案，SDK 內部字串不會誤判", () => {
  assert.deepEqual(analyzeArtifacts([devInlinedChunk, sdkNoise]), { projectIds: [DEV], domainProjectIds: [DEV] });
  assert.deepEqual(analyzeArtifacts([sdkNoise]), { projectIds: [], domainProjectIds: [] });
});

test("production：正式專案通過；開發專案或混入其他網域失敗", () => {
  assert.equal(evaluate("production", analyzeArtifacts([prodFallbackChunk])).status, "PASS");
  assert.equal(evaluate("production", analyzeArtifacts([devInlinedChunk])).status, "FAIL");
  assert.equal(evaluate("production", { projectIds: [PROD], domainProjectIds: [PROD, DEV] }).status, "FAIL");
});

test("preview：開發專案通過；任何正式專案線索（含只有網域）都失敗", () => {
  assert.equal(evaluate("preview", analyzeArtifacts([devInlinedChunk])).status, "PASS");
  assert.equal(evaluate("preview", analyzeArtifacts([prodFallbackChunk])).status, "FAIL");
  assert.equal(evaluate("preview", { projectIds: [], domainProjectIds: [PROD] }).status, "FAIL");
  assert.equal(evaluate("preview", { projectIds: [DEV], domainProjectIds: [PROD] }).status, "FAIL");
});

test("找不到 projectId 一律回報 UNVERIFIED，不可當作通過", () => {
  for (const expect of ["production", "preview"]) {
    assert.equal(evaluate(expect, { projectIds: [], domainProjectIds: [] }).status, "UNVERIFIED");
  }
  assert.equal(evaluate("production", { projectIds: [], domainProjectIds: [PROD] }).status, "UNVERIFIED");
});

test("產物同時含多個 projectId 時判定失敗（無法確定實際連線目標）", () => {
  const both = analyzeArtifacts([devInlinedChunk, `projectId:"another-fake-project"`]);
  assert.equal(evaluate("preview", both).status, "FAIL");
  assert.equal(evaluate("production", analyzeArtifacts([prodFallbackChunk, devInlinedChunk])).status, "FAIL");
});

test("未知 expect 回報 USAGE", () => {
  assert.equal(evaluate("staging", { projectIds: [PROD], domainProjectIds: [] }).status, "USAGE");
});

async function withNextDir(files, run) {
  const root = await mkdtemp(join(tmpdir(), "check-deployed-"));
  try {
    const chunks = join(root, ".next", "static", "chunks");
    await mkdir(chunks, { recursive: true });
    for (const [name, content] of Object.entries(files)) await writeFile(join(chunks, name), content, "utf8");
    return await run(join(root, ".next"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("CLI --dir：正式產物 PASS、Preview 檢查正式產物 FAIL、空產物 UNVERIFIED", async () => {
  const silent = console.log;
  console.log = () => {};
  try {
    await withNextDir({ "a.js": prodFallbackChunk, "b.js": sdkNoise }, async (dir) => {
      assert.equal(await main(["--expect", "production", "--dir", dir]), EXIT.PASS);
      assert.equal(await main(["--expect", "preview", "--dir", dir]), EXIT.FAIL);
    });
    await withNextDir({ "a.js": devInlinedChunk }, async (dir) => {
      assert.equal(await main(["--expect", "preview", "--dir", dir]), EXIT.PASS);
      assert.equal(await main(["--expect", "production", "--dir", dir]), EXIT.FAIL);
    });
    await withNextDir({ "a.js": sdkNoise }, async (dir) => {
      assert.equal(await main(["--expect", "production", "--dir", dir]), EXIT.UNVERIFIED);
    });
    assert.equal(await main(["--expect", "production", "--dir", join(tmpdir(), "does-not-exist-next")]), EXIT.UNVERIFIED);
  } finally {
    console.log = silent;
  }
});

test("CLI 參數錯誤回報 USAGE", async () => {
  const silent = console.error;
  console.error = () => {};
  try {
    assert.equal(await main([]), EXIT.USAGE);
    assert.equal(await main(["--expect", "staging", "--dir", ".next"]), EXIT.USAGE);
    assert.equal(await main(["--expect", "production"]), EXIT.USAGE);
    assert.equal(await main(["--expect", "production", "--dir", ".next", "--url", "https://example.test"]), EXIT.USAGE);
    assert.equal(await main(["--expect", "production", "--force"]), EXIT.USAGE);
  } finally {
    console.error = silent;
  }
});

test("遠端模式只接受 https，且不發出非 GET 請求（此測試不連網）", async () => {
  await assert.rejects(readRemoteArtifacts("http://example.test"), /https/);
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../scripts/check-deployed-project.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /method:\s*["'](POST|PUT|PATCH|DELETE)["']/);
  assert.doesNotMatch(source, /writeFile|appendFile|rm\(|unlink|child_process|firebase-tools/);
});
