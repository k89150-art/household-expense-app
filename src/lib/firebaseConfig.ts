/**
 * Firebase 環境設定驗證（P1 建立，P3-C1 接入 `src/lib/firebase.ts`）。
 *
 * - 不初始化 Firebase、不呼叫任何 Firebase SDK、不連線、不讀取正式資料。
 * - 只接收呼叫端明確傳入的設定值；缺少或不合法時一律丟出 FirebaseConfigError，
 *   絕不自動改用正式 Firebase 設定。
 * - 本檔不得包含任何 API Key 或憑證；正式 Project ID 不是機密，用於比對防誤連。
 * - P3-C2：不只依 projectId 判斷。Sender ID／App ID 必須屬於同一專案編號，
 *   非 production 不得使用正式專案編號或正式 API Key（只保存 SHA-256 指紋）。
 *
 * Next.js 只會在原始碼「逐字寫出」`process.env.NEXT_PUBLIC_XXX`
 * 時把值內嵌到瀏覽器程式，因此呼叫端必須逐一寫出這些環境變數再傳入本函式，
 * 不可用動態 key 讀取 `process.env`。
 */

export const PRODUCTION_FIREBASE_PROJECT_ID = "household-expense-app-8102d";
export const DEVELOPMENT_FIREBASE_PROJECT_ID = "household-expense-dev";
export const EMULATOR_FIREBASE_PROJECT_ID = "demo-household-expense";

/**
 * 正式專案的專案編號（Google Cloud project number）。非機密識別碼，等於正式 Web App 的
 * messagingSenderId，也是 appId「1:<專案編號>:web:...」的第二段。
 * production 必須使用它；其他環境一律不得使用（防止 Sender ID／App ID 跨專案混用）。
 */
export const PRODUCTION_FIREBASE_PROJECT_NUMBER = "41472809503";

/**
 * 正式專案 Web API Key 的 SHA-256 指紋（十六進位小寫）。只保存指紋、不保存原文。
 * 非 production 環境的 apiKey 若符合任一指紋即拒絕。Firebase Auth 依 API Key 決定連線專案，
 * 所以單看 projectId 不足以防止連到正式專案。正式金鑰輪替時，把新金鑰的指紋加入此清單。
 */
export const PRODUCTION_FIREBASE_API_KEY_SHA256: readonly string[] = Object.freeze([
  "08e03dff9fff9a5ba8e065fbe23b389a0180ee659dfa060c97e86910e6e1b11b",
]);

