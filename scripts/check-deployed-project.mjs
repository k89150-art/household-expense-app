#!/usr/bin/env node
/**
 * 唯讀檢查 Next.js 建置產物（本機 .next 或已部署網站）內嵌的 Firebase Project ID。
 *
 * 用法：
 *   node scripts/check-deployed-project.mjs --expect production --dir .next
 *   node scripts/check-deployed-project.mjs --expect production --url https://household-expense-app.vercel.app
 *   node scripts/check-deployed-project.mjs --expect preview    --url https://<preview-domain>
 *
 * 結果（exit code）：
 *   0 PASS        符合預期
 *   1 FAIL        發現不符合預期的 Project ID（例如 Preview 內嵌正式專案）
 *   2 UNVERIFIED  無法從產物確認 Project ID（找不到、下載失敗、受保護等），不得視為通過
 *   64 USAGE      參數錯誤
 *
 * 安全邊界：只讀取本機檔案或對網站發出 GET；不修改產物、不部署、不連線 Firebase API、不修改 Vercel。
 *
 * 靜態檢查的限制：只能證明「產物裡內嵌了哪些 Project ID 字串」，不能證明瀏覽器執行時實際連到哪裡
 * （例如死碼、執行期才組合的字串、Service Worker 快取）。P5 必須另外用瀏覽器 Network 面板確認
 * firestore.googleapis.com 請求路徑中的 projects/<id>/databases/(default)。
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PRODUCTION_FIREBASE_PROJECT_ID = "household-expense-app-8102d";
export const EXIT = Object.freeze({ PASS: 0, FAIL: 1, UNVERIFIED: 2, USAGE: 64 });

const ID = "[a-z0-9][a-z0-9-]{4,38}[a-z0-9]";
// 允許 minify 後的「projectId:<env 運算式>??"值"」寫法（目前 firebase.ts 的 fallback 就是這種形式）。
const ENV_FALLBACK = `(?:[A-Za-z0-9_$.]+\\s*\\?\\?\\s*)?`;
const PROJECT_ID_PATTERNS = [
  new RegExp(`projectId\\s*:\\s*${ENV_FALLBACK}["'\`](${ID})["'\`]`, "g"),
  new RegExp(`["']projectId["']\\s*:\\s*${ENV_FALLBACK}["'\`](${ID})["'\`]`, "g"),
];
const DOMAIN_PATTERNS = [
  new RegExp(`(?<![a-z0-9-])(${ID})\\.firebaseapp\\.com`, "g"),
  new RegExp(`(?<![a-z0-9-])(${ID})\\.firebasestorage\\.app`, "g"),
  new RegExp(`(?<![a-z0-9-])(${ID})\\.appspot\\.com`, "g"),
];

function collect(patterns, text, into) {
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) into.add(match[1]);
  }
}

/** 從多段產物文字中找出 Project ID 線索。純函式。 */
export function analyzeArtifacts(texts) {
  const projectIds = new Set();
  const domainProjectIds = new Set();
  for (const text of texts) {
    collect(PROJECT_ID_PATTERNS, text, projectIds);
    collect(DOMAIN_PATTERNS, text, domainProjectIds);
  }
  return { projectIds: [...projectIds].sort(), domainProjectIds: [...domainProjectIds].sort() };
}

/** 依預期環境判定結果。純函式。 */
export function evaluate(expect, analysis) {
  const { projectIds, domainProjectIds } = analysis;
  const all = new Set([...projectIds, ...domainProjectIds]);
  if (expect !== "production" && expect !== "preview") {
    return { status: "USAGE", reason: `--expect 只接受 production 或 preview，收到 ${expect}` };
  }
  // Preview：只要出現任何正式專案線索（projectId 或網域）就直接判定失敗
  if (expect === "preview" && all.has(PRODUCTION_FIREBASE_PROJECT_ID)) {
    return { status: "FAIL", reason: `Preview 產物包含正式專案 ${PRODUCTION_FIREBASE_PROJECT_ID}` };
  }
  if (projectIds.length === 0) {
    return { status: "UNVERIFIED", reason: "產物中找不到 projectId 設定，無法確認連線目標" };
  }
  if (projectIds.length > 1) {
    return { status: "FAIL", reason: `產物中有多個 projectId（${projectIds.join(", ")}），無法確定實際使用哪一個` };
  }
  const [projectId] = projectIds;
  if (expect === "production") {
    if (projectId !== PRODUCTION_FIREBASE_PROJECT_ID) {
      return { status: "FAIL", reason: `Production 應為 ${PRODUCTION_FIREBASE_PROJECT_ID}，產物為 ${projectId}` };
    }
    const others = [...all].filter((id) => id !== PRODUCTION_FIREBASE_PROJECT_ID);
    if (others.length > 0) {
      return { status: "FAIL", reason: `Production 產物另含其他專案網域：${others.join(", ")}` };
    }
    return { status: "PASS", reason: `Production 產物使用 ${projectId}` };
  }
  if (all.has(PRODUCTION_FIREBASE_PROJECT_ID)) {
    return { status: "FAIL", reason: `Preview 產物包含正式專案 ${PRODUCTION_FIREBASE_PROJECT_ID}` };
  }
  return { status: "PASS", reason: `Preview 產物使用 ${projectId}，未包含正式專案` };
}