/** development／preview 只接受開發專案的 Firebase 預設網域（不接受自訂網域）。 */
const DEVELOPMENT_AUTH_DOMAINS = Object.freeze([
  `${DEVELOPMENT_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  `${DEVELOPMENT_FIREBASE_PROJECT_ID}.web.app`,
]);
const DEVELOPMENT_STORAGE_BUCKETS = Object.freeze([
  `${DEVELOPMENT_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  `${DEVELOPMENT_FIREBASE_PROJECT_ID}.appspot.com`,
]);

/** Firebase Web App ID 格式：1:<專案編號>:web:<識別碼>。 */
const WEB_APP_ID_PATTERN = /^1:(\d{1,20}):web:([0-9A-Za-z]+)$/;
const PROJECT_NUMBER_PATTERN = /^\d{1,20}$/;

export const EMULATOR_HOST = "127.0.0.1";
export const AUTH_EMULATOR_PORT = 9099;
export const FIRESTORE_EMULATOR_PORT = 8080;

export const APP_ENVS = ["production", "preview", "development", "emulator"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

/** 對應的環境變數名稱（僅供文件與檢查腳本參考，本函式不直接讀取 process.env）。 */
export const FIREBASE_ENV_VARIABLES = {
  appEnv: "NEXT_PUBLIC_APP_ENV",
  apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "NEXT_PUBLIC_FIREBASE_APP_ID",
  emulatorHost: "NEXT_PUBLIC_FIREBASE_EMULATOR_HOST",
} as const;

const REQUIRED_FIREBASE_FIELDS = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
] as const;
type RequiredFirebaseField = (typeof REQUIRED_FIREBASE_FIELDS)[number];

export type FirebaseConfigErrorCode =
  | "UNKNOWN_APP_ENV"
  | "MISSING_FIELD"
  | "INVALID_VALUE"
  | "PRODUCTION_PROJECT_MISMATCH"
  | "DEVELOPMENT_PROJECT_MISMATCH"
  | "PREVIEW_PROJECT_MISMATCH"
  | "PRODUCTION_PROJECT_FORBIDDEN"
  | "DEMO_PROJECT_OUTSIDE_EMULATOR"
  | "EMULATOR_PROJECT_NOT_DEMO"
  | "EMULATOR_HOST_REQUIRED"
  | "EMULATOR_HOST_NOT_LOOPBACK"
  | "EMULATOR_HOST_UNEXPECTED"
  | "DOMAIN_PROJECT_MISMATCH"
  | "APP_ID_SENDER_MISMATCH"
  | "PRODUCTION_PROJECT_NUMBER_MISMATCH"
  | "PRODUCTION_CREDENTIAL_FORBIDDEN"
  | "EXISTING_APP_COUNT_UNEXPECTED"
  | "EXISTING_APP_FIELD_MISSING"
  | "EXISTING_APP_CONFIG_MISMATCH";

export class FirebaseConfigError extends Error {
  readonly code: FirebaseConfigErrorCode;

  constructor(code: FirebaseConfigErrorCode, message: string) {
    super(`[firebase-config:${code}] ${message}`);
    this.name = "FirebaseConfigError";
    this.code = code;
  }
}

/** 呼叫端提供的原始設定；值可能缺少，由本函式負責拒絕。 */
export interface FirebaseEnvInput {
  appEnv?: string | null;
  apiKey?: string | null;
  authDomain?: string | null;
  projectId?: string | null;
  storageBucket?: string | null;
  messagingSenderId?: string | null;
  appId?: string | null;
  emulatorHost?: string | null;
}

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface FirebaseEmulatorTarget {
  host: typeof EMULATOR_HOST;
  authPort: number;
  firestorePort: number;
}

export interface ResolvedFirebaseConfig {
  appEnv: AppEnv;
  isProduction: boolean;
  firebase: FirebaseWebConfig;
  emulator: FirebaseEmulatorTarget | null;
}

export interface FirebaseAppLike {
  options: Partial<FirebaseWebConfig>;
}

function isAppEnv(value: string): value is AppEnv {
  return (APP_ENVS as readonly string[]).includes(value);
}

function requireText(name: string, value: string | null | undefined): string {
  if (value === undefined || value === null) {
    throw new FirebaseConfigError("MISSING_FIELD", `缺少必要設定 ${name}`);
  }
  if (typeof value !== "string") {
    throw new FirebaseConfigError("INVALID_VALUE", `${name} 必須是字串`);
  }
  if (value.trim() === "") {
    throw new FirebaseConfigError("MISSING_FIELD", `必要設定 ${name} 是空字串`);
  }
  if (value !== value.trim() || /\s/.test(value)) {
    throw new FirebaseConfigError("INVALID_VALUE", `${name} 不可包含空白字元`);
  }
  return value;
}

/** authDomain／storageBucket 若是 Firebase 預設網域，前綴必須等於 projectId，避免混用不同專案的設定。 */
function assertDomainMatchesProject(field: string, value: string, projectId: string, suffixes: readonly string[]) {
  for (const suffix of suffixes) {
    if (value.endsWith(suffix)) {
      const prefix = value.slice(0, -suffix.length);
      if (prefix !== projectId) {
        throw new FirebaseConfigError(
          "DOMAIN_PROJECT_MISMATCH",
          `${field} (${value}) 不屬於 projectId ${projectId}`,
        );
      }
    }
  }
}

function mentionsProductionProject(value: string): boolean {
  return value.includes(PRODUCTION_FIREBASE_PROJECT_ID);
}

/**
 * 同步 SHA-256（UTF-8 輸入，回傳十六進位小寫）。瀏覽器端初始化必須同步完成，
 * 不能使用非同步的 crypto.subtle；只用於比對正式 API Key 指紋，不作其他用途。
 */
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256Hex(text: string): string {
  const data = new TextEncoder().encode(text);
  const bitLength = data.length * 8;
  const padded = new Uint8Array((((data.length + 9) + 63) >> 6) << 6);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(padded.length - 4, bitLength >>> 0);

  const hash = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i += 1) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + SHA256_K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    hash[0] += a; hash[1] += b; hash[2] += c; hash[3] += d; hash[4] += e; hash[5] += f; hash[6] += g; hash[7] += h;
  }
  return Array.from(hash, (x) => x.toString(16).padStart(8, "0")).join("");
}

/**
 * Web App 識別資訊必須自洽：messagingSenderId 為專案編號，appId 的第二段必須等於它。
 * 這讓 Sender ID 與 App ID 綁在同一個專案，無法各自來自不同專案。
 */
function assertWebAppIdentity(firebase: FirebaseWebConfig) {
  if (!PROJECT_NUMBER_PATTERN.test(firebase.messagingSenderId)) {
    throw new FirebaseConfigError("INVALID_VALUE", "messagingSenderId 必須是純數字的專案編號");
  }
  const match = WEB_APP_ID_PATTERN.exec(firebase.appId);
  if (!match) {
    throw new FirebaseConfigError("INVALID_VALUE", "appId 必須是 1:<專案編號>:web:<識別碼> 格式");
  }
  if (match[1] !== firebase.messagingSenderId) {
    throw new FirebaseConfigError("APP_ID_SENDER_MISMATCH", "appId 的專案編號與 messagingSenderId 不一致（疑似混用不同專案的設定）");
  }
}

/** 非 production：不得使用正式專案的專案編號（Sender ID／App ID）或正式 API Key。 */
function assertNoProductionCredentials(appEnv: AppEnv, firebase: FirebaseWebConfig) {
  if (firebase.messagingSenderId === PRODUCTION_FIREBASE_PROJECT_NUMBER) {
    throw new FirebaseConfigError(
      "PRODUCTION_CREDENTIAL_FORBIDDEN",
      `${appEnv} 不可使用正式專案的 messagingSenderId／appId`,
    );
  }
  if (PRODUCTION_FIREBASE_API_KEY_SHA256.includes(sha256Hex(firebase.apiKey))) {
    throw new FirebaseConfigError("PRODUCTION_CREDENTIAL_FORBIDDEN", `${appEnv} 不可使用正式專案的 apiKey`);
  }
}

export function resolveFirebaseConfig(input: FirebaseEnvInput): ResolvedFirebaseConfig {
  if (input === null || typeof input !== "object") {
    throw new FirebaseConfigError("MISSING_FIELD", "未提供 Firebase 環境設定");
  }

  const appEnvRaw = requireText("appEnv", input.appEnv);
  if (!isAppEnv(appEnvRaw)) {
    throw new FirebaseConfigError("UNKNOWN_APP_ENV", `未知的 appEnv：${appEnvRaw}（允許：${APP_ENVS.join(", ")}）`);
  }
  const appEnv: AppEnv = appEnvRaw;

  const values = {} as Record<RequiredFirebaseField, string>;
  for (const field of REQUIRED_FIREBASE_FIELDS) {
    values[field] = requireText(field, input[field]);
  }
  const firebase: FirebaseWebConfig = {
    apiKey: values.apiKey,
    authDomain: values.authDomain,
    projectId: values.projectId,
    storageBucket: values.storageBucket,
    messagingSenderId: values.messagingSenderId,
    appId: values.appId,
  };

  assertDomainMatchesProject("authDomain", firebase.authDomain, firebase.projectId, [".firebaseapp.com", ".web.app"]);
  assertDomainMatchesProject("storageBucket", firebase.storageBucket, firebase.projectId, [".firebasestorage.app", ".appspot.com"]);
  assertWebAppIdentity(firebase);

  const emulatorHostRaw = input.emulatorHost;
  const hasEmulatorHost = !(emulatorHostRaw === undefined || emulatorHostRaw === null || emulatorHostRaw === "");

  if (appEnv === "production") {
    if (firebase.projectId !== PRODUCTION_FIREBASE_PROJECT_ID) {
      throw new FirebaseConfigError(
        "PRODUCTION_PROJECT_MISMATCH",
        `production 必須使用 ${PRODUCTION_FIREBASE_PROJECT_ID}，實際為 ${firebase.projectId}`,
      );
    }
    if (hasEmulatorHost) {
      throw new FirebaseConfigError("EMULATOR_HOST_UNEXPECTED", "production 不可設定 Emulator 連線");
    }
    if (firebase.messagingSenderId !== PRODUCTION_FIREBASE_PROJECT_NUMBER) {
      throw new FirebaseConfigError(
        "PRODUCTION_PROJECT_NUMBER_MISMATCH",
        `production 的 messagingSenderId／appId 必須屬於正式專案編號 ${PRODUCTION_FIREBASE_PROJECT_NUMBER}`,
      );
    }
    return Object.freeze({ appEnv, isProduction: true, firebase: Object.freeze(firebase), emulator: null });
  }

  // 非 production：任何欄位都不得指向正式專案
  for (const field of REQUIRED_FIREBASE_FIELDS) {
    if (mentionsProductionProject(firebase[field])) {
      throw new FirebaseConfigError(
        "PRODUCTION_PROJECT_FORBIDDEN",
        `${appEnv} 不可使用正式 Firebase（${field} 指向 ${PRODUCTION_FIREBASE_PROJECT_ID}）`,
      );
    }
  }
  // 不只看 projectId：正式專案的 Sender ID／App ID／API Key 都不得混入
  assertNoProductionCredentials(appEnv, firebase);

  if (appEnv === "emulator") {
    if (firebase.projectId !== EMULATOR_FIREBASE_PROJECT_ID) {
      throw new FirebaseConfigError(
        "EMULATOR_PROJECT_NOT_DEMO",
        `emulator 的 projectId 必須是 ${EMULATOR_FIREBASE_PROJECT_ID}，實際為 ${firebase.projectId}`,
      );
    }
    if (!hasEmulatorHost) {
      throw new FirebaseConfigError("EMULATOR_HOST_REQUIRED", `emulator 必須明確設定 emulatorHost=${EMULATOR_HOST}`);
    }
    if (emulatorHostRaw !== EMULATOR_HOST) {
      throw new FirebaseConfigError(
        "EMULATOR_HOST_NOT_LOOPBACK",
        `emulatorHost 只能是 ${EMULATOR_HOST}，實際為 ${String(emulatorHostRaw)}`,
      );
    }
    return Object.freeze({
      appEnv,
      isProduction: false,
      firebase: Object.freeze(firebase),
      emulator: Object.freeze({ host: EMULATOR_HOST, authPort: AUTH_EMULATOR_PORT, firestorePort: FIRESTORE_EMULATOR_PORT }),
    });
  }

  // preview／development：目前都只允許明確指定的雲端開發專案。
  if (firebase.projectId === EMULATOR_FIREBASE_PROJECT_ID) {
    throw new FirebaseConfigError("DEMO_PROJECT_OUTSIDE_EMULATOR", `${appEnv} 不可使用 Emulator 專案`);
  }
  if (hasEmulatorHost) {
    throw new FirebaseConfigError("EMULATOR_HOST_UNEXPECTED", `${appEnv} 不可設定 Emulator 連線`);
  }
  if (appEnv === "development" && firebase.projectId !== DEVELOPMENT_FIREBASE_PROJECT_ID) {
    throw new FirebaseConfigError(
      "DEVELOPMENT_PROJECT_MISMATCH",
      `development 必須使用 ${DEVELOPMENT_FIREBASE_PROJECT_ID}，實際為 ${firebase.projectId}`,
    );
  }
  if (appEnv === "preview" && firebase.projectId !== DEVELOPMENT_FIREBASE_PROJECT_ID) {
    throw new FirebaseConfigError(
      "PREVIEW_PROJECT_MISMATCH",
      `preview 必須使用 ${DEVELOPMENT_FIREBASE_PROJECT_ID}，實際為 ${firebase.projectId}`,
    );
  }
  if (!DEVELOPMENT_AUTH_DOMAINS.includes(firebase.authDomain)) {
    throw new FirebaseConfigError(
      "DOMAIN_PROJECT_MISMATCH",
      `${appEnv} 的 authDomain 必須是 ${DEVELOPMENT_AUTH_DOMAINS.join(" 或 ")}`,
    );
  }
  if (!DEVELOPMENT_STORAGE_BUCKETS.includes(firebase.storageBucket)) {
    throw new FirebaseConfigError(
      "DOMAIN_PROJECT_MISMATCH",
      `${appEnv} 的 storageBucket 必須是 ${DEVELOPMENT_STORAGE_BUCKETS.join(" 或 ")}`,
    );
  }
  return Object.freeze({ appEnv, isProduction: false, firebase: Object.freeze(firebase), emulator: null });
}