async function listJsFiles(dir) {
  const out = [];
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
    }
  }
  await walk(dir);
  return out.sort();
}

/** 讀取本機建置產物中「瀏覽器會下載」的 JS（.next/static）。 */
export async function readLocalArtifacts(nextDir) {
  const staticDir = resolve(nextDir, "static");
  const info = await stat(staticDir).catch(() => null);
  if (!info || !info.isDirectory()) throw new Error(`找不到 ${staticDir}，請先執行 next build`);
  const files = await listJsFiles(staticDir);
  return { sources: files, texts: await Promise.all(files.map((file) => readFile(file, "utf8"))) };
}

async function getText(url) {
  const response = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`GET ${url} 回應 ${response.status}`);
  return response.text();
}

/** 下載已部署網站首頁與其引用的 /_next/static/*.js（只限同一網域）。 */
export async function readRemoteArtifacts(siteUrl, { maxFiles = 300 } = {}) {
  const base = new URL(siteUrl);
  if (base.protocol !== "https:") throw new Error("--url 必須是 https 網址");
  const html = await getText(base.href);
  const paths = [...new Set([...html.matchAll(/\/_next\/static\/[^"'\s<>]+?\.js/g)].map((m) => m[0]))].sort();
  if (paths.length === 0) throw new Error("首頁 HTML 中找不到 /_next/static 的 JS（可能受部署保護或不是 Next.js 網站）");
  if (paths.length > maxFiles) throw new Error(`JS 檔數量 ${paths.length} 超過上限 ${maxFiles}`);
  const urls = paths.map((p) => new URL(p, base).href).filter((u) => new URL(u).origin === base.origin);
  const texts = [html];
  for (const url of urls) texts.push(await getText(url));
  return { sources: [base.href, ...urls], texts };
}

function parseArgs(argv) {
  const args = { expect: undefined, dir: undefined, url: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === "--expect" || key === "--dir" || key === "--url") {
      if (!value || value.startsWith("--")) throw new Error(`${key} 需要一個值`);
      args[key.slice(2)] = value;
      i += 1;
    } else {
      throw new Error(`未知參數：${key}`);
    }
  }
  if (args.expect !== "production" && args.expect !== "preview") throw new Error("必須指定 --expect production 或 --expect preview");
  if (!args.dir === !args.url) throw new Error("必須擇一指定 --dir 或 --url");
  return args;
}

export async function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(`[USAGE] ${error.message}`);
    return EXIT.USAGE;
  }
  let artifacts;
  try {
    artifacts = args.dir ? await readLocalArtifacts(args.dir) : await readRemoteArtifacts(args.url);
  } catch (error) {
    console.log(`[UNVERIFIED] 無法讀取產物：${error.message}`);
    return EXIT.UNVERIFIED;
  }
  const analysis = analyzeArtifacts(artifacts.texts);
  const result = evaluate(args.expect, analysis);
  console.log(`來源：${args.dir ? resolve(args.dir) : args.url}（掃描 ${artifacts.sources.length} 個檔案）`);
  console.log(`projectId 設定：${analysis.projectIds.join(", ") || "（無）"}`);
  console.log(`Firebase 網域線索：${analysis.domainProjectIds.join(", ") || "（無）"}`);
  console.log(`[${result.status}] ${result.reason}`);
  if (result.status === "PASS") console.log("提醒：靜態檢查不等於實際連線驗證；P5 起仍需用瀏覽器 Network 面板確認。");
  return EXIT[result.status];
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