/**
 * 驗證設定後才選用或建立 Firebase App。呼叫端將 SDK 函式以 callback 傳入，
 * 讓設定錯誤與既有 App 不一致時都能保證不呼叫 initializeApp。
 */
export function initializeValidatedFirebaseApp<T extends FirebaseAppLike>(
  input: FirebaseEnvInput,
  existingApps: readonly T[],
  initialize: (config: FirebaseWebConfig) => T,
): { resolved: ResolvedFirebaseConfig; app: T } {
  const resolved = resolveFirebaseConfig(input);

  if (existingApps.length > 1) {
    throw new FirebaseConfigError(
      "EXISTING_APP_COUNT_UNEXPECTED",
      `預期最多一個 Firebase App，實際為 ${existingApps.length}`,
    );
  }

  const existing = existingApps[0];
  if (!existing) return { resolved, app: initialize(resolved.firebase) };

  for (const field of REQUIRED_FIREBASE_FIELDS) {
    const existingValue = existing.options[field];
    if (typeof existingValue !== "string" || existingValue.trim() === "") {
      throw new FirebaseConfigError(
        "EXISTING_APP_FIELD_MISSING",
        `既有 Firebase App 缺少必要設定 ${field}，拒絕重用`,
      );
    }
    if (existingValue !== resolved.firebase[field]) {
      throw new FirebaseConfigError(
        "EXISTING_APP_CONFIG_MISMATCH",
        `既有 Firebase App 的 ${field} 與已驗證設定不一致，拒絕重用`,
      );
    }
  }
  return { resolved, app: existing };
}
